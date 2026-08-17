// Traveler Tags Configuration
// Each tag has a unique color scheme for visual differentiation

export interface TravelerTag {
  id: string;
  name: string;
  color: string;
  bgColor: string;  // Light background version
  emoji: string;
  requiresPro?: boolean;
}

export const TRAVELER_TAGS: TravelerTag[] = [
  {
    id: 'trekker',
    name: 'Trekker',
    color: '#FF6B35',    // Warm Orange
    bgColor: '#FFF0E8',
    emoji: '🥾',
  },
  {
    id: 'pioneer',
    name: 'Pioneer',
    color: '#4ECDC4',    // Teal
    bgColor: '#E8FAF8',
    emoji: '⛰️',
  },
  {
    id: 'wayfarer',
    name: 'Wayfarer',
    color: '#7C3AED',    // Purple
    bgColor: '#F3EEFF',
    emoji: '🧭',
  },
  {
    id: 'pathfinder',
    name: 'Pathfinder',
    color: '#059669',    // Emerald
    bgColor: '#ECFDF5',
    emoji: '🗺️',
  },
  {
    id: 'voyager',
    name: 'Voyager',
    color: '#2563EB',    // Royal Blue
    bgColor: '#EFF6FF',
    emoji: '⛵',
  },
  {
    id: 'nomad',
    name: 'Nomad',
    color: '#D97706',    // Amber
    bgColor: '#FFFDE7',
    emoji: '🐪',
  },
  {
    id: 'wanderer',
    name: 'Wanderer',
    color: '#DB2777',    // Rose
    bgColor: '#FFF1F2',
    emoji: '🌿',
  },
  {
    id: 'rambler',
    name: 'Rambler',
    color: '#0891B2',    // Cyan
    bgColor: '#ECFEFF',
    emoji: '🚶',
  },
  {
    id: 'globetrotter',
    name: 'Globetrotter',
    color: '#DC2626',    // Red
    bgColor: '#FEF2F2',
    emoji: '🌍',
  },
  {
    id: 'backpacker',
    name: 'Backpacker',
    color: '#65A30D',    // Lime
    bgColor: '#F7FEE7',
    emoji: '🎒',
  },
  {
    id: 'explorer',
    name: 'Explorer',
    color: '#6D28D9',    // Deep Purple
    bgColor: '#F5F3FF',
    emoji: '🔭',
  },
  {
    id: 'adventurer',
    name: 'Adventurer',
    color: '#0D9488',    // Deep Teal
    bgColor: '#F0FDFA',
    emoji: '🏔️',
  },
  {
    id: 'roamer',
    name: 'Roamer',
    color: '#F59E0B',    // Gold
    bgColor: '#FFFBEB',
    emoji: '🦅',
  },
  {
    id: 'trailblazer',
    name: 'Trailblazer',
    color: '#EF4444',    // Bright Red
    bgColor: '#FFF5F5',
    emoji: '🔥',
  },
  {
    id: 'jetsetter',
    name: 'Jetsetter',
    color: '#6366F1',    // Indigo
    bgColor: '#EEF2FF',
    emoji: '✈️',
  },
  {
    id: 'pro',
    name: 'Pro',
    color: '#FBBF24',    // Gold
    bgColor: '#FFFBEB',
    emoji: '⭐',
    requiresPro: true,
  },
];

// Default tag assigned to new users (Explorer)
export const DEFAULT_TAG = TRAVELER_TAGS.find(t => t.id === 'explorer')!;

// Helper to get a tag by ID
export function getTagById(id: string): TravelerTag | undefined {
  return TRAVELER_TAGS.find(t => t.id === id);
}

// Tag storage key (for Firebase / AsyncStorage)
export const USER_TAG_KEY = 'WB_USER_TAG';

export default TRAVELER_TAGS;