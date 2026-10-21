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

/** Raised buttons: how thick the lower edge is, how far a press sinks it and how far a hover lifts it (px). */
export const BUTTON = {
  lip: 3,
  press: 2,
  lift: 1,
  /** The focus ring: thickness and distance from the button. */
  ring: 2,
  ringOffset: 2,
} as const;

/** Fixed component dimensions in px. */
export const SIZE = {
  logo: 110,
  panelWidth: 460,
  listMaxHeight: 260,
  separatorHeight: 28,
  dialogWidth: 380,
  /** Icon buttons (the help button). */
  iconButton: 44,
  icon: 24,
  helpWidth: 640,
  helpPanelHeight: 380,
  /** Width of the key-caps column of a help row. */
  helpKeysWidth: 180,
  hotbarSlot: 52,
  hotbarPreview: 40,
  /** Space kept free under a modal so the hotbar stays reachable (drag & drop target). */
  hotbarClearance: 120,
  catalogWidth: 900,
  catalogCardPreview: 96,
  catalogInspectorWidth: 280,
  catalogGridHeight: 500,
  /** Space the catalog keeps for its header and tabs, subtracted from the window height to size the body. */
  catalogChrome: 340,
  inspectorPreview: 160,
  dragGhost: 92,
  partInspectorWidth: 340,
  partInspectorPreview: 72,
  paintSwatch: 28,
  loadingLogo: 96,
  menuPlayIcon: 28,
  loadingBarWidth: 280,
  loadingBarHeight: 8,
  /** Gap between the top bar and the paint palette hanging under it. */
  paletteGap: 8,
  /** Margin above and below the part inspector (it is centred on the right edge); also the room kept free for the hotbar. */
  hotbarReserved: 100,
  zoomSliderHeight: 140,
  /** The sliders (zoom, inspector): the thickness of the track and the size of the knob. */
  sliderTrack: 6,
  sliderThumb: 16,
  /** The settings panel: its width, the width of a volume slider and the size of an on / off switch. */
  /** The coffee cup in the credit line of the main menu. */
  creditIcon: 16,
  settingsWidth: 460,
  /** The alerts panel (the bell): its width, and the size and the offset of the count badge on the bell. */
  alertsWidth: 480,
  /** The label in front of the key button of the inspector. */
  keyLabel: 56,
  badge: 20,
  badgeOffset: 6,
  settingsSlider: 170,
  switchWidth: 44,
  switchHeight: 24,
} as const;
