# Adding a new part

Example: a new part type `'thruster'`.

1. **Type** — add it to `PartType` in `src/types.ts` (and any extra fields to `Part`).
2. **Visual** — in `src/parts/part-defs.ts` add geometry/material (colours, sizes and roughness go in `src/constants/`) and a branch in `createPartObject`
   (support the `ghost` argument so the preview works; add `raycast = () => {}` to decorative lines).
3. **Placement rules** — extend `Grid.canPlace` in `src/build/grid.ts`, and `Grid.remove` if the part
   depends on another part (as wheels depend on their block).
4. **Build mode** — extend `BuildMode.target` in `src/build/build-mode.ts` to say where the part goes
   for a given pick.
5. **Rotation** — set `rotatable` in its `PART_INFO` entry (`false` if its orientation must not be chosen by the player). `Part.rotation` (clockwise quarter turns) is applied by `createPartObject`; an asymmetric part must
   also use `partRotation(part)` in its physics collider.
6. **Catalog and hotbar** — add its entry to `PART_INFO` (and `PART_ORDER`) in `src/constants/part-catalog.ts`: name,
   category (add one to `PART_CATEGORIES` if needed), description, properties, tips and `previewAngle`. It then appears
   in the catalog with a 3D preview (built from `createPartObject`) and can be dragged onto the hotbar; nothing else
   to register. Keep the text in English.
7. **Physics** — in `PhysicsWorld.buildCreation` create its collider/body/joint and push a `SyncPair`
   so the mesh follows. Pick its collision group (see [physics.md](physics.md)).
8. **Control** — if it should react to input, extend `VehicleController` or add a sibling controller.
9. **Persistence** — nothing to do: parts are saved as plain JSON. If you change the shape of `Part`
   incompatibly, bump `STORAGE_KEY` in `src/save.ts`.
10. **Confirmations** — for destructive actions use `confirmDialog` from `src/ui/confirm-dialog.ts` (strings in `TEXT`),
   never `window.confirm`.
11. **Docs** — update [architecture.md](architecture.md) and [getting-started.md](getting-started.md).

## Parts that connect with studs

Blocks and plates (`isStructural`) weld through studs: give a new one a `partBox` size in `parts/part-geometry.ts`, the visual (studs included via `studsMesh`), and decide how `BuildMode.structuralTarget` places it. A part that hangs off a host (wheels) uses `face` instead.

## Parts that occupy several cells

The large wheel is the example (2 × 2 cells). `partCells(part)` (in `src/types.ts`) lists the cells a part occupies and
`partCentre(part)` where it is centred; the `Grid` indexes every occupied cell, so `get`, `canPlace` and `remove` work with any of
them, and every visual / physics position uses `partCentre`, not `cell`. A new multi-cell part needs a branch in both helpers.

## Painting

Set `paintable` in `PART_INFO`. Only paintable parts can be painted, and only in paint mode (never in the catalog); `createPartObject` must honour `part.color` for them.
