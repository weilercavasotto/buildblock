# Adding a new part

Example: a new part type `'thruster'`.

1. **Type** — add it to `PartType` in `src/types.ts` (and any extra fields to `Part`).
2. **Visual** — in `src/parts/part-defs.ts` add geometry/material (colours, sizes and roughness go in `src/constants/`) and a branch in `createPartObject`
   (support the `ghost` argument so the preview works; add `raycast = () => {}` to decorative lines).
3. **Placement rules** — extend `Grid.canPlace` in `src/build/grid.ts`, and `Grid.remove` if the part
   depends on another part (as wheels depend on their block).
4. **Build mode** — extend `BuildMode.target` in `src/build/build-mode.ts` to say where the part goes
   for a given pick.
5. **HUD** — add a button to `index.html` (style it in `src/styles/main.css` with tokens), register it in
   `src/ui/hud.ts` (`toolButtons`) and add a key binding in `src/main.ts`. Keep the text in English.
6. **Physics** — in `PhysicsWorld.buildCreation` create its collider/body/joint and push a `SyncPair`
   so the mesh follows. Pick its collision group (see [physics.md](physics.md)).
7. **Control** — if it should react to input, extend `VehicleController` or add a sibling controller.
8. **Persistence** — nothing to do: parts are saved as plain JSON. If you change the shape of `Part`
   incompatibly, bump `STORAGE_KEY` in `src/save.ts`.
9. **Docs** — update [architecture.md](architecture.md) and [getting-started.md](getting-started.md).
