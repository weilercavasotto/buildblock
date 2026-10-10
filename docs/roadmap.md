# Roadmap and known limitations

## Known limitations

- Wheels can only be mounted on the **side** faces of blocks (axle along X or Z).
- Only the wheels parallel to the majority axle are driven; every driven wheel gets the same torque.
- Only block and wheel parts exist.
- No export/import of saves, no rename of existing saves and no undo/redo.
- Blocks have no joints that can break; a structure never falls apart.
- Scenery in Play mode is fixed (a couple of ramps and obstacles).
- Controls are fixed WASD/arrows; there is no per-wheel key configuration.

## Ideas

- More parts: slopes, thrusters, hinges, suspension, steering wheels.
- Per-wheel key bindings (Besiege-style) and a steerable/non-driven wheel flag.
- Undo/redo, copy/paste and save slots (export/import JSON).
- Block colours and materials.
- Breakable connections and damage.
- Larger maps, terrain editor and objectives.
- Automated tests for `Grid`, `save.ts` and the physics setup.
- Script to regenerate `favicon.ico` / `apple-touch-icon.png` from `public/favicon.svg`, plus 192/512 px PWA icons and a manifest.
- Menu: settings screen, save thumbnails, rename saves, more varied random cars.
