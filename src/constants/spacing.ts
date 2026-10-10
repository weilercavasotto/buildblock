/** Spacing scale in px (4 px grid). Use for padding, margins and gaps. */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 32,
  huge: 64,
} as const;

/** Corner radii in px. */
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/** Border / line widths in px. */
export const BORDER = {
  hairline: 1,
  regular: 2,
} as const;

/** Fixed component dimensions in px. */
export const SIZE = {
  logo: 110,
  panelWidth: 460,
  listMaxHeight: 260,
  separatorHeight: 28,
} as const;
