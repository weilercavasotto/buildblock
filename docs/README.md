# BlockLab documentation

BlockLab is a 3D, web-based building game in the spirit of LEGO: place blocks on a
grid, mount wheels on them, then press **Play** to drive your creation under simulated physics.

| Document | Contents |
|---|---|
| [getting-started.md](getting-started.md) | Install, run, build and play |
| [architecture.md](architecture.md) | Modules, data flow and conventions |
| [constants.md](constants.md) | Design tokens and constants (colours, spacing, typography, physics, text) and how they reach CSS |
| [physics.md](physics.md) | How Play mode turns the grid into rigid bodies and motors, plus tuning constants |
| [packaging.md](packaging.md) | Building a desktop app (macOS `.dmg`) with Pake |
| [adding-a-part.md](adding-a-part.md) | Step-by-step guide to adding a new kind of part |
| [testing.md](testing.md) | How to test a new feature in the browser (always with the game muted) |
| [roadmap.md](roadmap.md) | Known limitations and ideas for next steps |

## Stack

- TypeScript + [Vite](https://vite.dev)
- [Orbitron](https://fonts.google.com/specimen/Orbitron) UI font, self-hosted via `@fontsource-variable/orbitron` (OFL)
- [Three.js](https://threejs.org) for rendering
- [Rapier](https://rapier.rs) (`@dimforge/rapier3d-compat`, WASM) for physics

## Conventions

- All in-game text is **English**.
- The game starts in the main menu; creations live in named save slots.
- Never hard-code colours, sizes, spacing, fonts or tunable numbers: use `src/constants/` ([constants.md](constants.md)).
- Source files are named in **kebab-case** (`build-mode.ts`); classes inside stay PascalCase.
