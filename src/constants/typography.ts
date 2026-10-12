export const FONT_FAMILY = "'Orbitron Variable', system-ui, sans-serif";

/** Font sizes in px. Orbitron is wide, so the scale is small. */
export const FONT_SIZE = {
  xs: 10,
  sm: 11,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 18,
  display: 56,
  title: 32,
} as const;

export const FONT_WEIGHT = {
  regular: 400,
  semibold: 600,
  extrabold: 800,
} as const;

/** Letter spacing in px. */
export const LETTER_SPACING = {
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
} as const;

export const LINE_HEIGHT = {
  normal: 1.6,
} as const;
