# Physics (Play mode)

`PhysicsWorld` (`src/play/physics-world.ts`) builds a fresh Rapier world from a snapshot of the grid
every time Play starts (and on `R`).

## From grid to bodies

1. **Chassis**: blocks and plates are flood-filled over stud links (`Grid.linkedParts`: one rests on the other with at least one
   stud engaged; neighbours that only touch by the side are NOT linked). Each connected component becomes
   **one dynamic rigid body** with one cuboid collider per box of each part (a block is one cube, a plate a slab, an L bracket two slabs), whose density is
   `CHASSIS.density × weightMass(weight)` (the block's `Part.weight`, 1-16, default 4 = ×1: the body's mass is the sum of
   weight / 4 over its blocks). A single body keeps
   structures stiff; joints between individual cubes would make them wobble.
2. **Wheels**: every wheel is its **own body** with a cylinder collider (axis from the wheel's `rotation`, see
   `wheelAxle`) spinning on a `RevoluteImpulseJoint`. The hinge is carried by a light **hub** body (no collider,
   `SUSPENSION.hubMass` and a large `hubInertia`: the wheel motor is acceleration based, so it acts on the reduced inertia of hub and wheel and would be too weak to steer with a tiny hub) that hangs from the chassis by a vertical **spring**:
   `chassis -prismatic spring- hub -revolute- wheel`. The wheel and hub bodies start un-rotated so the joint axes
   are identical in both local frames.
   - **Large wheel** (`bigWheel`): the same chain with the cylinder scaled by `WHEEL_SIZES.bigWheel.scale` (2, radius 1.3 /
     width 0.8) and the spring travel scaled too. The joint anchor and the body start at `partCentre` (the middle of its
     2 × 2 cells); the whole creation spawns raised by the largest `lift` needed so no wheel starts in the floor. Its
     motor is weaker (`torque` 0.6, the wheel is ~32× the inertia) and eased off in a straight line (`cruise` 0.2: a
     wheelie otherwise), while steering gets the full strength, blended with the steering input. Top speed
     (`speed` 0.75 of angular speed) is still higher because the wheel is bigger.
   - **Suspension**: the spring is a `PrismaticImpulseJoint` along the world up axis, limited to
     `SUSPENSION.travelDown` / `travelUp`, with a position motor aiming at the rest position
     (`configureMotorPosition`, `MotorModel.ForceBased`). The player sets the **strength** (0-100, `Part.suspension`,
     default `SUSPENSION.defaultStrength` = 50) of each wheel in the part inspector. The strength maps
     exponentially to a stiffness in 1/s² (`suspensionStiffness`, `minStiffness`…`maxStiffness`); the spring constant is
     that stiffness times a fixed `SUSPENSION.referenceLoad` (the mass a wheel carries in a 6-block, 4-wheel car), so it
     does **not** depend on the build: **the more mass a wheel carries, the more its spring is compressed**
     (`sag ≈ load · gravity / springConstant`), until the travel or the ground stops it (the body can scrape the floor
     when overloaded: ground clearance is 0.15 cells with normal wheels). Damping follows the actual load,
     `2 · dampingRatio · √(springConstant · load)`, so a heavy body is not left bouncing. `load` is
     `chassis.mass() / wheels on that body`. The spring's rest position holds the wheel `SUSPENSION.rideHeight` (0.15 cells, scaled for big wheels) below its mount, so
     the body rides higher (the wheel alone leaves only 0.15 cells under the blocks) and has room to sink before it reaches the
     floor. Measured ground clearance of the blocks at rest, strength 50: 0.27 (2 × 2 base, 4 blocks), 0.26 (2 × 3 base) and
     0.16 with 2 extra layers on the 2 × 3 base. An acceleration-based motor was tried first and did
     not work: it acts on the reduced mass of hub + wheel, far lighter than the chassis.
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
- **Cruise**: the motor strength is scaled by the wheel's `cruise` factor (`WHEEL_SIZES`: 0.3 for the normal wheel, 0.2 for the large one) when driving straight and goes up to the full value with the steering input. Steering needs the full strength to skid the car round; the same strength in a straight line makes short, light cars do a wheelie (the 2 × 2 car, wheelbase 1 cell, still pitches ~19° at full throttle).
- **Motor**: `target = rollSign * (throttle - steer * side * STEER_GAIN) * MAX_WHEEL_SPEED`, applied with
  `configureMotorVelocity(target, MOTOR_STRENGTH)`. Steering is differential: on `D` the right wheels
  slow down or reverse while the left wheels speed up.
- `setAutopilot({ throttle, steer })` overrides the keyboard; the main menu uses it with
  `{ keyboard: false }` so the background car does not react to keys.
- **Tires**: each wheel's tire (`Part.tire`, 0-100, see `TIRE` in `physics.ts`) sets its collider friction and scales its
  motor: top speed (`speed` × `VEHICLE.maxWheelSpeed`) and strength (`torque` × `VEHICLE.motorStrength`), interpolated
  linearly between three points: 0 (speed) friction 1.4 / ×1.35 / ×1, 50 (standard, default) 2.5 / ×1 / ×1, 100 (traction)
  4 / ×0.75 / ×3. A grippier tire needs a stronger motor, otherwise the car cannot skid-steer (hence torque ×3). Measured
  on a 2 × 3 car, straight-line speed after 1.5 s goes 11.2 → 9.8 → 8.5 → 7.9 → 6.8 m/s at tire 0 / 25 / 50 / 75 / 100 and
  it turns at every point (−3.8 to −2.2 rad).
- With no keys pressed, wheels hold velocity 0 with a light damping (`VEHICLE.idleBrake`).

## Tuning constants

All tunables are in [`src/constants/physics.ts`](../src/constants/physics.ts) (see [constants.md](constants.md)).

| Constant | Value | Effect |
|---|---|---|
| `VEHICLE.maxWheelSpeed` | 14 rad/s | Top speed |
| `VEHICLE.motorStrength` | 60 | How hard the motor tracks the target |
| `VEHICLE.idleBrake` | 12 | How quickly the car stops with no input |
| `VEHICLE.steerGain` | 0.7 | Steering sharpness |
| `WHEEL.radius` / `WHEEL.width` | 0.65 / 0.4 | Wheel size (visual and collider) |
| `TIRE` | 0-100, 3 points | Friction (combine: max), top-speed and motor-strength multipliers along the tire slider (speed / standard / traction) |
| `CHASSIS.friction` | 0.6 | Chassis friction |
| `WHEEL_SIZES` | wheel / bigWheel | Scale, angular speed, motor torque and straight-line (`cruise`) torque of each wheel size |
| `SUSPENSION.*` | see file | Suspension strength range / default, stiffness range, damping ratio, travel, hub mass |
| `WORLD.gravity` | -15 | World gravity |
| `WORLD.step` / `WORLD.maxFrameTime` | 1/60 s / 0.1 s | Fixed step and frame-time clamp |
| `SPAWN_LIFT` | 0.2 | Spawn height so wheels start above the floor |
| `SCENERY` | list | Ramps and obstacles of Play mode |
