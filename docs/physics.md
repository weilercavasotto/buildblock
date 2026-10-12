# Physics (Play mode)

`PhysicsWorld` (`src/play/physics-world.ts`) builds a fresh Rapier world from a snapshot of the grid
every time Play starts (and on `R`).

## From grid to bodies

1. **Chassis**: blocks are flood-filled over 6-neighbour adjacency. Each connected component becomes
   **one dynamic rigid body** with one `cuboid(0.5, 0.5, 0.5)` collider per block. A single body keeps
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
     exponentially to a stiffness in 1/s² (`suspensionStiffness`, `minStiffness`…`maxStiffness`); the spring
     constant is that stiffness times the mass the wheel supports (`chassis.mass() / wheels on that body`), so a
     given strength sags about `gravity / stiffness` cells whatever the size of the build. Damping is
     `2 · dampingRatio · √stiffness` (times the same mass). An acceleration-based motor was tried first and did
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
- **Motor**: `target = rollSign * (throttle - steer * side * STEER_GAIN) * MAX_WHEEL_SPEED`, applied with
  `configureMotorVelocity(target, MOTOR_STRENGTH)`. Steering is differential: on `D` the right wheels
  slow down or reverse while the left wheels speed up.
- `setAutopilot({ throttle, steer })` overrides the keyboard; the main menu uses it with
  `{ keyboard: false }` so the background car does not react to keys.
- **Tires**: each wheel's tire type (`Part.tire`, see `TIRES` in `physics.ts`) sets its collider friction and scales its
  motor: top speed (`speed` × `VEHICLE.maxWheelSpeed`) and strength (`torque` × `VEHICLE.motorStrength`). A grippier tire needs a
  stronger motor, otherwise the car cannot skid-steer (the traction tire has torque ×3 for that reason). Standard 2.5 / ×1 /
  ×1, Speed 1.4 / ×1.35 / ×1, Traction 4 / ×0.75 / ×3.
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
| `TIRES` | 3 types | Friction (combine: max), top-speed and motor-strength multipliers of each tire type |
| `CHASSIS.friction` | 0.6 | Chassis friction |
| `WHEEL_SIZES` | wheel / bigWheel | Scale, angular speed, motor torque and straight-line (`cruise`) torque of each wheel size |
| `SUSPENSION.*` | see file | Suspension strength range / default, stiffness range, damping ratio, travel, hub mass |
| `WORLD.gravity` | -15 | World gravity |
| `WORLD.step` / `WORLD.maxFrameTime` | 1/60 s / 0.1 s | Fixed step and frame-time clamp |
| `SPAWN_LIFT` | 0.2 | Spawn height so wheels start above the floor |
| `SCENERY` | list | Ramps and obstacles of Play mode |
