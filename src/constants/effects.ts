import { ALPHA, COLORS, withAlpha } from './colors';

const shadow = (alpha: number) => withAlpha(COLORS.black, alpha);

/** CSS shadows. */
export const SHADOW = {
  title: `0 4px 24px ${shadow(0.5)}`,
  text: `0 2px 8px ${shadow(0.5)}`,
  textSmall: `0 1px 6px ${shadow(0.6)}`,
  logo: `drop-shadow(0 8px 18px ${shadow(0.45)})`,
} as const;

/** Stacking order of fixed UI layers. */
export const Z_INDEX = {
  dialog: 100,
  /** The hotbar is raised above a modal's backdrop while the catalog is open, so parts can be dropped on it. */
  hotbarOverDialog: 101,
  dragGhost: 110,
  /** The loading screen covers everything. */
  loading: 200,
} as const;

/** Transition durations in ms. */
export const MOTION = {
  fast: 150,
  /** Fade-out of the loading screen. */
  loadingFade: 350,
} as const;

/** Opacity of muted / disabled UI, re-exported here so CSS and code agree. */
export const OPACITY = {
  muted: ALPHA.muted,
  disabled: ALPHA.disabled,
  tagline: ALPHA.tagline,
} as const;
