/** User-facing strings built in code (static HTML text lives in index.html). All English. */
export const TEXT = {
  hud: {
    fps: (value: number) => `${value} FPS`,
    /** Zoom relative to the default camera distance, as a percentage (100% = the default view). */
    zoom: (factor: number) => `${Math.round(factor * 100)}%`,
    play: '▶ Play',
    stop: '■ Stop',
    help: { title: 'Help', close: 'Close', or: 'or' },
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
