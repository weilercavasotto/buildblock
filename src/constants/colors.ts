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
  },

  /** Dark UI surfaces, from darkest (panels) to lightest (hovered controls). */
  surface: {
    panel: '#141821',
    panelHover: '#202634',
    input: '#1a1f2b',
    control: '#2d3446',
    controlHover: '#3a4359',
    divider: '#4a5368',
    /** Tint of the menu vignette; also the loading screen background and the page colour in the inline style of `index.html` (keep in sync). */
    vignette: '#0a0e18',
  },

  accent: {
    primary: '#2e9d55',
    primaryHover: '#38b765',
    danger: '#c8453b',
    highlight: '#ffd34e',
    highlightHover: '#ffe07a',
    /** Text on a highlight-coloured (yellow) button. */
    onHighlight: '#141821',
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
    /** Default block colour: a soft blue. */
    block: '#5fa0d6',
    blockEdge: '#2b4a66',
    /** The dark sockets on the underside of blocks, where studs go in. */
    socket: '#0b121b',
    tire: '#23262d',
    rim: '#dfe3ea',
    rimRecess: '#8f98a8',
    /** The placement ghost turns this colour when the part cannot be placed (otherwise it is the part itself, translucent). */
    ghostInvalid: '#ff3b30',
  },
} as const;

/**
 * Colours offered in the part inspector to paint parts that can be painted. The first entry is the default colour of a
 * block (choosing it removes the paint); the names are shown as tooltips.
 */
export const PAINT_COLORS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: 'Default (azure)', hex: COLORS.part.block },
  { name: 'Red', hex: '#d9453b' },
  { name: 'Orange', hex: '#f08a3c' },
  { name: 'Yellow', hex: '#f2c94c' },
  { name: 'Green', hex: '#6fbf73' },
  { name: 'Teal', hex: '#2fa89a' },
  { name: 'Purple', hex: '#9b6fd6' },
  { name: 'Pink', hex: '#e87ab0' },
  { name: 'White', hex: '#f2f4f8' },
  { name: 'Gray', hex: '#9aa3b2' },
  { name: 'Charcoal', hex: '#3b4252' },
  { name: 'Brown', hex: '#8d6e4a' },
];

/** Outline colour of a painted block, derived from its paint (the default block uses `COLORS.part.blockEdge`). */
export const PAINT_EDGE_FACTOR = 0.45;

export const ALPHA = {
  panel: 0.85,
  panelStrong: 0.92,
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
  vignetteInner: withAlpha(COLORS.surface.vignette, ALPHA.vignetteInner),
  vignetteOuter: withAlpha(COLORS.surface.vignette, ALPHA.vignetteOuter),
  /** Dimmed layer behind modal dialogs. */
  backdrop: withAlpha(COLORS.black, ALPHA.backdrop),
} as const;
