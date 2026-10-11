/** `'#rrggbb'` -> `0xrrggbb`, the format Three.js expects. */
export const hexToNumber = (hex: string): number => parseInt(hex.replace('#', ''), 16);

/** `'#rrggbb'` + alpha -> `'rgba(r, g, b, a)'`. */
export function withAlpha(hex: string, alpha: number): string {
  const n = hexToNumber(hex);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const COLORS = {
  white: '#ffffff',
  black: '#000000',

  text: {
    primary: '#ffffff',
    /** Text on light backgrounds (the build hint). */
    inverse: '#1b2433',
  },

  /** Dark UI surfaces, from darkest (panels) to lightest (hovered controls). */
  surface: {
    panel: '#141821',
    panelHover: '#202634',
    input: '#1a1f2b',
    control: '#2d3446',
    controlHover: '#3a4359',
    divider: '#4a5368',
    /** Tint of the menu vignette. */
    vignette: '#0a0e18',
  },

  accent: {
    primary: '#2e9d55',
    primaryHover: '#38b765',
    danger: '#c8453b',
    highlight: '#ffd34e',
  },

  /** Colours inside the 3D scene. */
  scene: {
    /** Sky at the horizon; also the fog colour so the far floor fades into the sky. */
    sky: '#9fc5e8',
    skyZenith: '#4f8fd6',
    cloud: '#ffffff',
    cloudShade: '#a9bcdb',
    hemisphereGround: '#6b7a5a',
    floor: '#7fae6a',
    gridMajor: '#2f4f2f',
    gridMinor: '#4f7f4f',
    rampBrown: '#8a6f4d',
    rampGreen: '#6f8a4d',
    obstacleBlue: '#4d6f8a',
  },

  part: {
    block: '#d9453b',
    blockEdge: '#5a1a16',
    tire: '#23262d',
    spoke: '#dfe3ea',
    ghostValid: '#4cd964',
    ghostInvalid: '#ff3b30',
  },
} as const;

export const ALPHA = {
  panel: 0.85,
  panelStrong: 0.92,
  hint: 0.7,
  vignetteInner: 0.15,
  vignetteOuter: 0.55,
  tagline: 0.9,
  muted: 0.7,
  disabled: 0.45,
  ghost: 0.5,
  backdrop: 0.55,
} as const;

/** Colours with alpha baked in, ready for CSS. */
export const OVERLAYS = {
  panel: withAlpha(COLORS.surface.panel, ALPHA.panel),
  panelStrong: withAlpha(COLORS.surface.panel, ALPHA.panelStrong),
  panelHover: withAlpha(COLORS.surface.panelHover, ALPHA.panelStrong),
  hint: withAlpha(COLORS.white, ALPHA.hint),
  vignetteInner: withAlpha(COLORS.surface.vignette, ALPHA.vignetteInner),
  vignetteOuter: withAlpha(COLORS.surface.vignette, ALPHA.vignetteOuter),
  /** Dimmed layer behind modal dialogs. */
  backdrop: withAlpha(COLORS.black, ALPHA.backdrop),
} as const;
