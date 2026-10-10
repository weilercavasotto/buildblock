import { ALPHA, COLORS, withAlpha } from './colors';

const shadow = (alpha: number) => withAlpha(COLORS.black, alpha);

/** CSS shadows. */
export const SHADOW = {
  title: `0 4px 24px ${shadow(0.5)}`,
  text: `0 2px 8px ${shadow(0.5)}`,
  textSmall: `0 1px 6px ${shadow(0.6)}`,
  logo: `drop-shadow(0 8px 18px ${shadow(0.45)})`,
} as const;

/** Opacity of muted / disabled UI, re-exported here so CSS and code agree. */
export const OPACITY = {
  muted: ALPHA.muted,
  disabled: ALPHA.disabled,
  tagline: ALPHA.tagline,
} as const;
