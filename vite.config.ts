import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  // Relative asset URLs, so the build also works from a folder (the packaged desktop app loads dist/index.html from disk).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
});
