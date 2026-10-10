/** User-facing strings built in code (static HTML text lives in index.html). All English. */
export const TEXT = {
  hud: {
    play: '▶ Play',
    stop: '■ Stop',
    buildHint:
      'Left click: place · Right click: remove · Drag: rotate camera (right drag: pan) · Scroll: zoom<br>' +
      'Wheel: click the side of a block',
    playHint: 'W/S: accelerate/reverse · A/D: steer · R: restart · Stop returns to building',
  },
  menu: {
    version: (v: string) => `v${v}`,
    noSaves: 'No saved games yet. Start a new one below.',
    load: 'Load',
    delete: 'Delete',
    defaultSaveName: (n: number) => `Creation ${n}`,
    parts: (count: number) => (count === 1 ? '1 part' : `${count} parts`),
    confirmDelete: (name: string) => `Delete "${name}"? This cannot be undone.`,
    dateLocale: 'en-US',
  },
} as const;
