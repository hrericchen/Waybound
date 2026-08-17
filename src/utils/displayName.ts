/**
 * Display-name filtering.
 *
 * Blocks offensive / profane names — including leetspeak bypasses like
 * "n1gga", "n|gga" or "nlgga" (1/l/| → i) — and auto-replaces an offending
 * name with a safe generated one in the format "[adjective][travel noun][number]",
 * e.g. "AdventurousExplorer42" (no separators).
 */

/** Common leetspeak / typo substitutions → letters (for detection only). */
const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  // People try to hide an "i" behind l / | / ! — decode them too.
  l: 'i',
  '|': 'i',
  '!': 'i',
  '@': 'a',
  $: 's',
};

/**
 * Offensive terms (racial/ethnic/LGBTQ+/disability slurs and strong profanity).
 * Matched as substrings against the fully normalized name. Short/ambiguous
 * words are intentionally left out to avoid renaming innocent users
 * (e.g. "spicy", "jasper", "peacock", "therapist").
 */
const BAD_WORDS: string[] = [
  // Racial / ethnic slurs
  'nigger',
  'nigga',
  'niggah',
  'chink',
  'kike',
  'kyke',
  'wetback',
  'gook',
  'paki',
  'raghead',
  'towelhead',
  'beaner',
  'slanteye',
  'cameljockey',
  'mooncricket',
  'porchmonkey',
  // LGBTQ+ slurs
  'faggot',
  'fagot',
  'fag',
  'dyke',
  'tranny',
  // Disability slurs
  'retard',
  'retarted',
  'mongoloid',
  // Strong profanity
  'fuck',
  'fucker',
  'fucking',
  'shit',
  'shitter',
  'bitch',
  'bitchass',
  'cunt',
  'asshole',
  'dickhead',
  'pussy',
  'whore',
  'slut',
  'bastard',
  'twat',
  'wanker',
  'cocksucker',
  'motherfucker',
  'bullshit',
  'douchebag',
  'cumshot',
  'gangbang',
  'nazi',
  'hitler',
];

const ADJECTIVES = [
  'Adventurous',
  'Wanderlust',
  'Curious',
  'Bold',
  'Sunny',
  'Starry',
  'Globetrotting',
  'Easygoing',
  'Fearless',
  'Chill',
  'Cosmic',
  'Golden',
  'Daring',
  'Free',
  'Kind',
  'Lively',
  'Mellow',
  'Swift',
  'Wild',
  'Dreamy',
];

const TRAVEL_NOUNS = [
  'Explorer',
  'Traveler',
  'Backpacker',
  'Wanderer',
  'Voyager',
  'Nomad',
  'Globetrotter',
  'Pilgrim',
  'Roamer',
  'Rambler',
  'Pathfinder',
  'Mariner',
  'Adventurer',
  'Sojourner',
  'Journeyer',
  'Scout',
  'Ranger',
  'Wayfarer',
];

/**
 * Decode leetspeak and strip separators so "n1gga" / "n|gga" / "nlgga" all
 * normalize to "nigga".
 */
export function normalizeForFiltering(name: string): string {
  return name
    .toLowerCase()
    .split('')
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join('')
    .replace(/[^a-z]/g, '');
}

/** True if the name contains an offensive term (after leetspeak decoding). */
export function isOffensiveName(name: string): boolean {
  const normalized = normalizeForFiltering(name || '');
  if (!normalized) return false;
  return BAD_WORDS.some((word) => normalized.includes(word));
}

/** Generate a safe fallback in the format "[adjective][travel noun][number]". */
export function generateSafeName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = TRAVEL_NOUNS[Math.floor(Math.random() * TRAVEL_NOUNS.length)];
  const num = Math.floor(Math.random() * 9000) + 100;
  return `${adj}${noun}${num}`;
}

export type SanitizeResult = {
  /** The name to actually use (original if clean, generated fallback if flagged). */
  value: string;
  /** True when the input was replaced with a generated safe name. */
  changed: boolean;
  /** True when the original input was flagged as offensive. */
  flagged: boolean;
};

/**
 * Sanitize a display name: trim/collapse whitespace and, if it contains
 * offensive content (including leetspeak bypasses), replace it with a
 * generated safe name.
 */
export function sanitizeDisplayName(name: string): SanitizeResult {
  const trimmed = (name || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { value: trimmed, changed: false, flagged: false };
  if (!isOffensiveName(trimmed)) return { value: trimmed, changed: false, flagged: false };
  return { value: generateSafeName(), changed: true, flagged: true };
}
