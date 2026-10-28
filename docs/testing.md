# Testing new features

There is no automated test suite yet: a feature is tested by running the game and exercising it, in the browser, with real
state. This page is the checklist. (`AGENTS.md` has the short version.)

## 1. Always test with the game muted

The game synthesises all its sound (Web Audio) and it keeps playing in the background while you test, so **mute it before
anything else** and keep it muted for the whole session.

- Press `M` or click `#btn-sound`. `M` **toggles**, so check the result: `#btn-sound` has the class `muted` when the sound is off.
- The choice is saved in `localStorage` under `buildblock.sound` (`{"muted":true}`), so it survives reloads of the same origin. A
  new port is a new origin: mute again each time you start a dev server on another port.
- To be sure from the console, before doing anything else:

  ```js
  localStorage.setItem('buildblock.sound', JSON.stringify({ muted: true })); location.reload();
  ```

- Close the tab when you are done.

If you add a sound (`SFX` recipe or a `VehicleSound` voice), listen to it once with the sound on, then mute again.

## 2. Run the game

```bash
npm run build                              # must pass: tsc type-check + vite build
npm run dev -- --port 5199 --strictPort    # a dev server of your own
```

Use a port other than 5173, which is usually the developer's own server, and stop only the process you started (by its PID).
The game starts in the main menu: **Play** opens the saved games, **New game** then **Create** starts an empty creation
(the page body stays hidden until `html.ready`, give it a second after loading).

## 3. Inspect and drive the game from the console

In dev mode `window.__buildblock` exposes `grid`, `camera`, `controls`, `getPhysics()`, `getVehicle()`, `getMode()`, `menuScene`,
`build`, `history`, `zoom` and `hotbar`.

- **Build a creation without clicking**: `grid.parts.clear()` then `grid.add({ type, cell, face, studs, spin, keys })`. `add`
  runs `canPlace`, so it returns `false` when the part is rejected; call `grid.canPlace(part)` to test a placement rule. Cells of
  a 2x2 block are centred on half cells (`partBox` from `/src/parts/part-geometry.ts` shows the box: `await import('/src/parts/part-geometry.ts')`).
- **Mounted parts** take the unit cell against the face and the face normal: a wheel beside a block at `x = 1` is
  `{ type: 'wheel', cell: [1.5, 0, 0], face: [1, 0, 0] }` for a block spanning `-1 … 1`.
- **Play / Stop**: dispatch `P` (`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', key: 'p', bubbles: true }))`); `R` restarts.
  Wait a second or two for the creation to settle before measuring.
- **Drive it with real keys**: no part has a default key, so give the parts their keys in the part (`keys: { forward: ['KeyW'] }`
  on an engine) and dispatch `keydown` / `keyup` for that code. `getVehicle().setAutopilot(...)` is only the menu's autopilot and
  needs `grid.engineDrive = false`; prefer real keys, with an engine, so the test is the same as the player's.
- **Measure, do not guess**: read bodies from `getPhysics()` (`chassis`, `wheelFx[i].body.translation()`, `body.rotation()`),
  sample over a few seconds and compare with the same creation built from a known part (a normal wheel is the reference for
  speed, pitch and ground clearance).
- **Engine pitch / wheelies**: a light test body exaggerates them, compare against the reference part instead of an absolute number.

The in-app browser pane pauses `requestAnimationFrame` while it is hidden: bring the tab to the front (a screenshot also
wakes it) before concluding that physics is frozen.

## 4. What to check for a new feature

1. `npm run build` passes.
2. **Placement**: the ghost is valid where it should be and red where `Grid.canPlace` says no; try the edges (build area limits,
   overlap with neighbours, every orientation `A` / `D` / `W` / `S`).
3. **Visuals**: take a screenshot in build mode, from more than one side; check the hotbar, the catalog preview (`C`) and the inspector.
4. **Play**: press Play, drive it, press `R`, then Stop: the intact build must come back. Check the console for errors.
5. **Saves**: reload the page and load the creation again (`Grid.load` sanitises parts; unknown fields are dropped).
6. **Old behaviour**: build something that worked before (a car with normal wheels) and check that it still drives the same.
7. **Menu**: the main-menu background builds random creations (`menu/random-build.ts`): make sure it still loads.
8. Docs: `help-content.ts` and `docs/` follow the rules in `AGENTS.md`, and the roadmap if the feature was on it.
