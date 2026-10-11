/** User-facing strings built in code (static HTML text lives in index.html). All English. */
export const TEXT = {
  hud: {
    fps: (value: number) => `${value} FPS`,
    play: '▶ Play',
    stop: '■ Stop',
    buildHint:
      'Left click: place (drag to paint blocks) · Right click: remove · Middle drag: rotate camera · Right drag: pan · Scroll: zoom<br>' +
      'Wheel: click the side of a block · F3: toggle FPS',
    playHint: 'W/S: accelerate/reverse · A/D: steer · R: restart · Stop returns to building · F3: toggle FPS',
  },
  menu: {
    version: (v: string) => `v${v}`,
    noSaves: 'No saved games yet. Start a new one below.',
    load: 'Load',
    delete: 'Delete',
    defaultSaveName: (n: number) => `Creation ${n}`,
    parts: (count: number) => (count === 1 ? '1 part' : `${count} parts`),
    deleteDialog: {
      title: 'Delete saved game?',
      message: (name: string) => `"${name}" will be permanently deleted. This cannot be undone.`,
      confirm: 'Delete',
      cancel: 'Cancel',
    },
    dateLocale: 'en-US',
  },
} as const;
