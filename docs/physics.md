# Physics (Play mode)

`PhysicsWorld` (`src/play/physics-world.ts`) builds a fresh Rapier world from a snapshot of the grid
every time Play starts (and on `R`).

## From grid to bodies

1. **Chassis**: blocks are flood-filled over 6-neighbour adjacency. Each connected component becomes
   **one dynamic rigid body** with one `cuboid(0.5, 0.5, 0.5)` collider per block. A single body keeps
   structures stiff; joints between individual cubes would make them wobble.
2. **Wheels**: every wheel is its **own body** with a cylinder collider (axis rotated to the wheel's `face`)
   connected to the chassis body by a `RevoluteImpulseJoint` whose axis is the wheel's `face`.
   The wheel body starts un-rotated so the joint axis is identical in both local frames.
3. **Scenery**: a large fixed floor plus a few fixed ramps/obstacles (far from the build area, only
   present during Play).

All bodies have `canSleep = false` so motors keep working.

## Collision groups

| Group | Collides with |
|---|---|
| `GROUND` | everything |
| `CHASSIS` | `GROUND`, `CHASSIS` |
| `WHEEL` | `GROUND` only |

Wheels have a radius (0.65) larger than half a cell, so they overlap neighbouring cells. Letting them
ignore chassis blocks and other wheels avoids spurious collisions. The larger radius also lifts the
chassis above the ground. Bodies spawn raised by `SPAWN_LIFT` (0.2) so wheels do not start inside the floor.

## Stepping

`step(dt)` accumulates real time (clamped to 0.1 s) and advances Rapier in fixed `1/60 s` steps, then
copies each body's translation/rotation to its mesh. Gravity is `-15`.

## Vehicle control

`VehicleController` (`src/play/vehicle-controller.ts`):

- **Forward direction** is perpendicular to the axles of the majority of wheels (`-Z` for X-axle wheels,
  `+X` for Z-axle wheels). Wheels not parallel to that axle are left free-rolling.
- **Roll sign** per wheel is `sign((axle × up) · forward)`, so `W` rolls every wheel forward regardless
  of which side it is on.
- **Side** per wheel is its position relative to the average wheel position, projected on `forward × up`.
- **Motor**: `target = rollSign * (throttle - steer * side * STEER_GAIN) * MAX_WHEEL_SPEED`, applied with
  `configureMotorVelocity(target, MOTOR_STRENGTH)`. Steering is differential: on `D` the right wheels
  slow down or reverse while the left wheels speed up.
- `setAutopilot({ throttle, steer })` overrides the keyboard; the main menu uses it with
  `{ keyboard: false }` so the background car does not react to keys.
- With no keys pressed, wheels hold velocity 0 with a light damping (`IDLE_BRAKE`).

## Tuning constants

| Constant | File | Value | Effect |
|---|---|---|---|
| `MAX_WHEEL_SPEED` | `vehicle-controller.ts` | 14 rad/s | Top speed |
| `MOTOR_STRENGTH` | `vehicle-controller.ts` | 60 | How hard the motor tracks the target |
| `IDLE_BRAKE` | `vehicle-controller.ts` | 12 | How quickly the car stops with no input |
| `STEER_GAIN` | `vehicle-controller.ts` | 0.7 | Steering sharpness |
| `WHEEL_RADIUS` / `WHEEL_WIDTH` | `part-defs.ts` | 0.65 / 0.4 | Wheel size (visual and collider) |
| gravity | `physics-world.ts` | -15 | World gravity |
| wheel friction | `physics-world.ts` | 2.5 (combine: max) | Grip |
