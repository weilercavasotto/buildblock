# Roadmap and known limitations

## Known limitations

- Wheels can only be mounted on the **side** faces of blocks; the car steers by differential drive (no steering axle).
- Only the wheels parallel to the majority axle are driven; every driven wheel gets the same torque.
- Wheels, engines, turbos, thrusters, rotors and pistons are mounted on blocks (not on plates or brackets); no joint can bend to an angle yet (hinge) and nothing is aerodynamic (no lift).
- No export/import of saves and no rename of existing saves; the undo history is per session (not saved).
- Blocks have no joints that can break; a structure never falls apart.
- Scenery in Play mode is fixed (ramps, a kicker, walls, pillars and whoops built from catalog parts: `SCENERY_PARTS`). Every part of a creation is a body that can be pushed: there is no part fixed to the ground.
- Controls are fixed WASD/arrows; there is no per-wheel key configuration.

## Ideas

- More parts: slopes, thrusters, hinges, suspension, steering wheels.
- Per-wheel key bindings (Besiege-style) and a steerable/non-driven wheel flag.
- Copy/paste and save slots (export/import JSON); undo/redo that also survives reloading a save.
- Painting for other tools (e.g. a row of wheels) and an erase-by-dragging mode.
- An asymmetric part (slope / wedge, thruster) where the new rotation (A / D) is visible and matters physically; rotating an already placed part.
- More parts for the catalog (slopes, thrusters, hinges, suspension...) in new categories; block colours and materials.
- Catalog search, favourites and a hotbar per save (it is per browser now).
- Frame-limit setting in an options menu (30/60/uncapped).
- Day/night cycle and weather using the sky shader (sun position, cloud colour/coverage over time).
- Breakable connections and damage.
- Larger maps, terrain editor and objectives.
- Automated tests for `Grid`, `save.ts` and the physics setup.
- Script to regenerate `favicon.ico` / `apple-touch-icon.png` from `public/favicon.svg`, plus 192/512 px PWA icons and a manifest.
- Menu: settings screen, save thumbnails, rename saves.

## Planned parts

Chosen from the brainstorm (the numbers are the ones of that list); **not started**. The order below is a suggestion: the simple ones first, then the ones that share a base, the one that touches the physics most last.

### Mobility (7 of 9)

| # | Part | Effort | Notes |
|---|---|---|---|
| 1 | **Hinge with servo** | medium | Turns to an angle and stops (a key toggles it, or an angle in the inspector). Reuses the head with studs and the joint of the rotor. |
| 3 | **Propeller and wings with lift** | large | The propeller pushes the air by its rotation; the thin wedge plates become wings with lift that grows with speed (aeroplanes, helicopters). The part that touches the physics most. |
| 4 | **Spring / damper** | medium | An elastic part between two bodies, like the wheels' suspension but placed anywhere. |
| 5 | **Parachute and air brake** | low | A key opens it and it slows the fall or the speed (a force against the velocity). |
| 6 | **Detachable stage** | medium | An explosive bolt that drops a part of the body on a key (two-stage rockets). |
| 8 | **Wheels of other sizes** | low | A small wheel (toy car) and a medium one. |
| 9 | **Skids / skis** | low | Low-friction parts for sliding. |

Left out for now: 2 (real steering: an axle that steers the front wheels) and 7 (tank tracks).

### Blocks and building parts (8 of 9)

| # | Part | Effort | Notes |
|---|---|---|---|
| 2 | **Glass and windscreen** | low | Translucent blocks and wedges. |
| 3 | **Headlights and lamps** | low to medium | A part that glows (and lights up, if there is ever a night). |
| 4 | **Round parts** | medium | Round bricks and plates (1x1 and 2x2), cones and domes; they need shapes that are not boxes in the stud engagement. |
| 5 | **Tiles** | low | Smooth plates without studs. |
| 6 | **Corner and inverted slopes** | medium | Complete the wedge family. |
| 7 | **Arches and plates with a hole** | medium | For bridges, and for a real "axle". |
| 8 | **Seat and driver** | medium | A figure that sits in the car, with an optional first-person camera (needs a change in the Play camera). |
| 9 | **Ballast block** | low | Very dense, to balance vehicles. |

Left out for now: 1 (an anchor block fixed to the ground).

### Suggested order

1. Ballast, tiles, glass and headlights (no physics change).
2. Wheels of other sizes, skids and the parachute.
3. Hinge, then the spring and the detachable stage (same base: a body joined to a block by a joint).
4. Seat and driver.
5. Round parts, corner slopes, arches and plates with a hole (shapes that are not boxes).
6. Propeller and wings with lift.

Every new part follows [adding-a-part.md](adding-a-part.md) (and the rules of `AGENTS.md`: tokens in `constants/`, `help-content.ts`, `PLAY_CONTROLS` when it has a key, a sound recipe if it should make one).
