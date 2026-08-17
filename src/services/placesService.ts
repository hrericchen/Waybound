import { GOOGLE_API_KEY, PLACES_API_KEY, PEXELS_API_KEY } from '../constants/google';
import AsyncStorage from '@react-native-async-storage/async-storage';
import storageService from './storageService';

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
  /** Google Places photo media URL (for city banners), if the place has one. */
  photoUrl?: string;
};

/**
 * Detect the device language (BCP-47) for localized place results.
 * Falls back to "en" when detection is unavailable.
 */
function getDeviceLanguage(): string {
  try {
    // Hermes / modern RN supports Intl locale resolution
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
    return (locale.split('-')[0] || 'en').split('_')[0];
  } catch {
    return 'en';
  }
}

/**
 * The Places API (New) Text Search field mask requested by the product spec.
 * We request full formattedAddress + addressComponents so non-Western
 * (e.g. Japanese block) addresses render correctly instead of being truncated
 * into Western "street number + street name" structures.
 */
const FIELD_MASK =
  'places.displayName,places.formattedAddress,places.addressComponents,places.location,places.types,places.photos';


/**
 * Format a raw Places API (New) response object into our normalized shape.
 * Reads the full `formattedAddress` string rather than reconstructing from
 * individual addressComponents — this is what keeps Japanese/Asian addresses
 * intact.
 */
export function formatPlace(place: any): PlaceResult {
  const photoName = place.photos?.[0]?.name;
  return {
    id: place.id || place.name || '',
    name: place.displayName?.text || place.name || 'Unknown place',
    address: place.formattedAddress || '',
    lat: place.location?.latitude ?? 0,
    lng: place.location?.longitude ?? 0,
    types: place.types || [],
    photoUrl: photoName
      ? `https://places.googleapis.com/v1/${photoName}/media?key=${PLACES_API_KEY}&maxWidthPx=1200`
      : undefined,
  };
}

/**
 * True when a place is a city or town. Handles both Google types
 * ('locality', 'administrative_area_level_1') and Photon/OSM types
 * ('city', 'town', 'village', 'municipality').
 */
export function isCityPlace(p: PlaceResult): boolean {
  const t = p.types || [];
  return (
    t.includes('locality') ||
    t.includes('administrative_area_level_1') ||
    t.includes('city') ||
    t.includes('town') ||
    t.includes('village') ||
    t.includes('municipality')
  );
}

/**
 * Places API (New) Text Search.
 * Uses a soft locationBias (centered on the destination city) rather than a
 * hard locationRestriction, so global queries still succeed.
 */
export async function searchPlaces(
  query: string,
  options?: { locationBias?: { lat: number; lng: number }; language?: string }
): Promise<PlaceResult[]> {
  const language = options?.language || getDeviceLanguage();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': PLACES_API_KEY,
    'X-Goog-FieldMask': FIELD_MASK,
  };

  const body: any = {
    textQuery: query,
    languageCode: language,
  };

  // Soft bias — not a restriction, so the API can still return global results.
  if (options?.locationBias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.locationBias.lat,
          longitude: options.locationBias.lng,
        },
        radius: 50000.0,
      },
    };
  }

  const url = 'https://places.googleapis.com/v1/places:searchText';
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const places: any[] = data.places || [];
  const results = places.map(formatPlace).filter((p) => p.lat !== 0 || p.lng !== 0);

  // Fallback: if a biased query returned nothing, retry without the bias so
  // global/typo'd queries ("Maji Jingu" → "Meiji Jingu") still resolve.
  if (results.length === 0 && options?.locationBias) {
    return searchPlaces(query, { language });
  }
  return results;
}


/**
 * Legacy Autocomplete fallback — used when the Places API (New) is not yet
 * enabled on the project. Returns normalized results with lat/lng via details.
 */
async function legacyAutocomplete(query: string): Promise<PlaceResult[]> {
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
    query
  )}&key=${GOOGLE_API_KEY}&language=en`;
  const res = await fetch(url);
  const data = await res.json();
  const predictions: any[] = data.predictions || [];
  const results = await Promise.all(
    predictions.slice(0, 5).map(async (p: any) => {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&key=${GOOGLE_API_KEY}&fields=geometry,name,formatted_address`;
      try {
        const dRes = await fetch(detailsUrl);
        const dData = await dRes.json();
        const r = dData.result || {};
        return {
          id: p.place_id,
          name: r.name || p.description,
          address: r.formatted_address || p.description,
          lat: r.geometry?.location?.lat ?? 0,
          lng: r.geometry?.location?.lng ?? 0,
          types: r.types || [],
        } as PlaceResult;
      } catch {
        return null;
      }
    })
  );
  return results.filter((r): r is PlaceResult => !!r && r.lat !== 0);
}

/**
 * Geocode a raw address string (used for the "Add Custom Location" fallback).
 * Google Geocoding first, free Photon/OSM as the fallback.
 */
export async function geocodeAddress(address: string): Promise<PlaceResult | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${GOOGLE_API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const r = data.results?.[0];
    if (r) {
      return {
        id: r.place_id,
        name: address,
        address: r.formatted_address || address,
        lat: r.geometry?.location?.lat ?? 0,
        lng: r.geometry?.location?.lng ?? 0,
        types: r.types || [],
      };
    }
  } catch (e) {
    console.warn('Geocode failed:', e);
  }
  // Free fallback: Photon (OSM).
  const photon = await searchPhoton(address);
  return photon[0] || null;
}

/**
 * Fetch extra detail for a place (editorial summary / description + a photo),
 * used to auto-build the Overview "Highlights" section. `placeId` must be a
 * Places API (New) id (e.g. "places/ChIJ..."); legacy ids just return null.
 */
export async function getPlaceDetails(
  placeId: string
): Promise<{ description?: string; photoUrl?: string } | null> {
  try {
    const url = `https://places.googleapis.com/v1/${placeId}`;
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': PLACES_API_KEY,
        'X-Goog-FieldMask': 'displayName,editorialSummary,photos',
      },
    });
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;
    const photoName = data.photos?.[0]?.name;
    return {
      description: data.editorialSummary?.text || undefined,
      photoUrl: photoName
        ? `https://places.googleapis.com/v1/${photoName}/media?key=${PLACES_API_KEY}&maxWidthPx=1200`
        : undefined,
    };
  } catch (e) {
    console.warn('getPlaceDetails failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Local caching — repeat lookups cost $0 and are instant. Cache is pruned so
// it never grows out of control.
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'WB_PLACES_';
const SEARCH_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const INFO_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_CACHE_KEYS = 200;

const normalizeQuery = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

async function cacheRead<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const entry = await storageService.load(key);
    if (entry && typeof entry.savedAt === 'number' && Date.now() - entry.savedAt < ttlMs) {
      return entry.data as T;
    }
  } catch (e) {
    // ignore cache read errors
  }
  return null;
}

async function cacheWrite(key: string, data: any): Promise<void> {
  try {
    await storageService.save(key, { savedAt: Date.now(), data });
    // Prune the oldest entries when we exceed the cap.
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CACHE_PREFIX));
    if (keys.length > MAX_CACHE_KEYS) {
      const now = Date.now();
      const aged: { key: string; age: number }[] = [];
      for (const k of keys) {
        try {
          const raw = await AsyncStorage.getItem(k);
          if (raw) aged.push({ key: k, age: now - (JSON.parse(raw)?.savedAt || 0) });
        } catch {}
      }
      aged.sort((a, b) => b.age - a.age);
      const toRemove = aged.slice(0, aged.length - MAX_CACHE_KEYS).map((e) => e.key);
      if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
    }
  } catch (e) {
    console.warn('[places] cache write failed:', e);
  }
}

function searchCacheKey(query: string, bias?: { lat: number; lng: number }): string {
  const biasKey = bias ? `${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}` : 'none';
  return `${CACHE_PREFIX}SEARCH_${hashString(normalizeQuery(query) + '|' + biasKey)}`;
}

// ---------------------------------------------------------------------------
// Photon (Komoot) — free OSM-based search, no API key.
// ---------------------------------------------------------------------------

function formatPhotonPlace(f: any): PlaceResult | null {
  const p = f?.properties || {};
  const coords = f?.geometry?.coordinates || [];
  const lon = coords[0];
  const lat = coords[1];
  const name = p.name || '';
  if (!name || lat === undefined || lon === undefined) return null;
  const address = [p.housenumber, p.street, p.district, p.city, p.state, p.country]
    .filter(Boolean)
    .join(', ');
  return {
    id: `photon-${p.osm_type || 'osm'}-${p.osm_id || name}`,
    name,
    address,
    lat,
    lng: lon,
    types: [p.type, p.osm_value, p.osm_key].filter(Boolean),
  };
}

export async function searchPhoton(
  query: string,
  locationBias?: { lat: number; lng: number }
): Promise<PlaceResult[]> {
  try {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&lang=en`;
    if (locationBias) {
      url += `&lat=${locationBias.lat}&lon=${locationBias.lng}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    const features: any[] = data?.features || [];
    return features.map(formatPhotonPlace).filter((r): r is PlaceResult => !!r);
  } catch (e) {
    console.warn('Photon search failed:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Wikipedia REST API — free descriptions + thumbnails (no key).
// ---------------------------------------------------------------------------

export async function getWikipediaSummary(
  title: string
): Promise<{ description?: string; photoUrl?: string } | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    );
    if (res.status === 404) return null;
    const data = await res.json();
    if (!data || data.type === 'disambiguation' || data.type === 'missing') return null;
    return {
      description: data.extract || undefined,
      photoUrl: data.thumbnail?.source || undefined,
    };
  } catch (e) {
    console.warn('Wikipedia lookup failed:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pexels — free photos (used for ~half of highlight images; Google covers the
// rest so we stay within the Pexels free tier).
// ---------------------------------------------------------------------------

export async function searchPexelsPhoto(query: string): Promise<string | null> {
  if (!PEXELS_API_KEY || PEXELS_API_KEY.startsWith('<')) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    const data = await res.json();
    const photo = data?.photos?.[0];
    return photo?.src?.medium || photo?.src?.large || null;
  } catch (e) {
    console.warn('Pexels search failed:', e);
    return null;
  }
}

/**
 * Best-effort place info for Highlights: free Wikipedia description/photo
 * first, then a ~50/50 Pexels (free) vs Google photo split so neither service
 * is the single dependency.
 */
export async function resolvePlaceInfo(
  name: string,
  fallback: { id?: string; photoUrl?: string }
): Promise<{ description?: string; photoUrl?: string }> {
  const cacheKey = `${CACHE_PREFIX}INFO_${hashString(normalizeQuery(name))}`;
  const cached = await cacheRead<{ description?: string; photoUrl?: string }>(cacheKey, INFO_TTL);
  if (cached) return cached;

  let description: string | undefined;
  let photoUrl: string | undefined;

  const wiki = await getWikipediaSummary(name);
  if (wiki?.description) description = wiki.description;
  if (wiki?.photoUrl) photoUrl = wiki.photoUrl;

  if (!description && fallback?.id) {
    const details = await getPlaceDetails(fallback.id);
    if (details?.description) description = details.description;
  }

  if (!photoUrl) {
    if (hashString(normalizeQuery(name)) % 2 === 0) {
      // Pexels for ~half of places (free), Google photo as its fallback.
      photoUrl = (await searchPexelsPhoto(name)) || fallback.photoUrl;
    } else {
      // Google photo (already present in the search response) for the rest.
      photoUrl = fallback.photoUrl;
    }
  }

  const result = { description, photoUrl };
  await cacheWrite(cacheKey, result);
  return result;
}

/**
 * Primary search entry point with resiliency + cost split:
 * - ~half of queries go to Google (Places New → legacy Autocomplete)
 * - ~half go to Photon/OSM (free, no key)
 * Each side falls back to the other when it returns nothing, and results are
 * cached locally (30 days) so repeat lookups never hit the network.
 */
export async function searchPlacesResilient(
  query: string,
  locationBias?: { lat: number; lng: number }
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];

  const cacheKey = searchCacheKey(q, locationBias);
  const cached = await cacheRead<PlaceResult[]>(cacheKey, SEARCH_TTL);
  if (cached) return cached;

  const hasGoogle = !!(PLACES_API_KEY && !PLACES_API_KEY.startsWith('<'));
  // Stable 50/50 split per query (deterministic → consistent UX + cache).
  const photonFirst = hashString(normalizeQuery(q)) % 2 === 0;

  const googleSearch = async (): Promise<PlaceResult[]> => {
    try {
      const results = await searchPlaces(q, { locationBias });
      if (results.length > 0) return results;
      return await legacyAutocomplete(q);
    } catch (e) {
      console.warn('Places (New) search failed:', e);
      try {
        return await legacyAutocomplete(q);
      } catch (e2) {
        console.warn('Legacy places search failed too:', e2);
        return [];
      }
    }
  };

  let results: PlaceResult[] = [];
  if (photonFirst) {
    results = await searchPhoton(q, locationBias);
    if (results.length === 0 && hasGoogle) results = await googleSearch();
  } else {
    if (hasGoogle) results = await googleSearch();
    if (results.length === 0) results = await searchPhoton(q, locationBias);
  }

  if (results.length > 0) await cacheWrite(cacheKey, results);
  return results;
}

export default { searchPlaces: searchPlacesResilient, geocodeAddress, formatPlace };
