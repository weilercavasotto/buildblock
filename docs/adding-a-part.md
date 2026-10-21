# Adding a new part

Example: a new part type `'thruster'`.

1. **Type** — add it to `PartType` in `src/types.ts` (and any extra fields to `Part`).
2. **Visual** — in `src/parts/part-defs.ts` add geometry/material (colours, sizes and roughness go in `src/constants/`) and a branch in `createPartObject`
   (support the `ghost` argument so the preview works; add `raycast = () => {}` to decorative lines).
3. **Placement rules** — extend `Grid.canPlace` in `src/build/grid.ts`, and `Grid.remove` if the part
   depends on another part (as wheels depend on their block).
4. **Build mode** — extend `BuildMode.target` in `src/build/build-mode.ts` to say where the part goes
   for a given pick.
5. **Rotation** — every part is oriented the same way (`Part.studs` + `Part.spin`, see architecture.md): set `rotatable` in its `PART_INFO` entry (`false` if its orientation must not be chosen by the player), build its visual in its own frame (`createPartObject` turns the root by the orientation), say in `symmetryOf` (`parts/orientation.ts`) which turns look the same, and read the orientation in its physics (like `axleOf` / `frontOf`).
6. **Catalog and hotbar** — add its entry to `PART_INFO` (and `PART_ORDER`) in `src/constants/part-catalog.ts`: name,
   category (add one to `PART_CATEGORIES` if needed), description, properties, tips (every preview uses the same resting angle, `PREVIEW.angle`). It then appears
   in the catalog with a 3D preview (built from `createPartObject`) and can be dragged onto the hotbar; nothing else
   to register. Keep the text in English.
7. **Physics** — in `PhysicsWorld.buildCreation` create its collider/body/joint and push a `SyncPair`
   so the mesh follows. Pick its collision group (see [physics.md](physics.md)).
8. **Control** — if it should react to input it takes a **player-assigned key** (no part has a default one): add its actions to `PART_ACTIONS` (id, label, hold or toggle, required) in `src/constants/part-keys.ts` and ask `PhysicsWorld.isOn(part, action)` (= `VehicleController.isOn`) whether each runs; `Grid.sanitize` keeps the keys, and the inspector, the bell and the Controls panel pick the part up from `isKeyed`. Nothing has a fixed key (only legacy games without engines keep W / S / A / D).
9. **Persistence** — nothing to do: parts are saved as plain JSON. If you change the shape of `Part`
   incompatibly, bump `STORAGE_KEY` in `src/save.ts`.
10. **Confirmations** — for destructive actions use `confirmDialog` from `src/ui/confirm-dialog.ts` (strings in `TEXT`),
   never `window.confirm`.
11. **Docs** — update [architecture.md](architecture.md) and [getting-started.md](getting-started.md).

## Parts that connect with studs

**Naming:** structural parts are called `<studs wide>x<studs long> <Kind>` (e.g. `2x2 Block`, `1x2 Plate`, `4x4 L bracket`: the studs on the top face, narrow side first, no height, except that the same footprint with another height is called `Low` (three plates, 0.6) or `Tall` (two cells) between the size and the kind: `2x2 Low Block`, `2x2 Tall Block`; an L bracket counts its flat plate); other parts keep a plain name. Use the same pattern for any new size, in `PART_INFO`, the help and the docs. Internal `PartType` keys stay as they are (`blockHalf`, …) because saves use them.

Structural parts (`isStructural`: `STRUCTURAL_TYPES` in `types.ts`: blocks, plates and L brackets in several sizes) weld through studs and are described by one entry of `SHAPES` (`constants/part-shapes.ts`): a list of boxes (size, offset from the first, "anchor" box, and the direction of each box's studs) and `spins` (how many quarter turns around the studs look different: 1 square, 2 rectangle, 4 L). A new size needs only a `StructuralType`, its `SHAPES` and `PART_INFO` entries (the `structural()` helper in `part-catalog.ts`) and a place in `PART_ORDER`; geometry (`partBoxes`), visuals (`createPartObject`), physics colliders and placement (`BuildMode.structuralTarget`) follow from the shape. Keep box sizes multiples of `STUD.pitch` (thin plates aside) so edges stay on the stud lattice. A part that hangs off a host (wheels) uses `face` instead.

## Parts that occupy several cells

The large wheel is the example (2 × 2 cells). `partCells(part)` (in `src/types.ts`) lists the cells a part occupies and
`partCentre(part)` where it is centred; the `Grid` indexes every occupied cell, so `get`, `canPlace` and `remove` work with any of
them, and every visual / physics position uses `partCentre`, not `cell`. A new multi-cell part needs a branch in both helpers.

## Painting

Set `paintable` in `PART_INFO`. Only paintable parts can be painted, and only in paint mode (never in the catalog); `createPartObject` must honour `part.color` for them.
