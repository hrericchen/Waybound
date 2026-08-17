#!/usr/bin/env node
/**
 * Find (and optionally delete) "unknown" community itineraries — documents in
 * the Firestore `itineraries` collection that have no title and no cover image
 * (i.e. ghost posts with neither a name nor a picture).
 *
 * Talks to the Firestore REST API directly with node's built-in fetch (the
 * client gRPC SDK can hang in Node). Public reads are allowed by the deployed
 * rules; deletes will work if the deployed rules permit them for this request
 * (the app's documented catch-all `match /{document=**} { allow read, write: if true }`
 * allows unauthenticated writes). If a delete is rejected, the id is reported
 * as failed rather than aborting the whole run.
 *
 * Usage:
 *   node scripts/cleanup_unknown_itinerary.js             # dry run (list only)
 *   node scripts/cleanup_unknown_itinerary.js --delete    # tombstone + delete matching docs
 *   node scripts/cleanup_unknown_itinerary.js --tombstone <id>   # tombstone one id (anti-ghost)
 */

const PROJECT = 'verba-ai-98eaf';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function fieldValue(v) {
  if (!v) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return Number(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue) return v.arrayValue.values;
  if (v.mapValue) return v.mapValue.fields;
  return undefined;
}

function readDoc(d) {
  const f = d.fields || {};
  const out = { id: d.name.split('/').pop() };
  for (const key of Object.keys(f)) {
    out[key] = fieldValue(f[key]);
  }
  return out;
}

async function fetchItineraries() {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${BASE}/itineraries?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`${res.status}: ${JSON.stringify(json.error || json)}`);
    }
    if (json.documents) {
      for (const d of json.documents) docs.push(readDoc(d));
    }
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function deleteItinerary(id) {
  const res = await fetch(`${BASE}/itineraries/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(`${res.status} ${json.error?.message || JSON.stringify(json.error || {})}`);
  }
  return true;
}

/**
 * Write a tombstone (`deleted: true`) so the app's community feed keeps hiding
 * the id even if some device still has a stale local cache copy of it
 * (matches the app's own adminDeleteItinerary pattern).
 */
async function tombstoneItinerary(id) {
  const url = `${BASE}/itineraries?documentId=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { deleted: { booleanValue: true } } }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(`${res.status} ${json.error?.message || JSON.stringify(json.error || {})}`);
  }
  return true;
}

async function main() {
  const doDelete = process.argv.includes('--delete');
  const tombstoneArgIdx = process.argv.indexOf('--tombstone');
  const tombstoneId = tombstoneArgIdx >= 0 ? process.argv[tombstoneArgIdx + 1] : null;

  if (tombstoneId) {
    try {
      await tombstoneItinerary(tombstoneId);
      console.log(`  TOMBSTONED ${tombstoneId}`);
    } catch (e) {
      console.log(`  FAILED ${tombstoneId}: ${e.message}`);
      process.exitCode = 1;
    }
    return;
  }

  const all = await fetchItineraries();
  console.log(`Total itineraries in Firestore: ${all.length}\n`);

  console.log('=== All itineraries ===');
  for (const i of all) {
    const title = isBlank(i.title) ? '(NO TITLE)' : `"${String(i.title).trim()}"`;
    const cover = i.coverImage || i.coverImageBase64 ? 'image' : 'no-image';
    console.log(
      `  ${i.id}  title=${title}  cover=${cover}  authorId=${i.authorId || '?'}  authorName=${i.authorName || '?'}  createdAt=${i.createdAt || '?'}  deleted=${!!i.deleted}`
    );
  }

  const unknown = all.filter(
    (i) => isBlank(i.title) && !i.coverImage && !i.coverImageBase64 && !i.deleted
  );

  console.log(
    `\n=== "Unknown" itineraries (no title + no image): ${unknown.length} ===`
  );
  for (const i of unknown) {
    console.log(
      `  ${i.id}  createdAt=${i.createdAt || '?'}  authorId=${i.authorId || '?'}  authorName=${i.authorName || '?'}`
    );
  }

  if (doDelete) {
    let ok = 0;
    let failed = 0;
    for (const i of unknown) {
      try {
        // Tombstone first (anti-ghost, same as app's adminDeleteItinerary),
        // then hard delete from Firestore.
        await tombstoneItinerary(i.id);
        await deleteItinerary(i.id);
        console.log(`  DELETED ${i.id}`);
        ok++;
      } catch (e) {
        console.log(`  FAILED ${i.id}: ${e.message}`);
        failed++;
      }
    }
    console.log(`\nDelete finished: ${ok} deleted, ${failed} failed.`);
  } else {
    console.log('\nDry run — pass --delete to actually delete the above.');
  }
}

main().catch((e) => {
  console.error('Script error:', e.message || e);
  process.exit(1);
});
