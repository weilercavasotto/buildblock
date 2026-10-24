# Roadmap and known limitations

## Known limitations

- Wheels can only be mounted on the **side** faces of blocks; the car steers by differential drive (no steering axle).
- Only the wheels parallel to the majority axle are driven; every driven wheel gets the same torque.
- Wheels, engines, turbos, thrusters, rotors, pistons and hinges are mounted on blocks (not on plates or brackets); the hinge swings its head like a lid on a pin along one edge (no free joints that bend in both directions) and only the wings are aerodynamic (no fuselage or tail model, no wind).
- No export/import of saves and no rename of existing saves; the undo history is per session (not saved).
- Blocks have no joints that can break; a structure never falls apart.
- Scenery in Play mode is fixed (ramps, a kicker, walls, pillars and whoops built from catalog parts: `SCENERY_PARTS`). Every part of a creation is a body that can be pushed: there is no part fixed to the ground.
- **Nothing moves without keys the player assigns** (a rule of the game): engines, wheels, rotors, pistons, thrusters and turbos have actions with player-chosen keys, and there are no fixed driving keys.
- **In-air attitude control is the wings' control surfaces**: the old fixed pitch / roll / yaw keys (W / S, A / D, Q / E, removed when the keys became assignable; the code is in git at commit `70596ad`) were replaced by the optional *Pitch*, *Roll* and *Yaw* actions of every wing, which the player gives keys to; each wing moves its surface the way that turns the plane as asked from where it is. There is no autopilot, trim or stability assist: a badly balanced plane tips or stalls.

## Ideas

- **Move everything out of `localStorage` into JSON files**: today the whole persisted state of the game lives in the browser's `localStorage`: the creations (`blocklab.saves.v2`), the settings (`SETTINGS_STORAGE_KEY`), the hotbar layout and selected slot (`STORAGE.hotbarKey`) and the sound mute (`blocklab.sound`). It is tied to one browser and origin, limited to about 5 MB shared by all of it, and lost when the site data is cleared. Replace it with JSON files: one storage layer (read / write by name, with a version field per file) behind `save.ts`, `settings.ts`, `hotbar.ts` and the sound engine, so none of them touches `localStorage` directly. First step: export / import a creation, the whole library and the preferences as `.json` files; then a real save folder in the desktop app (Pake / a file API), with `localStorage` kept only as a cache or fallback in the browser. Keep `sanitize` / `legacyOrientation` as the loader of every creation, migrate the existing keys (`blocklab.saves.v2`, the old `blocklab.v1`, settings, hotbar, sound) on first run, and document the file formats. **Hardening of the files** (no encryption: the data holds nothing secret and a key shipped in the client could be extracted, so it would only get in the way of sharing and debugging; reconsider only if there are ever accounts or an online service, where the answer is HTTPS, server-side authentication and validation, not ciphered local files): treat every imported file as untrusted input and run it through `sanitize` (a limit on the file size and on the number of parts, unknown fields dropped, values clamped); put a `version` and a checksum (hash) in each file to tell the player the file is damaged or was edited by accident (it does not stop a deliberate edit); and keep rendering names with `textContent`, never `innerHTML`. `docs/testing.md` mentions the mute key: update it when this lands.
- More parts: slopes, thrusters, hinges, suspension, steering wheels.
- A steerable / non-driven wheel flag (a wheel with no steering key already goes straight).
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

### Mobility (9 of 9)

| # | Part | Effort | Notes |
|---|---|---|---|
| 1 | ~~**Hinge with servo**~~ | done | Swings open like a lid to an angle (inspector) on a key press and closes on the next. Built on the head with studs and the joint of the rotor / piston. |
| 3 | ~~**Propeller and wings with lift**~~ | done | The **Propeller** (a motor with blades, switched on / off by a key, thrust that fades with air speed) and the **Wings** (left and right swept plates, 4x3 and 8x6: lift and drag from the air at each wing, control surfaces with pitch / roll / yaw keys, helicopter blades on a rotor). See the *Propeller and wings* section of getting-started.md. |
| 4 | ~~**Spring / damper**~~ | done | The **Spring**: a passive headed part like the piston (a coil between a base on a block and a head with studs), force-based so the load decides how far it sinks; Length and Stiffness sliders. See the *Spring* section of getting-started.md. |
| 5 | ~~**Parachute and air brake**~~ | done | The **Parachute**: a pack with a canopy that a key opens or folds; while open it drags its body against its velocity (quadratic in the speed). See the *Parachute and air brake* section of getting-started.md. |
| 6 | ~~**Detachable stage**~~ | done | The **Explosive bolt**: a headed part whose head (and what is on its studs) is fixed to the block until its key fires it, once; a push then sends the two bodies apart (two-stage rockets). See the *Explosive bolt* section of getting-started.md. |
| 8 | ~~**Wheels of other sizes**~~ | done | The **Small wheel** (half the size, a toy-car wheel) and the **Medium wheel** (1.5 times), both one cell; with the normal and the large wheel there are four sizes. See the *Wheels of other sizes* section of getting-started.md. |
| 9 | ~~**Skids / skis**~~ | done | The **Ski**: a flat runner with a curled tip mounted on a side face, with almost no friction (`SKI`), for sleds pushed by thrusters or propellers. See the *The ski* section of getting-started.md. |

Left out for now: 2 (real steering: an axle that steers the front wheels) and 7 (tank tracks).

### Blocks and building parts (8 of 9)

| # | Part | Effort | Notes |
|---|---|---|---|
| 2 | ~~**Glass and windscreen**~~ | done | The **2x2 / 4x4 Glass** panes and the **2x2 / 2x4 Windscreen** glass slopes: plate and slope shapes drawn translucent, paint tints them. See the *Glass and windscreens* section of getting-started.md. |
| 3 | ~~**Headlights and lamps**~~ | done | In the **Lighting** category (with the **Siren**, a flashing red / blue beacon with a wail): the **Headlight**: a lamp mounted on a block face, switched on / off by a key chosen in the inspector; the lens glows and a faint beam shows (a look only, no real light yet). See the *Headlights* section of getting-started.md. |
| 4 | ~~**Round parts**~~ | done (cones and domes left out) | The **2x2 Round Brick**, **2x2 Round Plate** and **4x4 Round Brick**: cylinders in a square box whose studs are the lattice points inside the circle (counted one by one in `studsEngaged`), with a true cylinder collider. See the *Round parts* section of getting-started.md. |
| 5 | ~~**Tiles**~~ | done | Five **tiles** (1x1, 1x2, 2x2, 2x4, 4x4): plates with a smooth top, no studs, sockets underneath; held by the studs below, nothing built on top. See the *Tiles* section of getting-started.md. |
| 6 | **Corner and inverted slopes** | medium | Complete the wedge family. |
| 7 | **Arches and plates with a hole** | medium | For bridges, and for a real "axle". |
| 8 | **Seat and driver** | medium | A figure that sits in the car, with an optional first-person camera (needs a change in the Play camera). |
| 9 | ~~**Ballast block**~~ | done | The **2x2 Ballast**: a block-sized cube, 8 times denser than the default block, no weight slider; lowers or balances a vehicle. See the *Ballast* section of getting-started.md. |

Left out for now: 1 (an anchor block fixed to the ground).

### Suggested order

1. ~~Ballast~~ (done), ~~tiles~~ (done), ~~glass~~ (done) and ~~headlights~~ (done) (no physics change).
2. ~~Wheels of other sizes~~ and ~~skids~~ (done; the parachute is done).
3. ~~The detachable stage~~ (done).
4. Seat and driver.
5. ~~Round parts~~ (done, without cones and domes), corner slopes, arches and plates with a hole (shapes that are not boxes).
6. ~~Propeller and wings with lift~~ (done).

Every new part follows [adding-a-part.md](adding-a-part.md) (and the rules of `AGENTS.md`: tokens in `constants/`, `help-content.ts`, `PART_ACTIONS` when it takes keys, a sound recipe if it should make one).
