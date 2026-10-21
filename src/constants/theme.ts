import { ALPHA, COLORS, OVERLAYS } from './colors';
import { MOTION, OPACITY, SHADOW, Z_INDEX } from './effects';
import { BORDER, BUTTON, RADIUS, SIZE, SPACE } from './spacing';
import { FONT_FAMILY, FONT_SIZE, FONT_WEIGHT, LETTER_SPACING, LINE_HEIGHT } from './typography';

type Tokens = { readonly [key: string]: string | number | Tokens | readonly unknown[] };

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function flatten(tokens: Tokens, prefix: string, unit: string, out: Array<[string, string]>): void {
  for (const [key, value] of Object.entries(tokens)) {
    const name = `${prefix}-${kebab(key)}`;
    if (typeof value === 'string') out.push([name, value]);
    else if (typeof value === 'number') out.push([name, `${value}${unit}`]);
    else if (!Array.isArray(value)) flatten(value as Tokens, name, unit, out);
  }
}

/**
 * Publishes the design tokens as CSS custom properties on :root so `styles/main.css` and TypeScript share one
 * source of truth. Naming: `--<group>-<key>` in kebab-case, e.g. `--color-surface-panel`, `--space-md`.
 */
export function applyTheme(root: HTMLElement = document.documentElement): void {
  const vars: Array<[string, string]> = [];
  flatten(COLORS, '--color', '', vars);
  flatten(OVERLAYS, '--overlay', '', vars);
  flatten(ALPHA, '--alpha', '', vars);
  flatten(OPACITY, '--opacity', '', vars);
  flatten(SHADOW, '--shadow', '', vars);
  flatten(Z_INDEX, '--z-index', '', vars);
  flatten(MOTION, '--motion', 'ms', vars);
  flatten(SPACE, '--space', 'px', vars);
  flatten(RADIUS, '--radius', 'px', vars);
  flatten(BORDER, '--border', 'px', vars);
  flatten(SIZE, '--size', 'px', vars);
  flatten(BUTTON, '--button', 'px', vars);
  flatten(FONT_SIZE, '--font-size', 'px', vars);
  flatten(FONT_WEIGHT, '--font-weight', '', vars);
  flatten(LETTER_SPACING, '--letter-spacing', 'px', vars);
  flatten(LINE_HEIGHT, '--line-height', '', vars);
  vars.push(['--font-family', FONT_FAMILY]);

  for (const [name, value] of vars) root.style.setProperty(name, value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS.surface.input);
}
