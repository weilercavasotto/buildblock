# Constants and design tokens

Every colour, size, spacing, font, physics number and user-facing string lives in `src/constants/`.
**Do not hard-code them elsewhere**; import from `../constants` (barrel `index.ts`).

| File | Contents |
|---|---|
| `colors.ts` | `COLORS` (text, surface, accent, scene, part), `ALPHA`, `OVERLAYS` (colours with alpha baked in), helpers `hexToNumber` (for Three.js) and `withAlpha` |
| `spacing.ts` | `SPACE` (4 px scale: xs 4, sm 8, md 12, lg 16, xl 20, xxl 32, huge 64), `RADIUS` (sm 8, md 12, lg 16), `BORDER`, `SIZE` (logo, panel width, ...) |
| `typography.ts` | `FONT_FAMILY`, `FONT_SIZE`, `FONT_WEIGHT`, `LETTER_SPACING`, `LINE_HEIGHT` |
| `effects.ts` | `SHADOW` (CSS shadows), `OPACITY`, `Z_INDEX` (stacking of fixed layers) and `MOTION` (transition durations) |
| `game.ts` | Cell size, ground height, camera (incl. zoom limits), wheel model (`WHEEL_VISUAL`), hotbar slots, 3D preview, drag and highlight settings, rotation smoothing (`ROTATION`), zoom control, scene, lights, undo history, frame limit, FPS counter, sky (`SKY`: cloud cell size, wind, coverage, bevel...), roughness, wheel visuals, build input, storage keys, save limits, main-menu scene and random-car parameters |
| `game.ts` | also `GRID_SIZES` / `DEFAULT_GRID_CELLS` / `validGridCells` (the selectable floor-grid sizes, 16 / 32 / 64 squares per side; the largest is the default) and `buildRange(cells)` (min / max x and z of a buildable cell) |
| `game.ts` | also `LOADING` (loading-screen minimum duration, paint wait) |
| `physics.ts` | also `WHEEL_SIZES` / `wheelSizeOf`, `TIRES` / `DEFAULT_TIRE` / `tireOf` and `SUSPENSION` with `suspensionOf` / `clampSuspension` / `suspensionStiffness` |
| `physics.ts` | `WORLD`, `WHEEL`, `CHASSIS`, `VEHICLE`, `COLLISION_GROUP`, `SPAWN_LIFT`, `GROUND_COLLIDER`, `SCENERY` |
| `colors.ts` | also `PAINT_COLORS` (inspector palette; first = default colour) and `PAINT_EDGE_FACTOR` |
| `cursor-modes.ts` | `CURSOR_MODES`: id, label, shortcut key/code, description and SVG `icon` of the Build / Inspect / Paint / Remove modes |
| `part-catalog.ts` | `PART_CATEGORIES`, `PART_INFO` (name, category, description, properties, tips, preview angle per part) and `PART_ORDER`: the data behind the hotbar and the catalog |
| `help-content.ts` | `HELP_TABS`: the tabs, sections and key/description rows of the help dialog (keep in sync with the controls) |
| `text.ts` | `TEXT`: strings built in code (static HTML text stays in `index.html`) |
| `theme.ts` | `applyTheme()`: publishes the tokens as CSS variables |

## One source of truth for TypeScript and CSS

`applyTheme()` runs first in `main.ts` and writes CSS custom properties on `:root`.
`src/styles/main.css` uses only those variables and contains no literal colour, px size or font.

Naming: `--<group>-<key>` in kebab-case, flattened from the constants:

| Constant | CSS variable |
|---|---|
| `COLORS.surface.panel` | `--color-surface-panel` |
| `OVERLAYS.panelStrong` | `--overlay-panel-strong` |
| `SPACE.lg` (px) | `--space-lg` |
| `RADIUS.md` | `--radius-md` |
| `FONT_SIZE.display` | `--font-size-display` |
| `FONT_WEIGHT.semibold` | `--font-weight-semibold` |
| `SHADOW.title` | `--shadow-title` |
| `FONT_FAMILY` | `--font-family` |

Numbers get `px` for spacing, radius, border, size, font size and letter spacing; alpha, weights and
line height stay unitless. `applyTheme()` also sets the `theme-color` meta tag.

## Adding or changing a token

1. Add/change it in the matching file under `src/constants/` (and re-export in `index.ts` if it is a new file).
2. If CSS needs it, add its group to `applyTheme()` (new groups only) and reference `var(--...)` in `main.css`.
3. Never write the raw value elsewhere. Pick the nearest token instead of inventing an off-scale number.

## Not covered by the tokens

The SVG branding assets in `public/` (`logo-mark.svg`, `favicon.svg`) are static files with their own colours,
the red brand brick and `COLORS.surface.input` (the icon background). The in-game block colour (`COLORS.part.block`, a soft
blue) is independent of the logo; update the SVGs by hand if you want them to follow.
The static `<meta name="theme-color">` in `index.html` is only a pre-JS fallback.
