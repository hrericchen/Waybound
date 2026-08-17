import { useWindowDimensions } from 'react-native';

/**
 * Central responsive scale for the whole app.
 *
 * Every button/label font size is derived from this single hook, so when the
 * base size or scale changes here, ALL related text across the tab bar, Home
 * toolbox, itinerary toolbar, and trip quick actions updates together.
 *
 * The design width is 375dp (the "mini/SE" tier). Narrower phones scale text
 * down smoothly (clamped), wider phones stay at the base size so nothing ever
 * gets oversized.
 */
export function useResponsive() {
  const { width } = useWindowDimensions();
  const scale = Math.min(Math.max(width / 375, 0.82), 1);
  // Binary flag for layout tweaks (padding, icon sizes) on small phones.
  const compact = width < 370;
  return { width, scale, compact };
}

/**
 * Scale a base font size for the current device width, never below the base
 * size times `minScale` (so text stays readable even on tiny screens).
 */
export function fs(base: number, scale: number, minScale = 0.72): number {
  return Math.max(base * scale, base * minScale);
}
