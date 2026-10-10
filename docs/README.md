# BlockLab documentation

BlockLab is a 3D, web-based building game in the spirit of LEGO: place blocks on a
grid, mount wheels on them, then press **Play** to drive your creation under simulated physics.

| Document | Contents |
|---|---|
| [getting-started.md](getting-started.md) | Install, run, build and play |
| [architecture.md](architecture.md) | Modules, data flow and conventions |
| [physics.md](physics.md) | How Play mode turns the grid into rigid bodies and motors, plus tuning constants |
| [adding-a-part.md](adding-a-part.md) | Step-by-step guide to adding a new kind of part |
| [roadmap.md](roadmap.md) | Known limitations and ideas for next steps |

## Stack

- TypeScript + [Vite](https://vite.dev)
- [Three.js](https://threejs.org) for rendering
- [Rapier](https://rapier.rs) (`@dimforge/rapier3d-compat`, WASM) for physics

## Conventions

- All in-game text is **English**.
- The game starts in the main menu; creations live in named save slots.
- Source files are named in **kebab-case** (`build-mode.ts`); classes inside stay PascalCase.
