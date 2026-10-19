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
2. **Wheels**: every wheel is its **own body** with a cylinder collider (axis from the wheel's orientation, see
   `axleOf`) spinning on a `RevoluteImpulseJoint`. The hinge is carried by a light **hub** body (no collider,
   `SUSPENSION.hubMass` and a large `hubInertia`: the wheel motor is acceleration based, so it acts on the reduced inertia of hub and wheel and would be too weak to steer with a tiny hub) that hangs from the chassis by a vertical **spring**:
   `chassis -prismatic spring- hub -revolute- wheel`. The wheel and hub bodies start un-rotated so the joint axes
   are identical in both local frames.
   - **Large wheel** (`bigWheel`): the same chain with the cylinder scaled by `WHEEL_SIZES.bigWheel.scale` (2, radius 1.3 /
     width 0.8) and the spring travel scaled too. The joint anchor and the body start at `partCentre` (the middle of its
     2 × 2 cells); the whole creation spawns raised by the largest `lift` needed so no wheel starts in the floor. Its
     engine is weaker (`torque` 0.6, the wheel is ~32× the inertia) and eased off in a straight line (`cruise` 0.2: a
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
     0.16 with 2 extra layers on the 2 × 3 base. An acceleration-based engine was tried first and did
     not work: it acts on the reduced mass of hub + wheel, far lighter than the chassis.
3. **Scenery**: a large fixed floor plus fixed ramps and obstacles (far from the build area, present during Play and in the
   main menu). They are **parts of the catalog** (`SCENERY_PARTS`: a two-storey ramp of slopes and beams, a kicker with a table top,
   a low wall of beams, tall pillars to weave between and a row of whoops), put on one fixed body with the same colliders as a
   placed part (`PhysicsWorld.addStructuralColliders`, a convex hull for a slope) and drawn with `createPartObject`, so they look
   like the blocks the player builds with and, being fixed, never slide away. To change them edit `constants/scenery.ts`.

All bodies have `canSleep = false` so engines keep working.

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

- **Flying** (`FLIGHT`, `PhysicsWorld.pilot` / `airborne` / `fly` / `touchingGround` / `buildFlight`, `VehicleController.pilot`): the bodies that carry wheels or thrusters form the `craft`. Every step `airborne` is true when none of the colliders of those bodies and of their wheels has a contact (a manifold with contacts, `world.contactPair`) with a collider of the ground group. While airborne the pilot's input changes the angular velocity directly each simulation step: around the body's right axis for pitch (W nose down), its nose for roll (D banks right) and its up for yaw (E turns right), `FLIGHT.rate` rad/s² times an authority that grows with speed from `minAuthority` to 1 at `authoritySpeed`, capped at `maxRate`; without input the rotation fades at `damping`. The nose of a body (`buildFlight`) is the sum of the directions of its thrusters that push sideways (`|y| < 0.5`), else of its engines' fronts, else the way the wheels roll (-z for X axles), all in the body's frame. The heading hold below is off while airborne.
- **Straightening assist and air drag** (`VEHICLE.straighteningGain` / `straighteningMaxRate` / `uprightMin`, `VEHICLE.airDrag`, `PhysicsWorld.straighten` / `drag`, `PhysicsWorld.steering` from `VehicleController.steering`): even a perfectly symmetric car veers a little (a few degrees over a hundred metres; thrusters make it show, because they take the car to 20-30 m/s, and the wheels' spin inertia and the contact solver do the rest), so while the player is not steering an upright vehicle holds the heading it had when the steering ended: before every simulation step the yaw rate of each body that carries wheels is set to `-gain * heading error`. A turn faster than `straighteningMaxRate`, a vehicle that is flipped or on its side, and steering (A / D) switch it off (and the heading is taken again when it calms down). The air drag (an impulse `airDrag * m * (speed - dragFreeSpeed)^2 * dt` against the velocity of those bodies, only above `dragFreeSpeed` = 10 m/s, so engine cars are not affected) gives a thruster car a top speed instead of accelerating forever. Measured on a symmetric 2 x 2 car with two rear thrusters for 6.7 s: without the assist it ended 9.7 m to the side (8° turned) after 128 m, with it 0.9 m (0°).
- **Rotors** (`Part.speed`, `ROTOR`, `PhysicsWorld.buildRotors` / `driveRotors`, `VehicleController.rotating` toggled by `F`): the base is a compact collider (`ROTOR.mass` blocks) on the body of its block. The head is a cylinder collider (`ROTOR_VISUAL.headRadius`, a plate thick) on the body of the structural parts that engage its studs (`studsEngaged` treats the head as a plate whose studs point along the rotor's `face`; `Grid.linkedParts` ignores it, so those parts are a separate component from the block's), or on a small body of its own when nothing is on it. A `RevoluteImpulseJoint` along the face joins the block's body to that one, anchored at the centre of the head, with the contacts between the two off (`setContactsEnabled(false)`). Its motor drives the target speed `-speed / ROTOR.max * ROTOR.maxSpeed` (positive is clockwise seen from the head, the other way round about the outward axis) with an acceleration-based `ROTOR.strength` while the rotors are on, else `ROTOR.idleDamping` (it coasts). If the head's parts are welded to the block's too they are one body and no joint is made. Two stacks on the same head are joined by a fixed joint.
- **Pistons** (`Part.stroke`, `PISTON`, `PhysicsWorld.buildHeaded` / `drivePistons` / `syncPistons`, `VehicleController.extended` toggled by `G`): built like the rotor (a base collider on the block's body, the head on the body of the parts engaged with its studs, contacts between the two off) but joined by a `PrismaticImpulseJoint` along the face with limits `[0, stroke]` (`strokeLength`, steps of `PISTON.strokeStep` cells). While `extended` the target of its spring moves towards the stroke, else towards 0, at `PISTON.speed` cells/s, and an acceleration-based position motor (`PISTON.stiffness`, `PISTON.damping`) holds the head there whatever it carries. The rod is a mesh on the block's visual scaled each frame to the distance the head is from the mouth of the barrel (measured in the world, `syncPistons`).
- **Thrusters** (`Part.power` as thrust, `THRUSTER`, `PhysicsWorld.thrusters`): a thruster adds a compact collider (`THRUSTER.mass` blocks) to its host body and records where it is (in the body's frame), its direction (`frontOf`) and its force (`THRUSTER.thrust * power / ENGINE.default`). Every `PhysicsWorld.step` (`applyThrust`) resets the forces of those bodies and, while the thrust key is held (`PhysicsWorld.thrusting`, from `VehicleController.thrusting`: Space, the same flag as the brake's), adds each thruster's force at its point with `addForceAtPoint`, the direction and the point turned by the body's rotation: so it pushes on the ground or in the air, with or without wheels or an engine, and one away from the centre of mass turns the body. The thrusts of a body's thrusters add up. The flame (`PlayEffects.fireThruster`) follows the same flag.
- **Turbos** (`Part.power` as boost, `TURBO`, `WheelDrive.boost`): a turbo adds a compact collider (`TURBO.mass` blocks) to its host body. The boosts of a body's turbos are summed (in units of one default turbo, capped at `TURBO.maxBoost`) and every wheel of that body gets it. While `Shift` is held (`VehicleController`, `ShiftLeft` / `ShiftRight` in `KEY_MAP`, or `setAutopilot({ boost })`) a driven wheel's target speed is multiplied by `1 + speedGain * boost` and its motor strength by `1 + torqueGain * boost`; a wheel that is not driven (no engine push, or braking) is not boosted. `PhysicsWorld.boosting` (from `VehicleController.boosting`) makes the turbos fire their flame (`PlayEffects.fireTurbo`, `FX.flame`).
- **Brakes** (`Part.brake`, `BRAKE`, `VEHICLE.brakeStrength`, `WheelDrive.brake`): each wheel has its own brake strength over `BRAKE.default` (0 with no brake). While `Space` is held (`VehicleController`, `Space` in `KEY_MAP`, or `setAutopilot({ brake })`) a wheel with a brake is held at velocity 0 with strength `idleBrake + brakeStrength * brake`, driven or not, and the throttle does not apply to it; wheels without a brake ignore `Space`.
- **Engines** (`Part.power`, its orientation (`frontOf`), `ENGINE`, `PhysicsWorld.wheels[].engines`): an engine is mounted on a block and adds a compact collider
  (`ENGINE_BODY`, density so that it weighs `ENGINE.mass` blocks) and its visual to that block's rigid body. When the game needs engines
  (`Grid.engineDrive`, true for saves made since the engine exists; old saves leave it false and every wheel is driven) a wheel is
  powered only by the engines of its host body. Each engine pushes towards its front (`frontOf`); its signed push is
  `power / ENGINE.default * (front · forward)`, summed over the body's engines. The sign multiplies the wheel's roll sign (a
  engine turned around reverses W / S) and a zero push (no engine, or facing sideways / up, or two opposite engines) leaves the wheel
  free-rolling. The strength of each wheel is scaled by `min(ENGINE.maxShare, |push| * ENGINE.wheelsPerEngine / wheels on the body)`,
  so one default engine drives 4 wheels at full torque and the power is shared among more. `VehicleController.poweredWheels` lets the HUD warn when nothing is driven.
  **Where the engine is mounted matters** (`ENGINE.leverage`, `PhysicsWorld.applyEngines`): while the vehicle is driven on the ground (not airborne) every engine whose front is along the travel line adds a torque `r × F` to its body, with `r` from the body's centre of mass to the engine and `F = front * leverage * body mass * power / default * throttle` (`VehicleController.throttle`, signed). The wheels still drive the vehicle; this only adds the lever: a high engine pitches the nose down when accelerating (and up when reversing), one far to a side pulls the vehicle that way, a low central one does almost nothing. The torque is cleared every step together with the thrusters' forces.
- **Forward direction** is perpendicular to the axles of the majority of wheels (`-Z` for X-axle wheels,
  `+X` for Z-axle wheels). Wheels not parallel to that axle are left free-rolling.
- **Roll sign** per wheel is `sign((axle × up) · forward)`, so `W` rolls every wheel forward regardless
  of which side it is on.
- **Side** per wheel is its position relative to the average wheel position, projected on `forward × up`.
- **Cruise**: the motor strength is scaled by the wheel's `cruise` factor (`WHEEL_SIZES`: 0.3 for the normal wheel, 0.2 for the large one) when driving straight and goes up to the full value with the steering input. Steering needs the full strength to skid the car round; the same strength in a straight line makes short, light cars do a wheelie (the 2 × 2 car, wheelbase 1 cell, still pitches ~19° at full throttle).
- **Engine**: `target = rollSign * (throttle - steer * side * STEER_GAIN) * MAX_WHEEL_SPEED`, applied with
  `configureMotorVelocity(target, MOTOR_STRENGTH)`. Steering is differential: on `D` the right wheels
  slow down or reverse while the left wheels speed up.
- `setAutopilot({ throttle, steer })` overrides the keyboard; the main menu uses it with
  `{ keyboard: false }` so the background car does not react to keys.
- **Tires**: each wheel's tire (`Part.tire`, 0-100, see `TIRE` in `physics.ts`) sets its collider friction and scales its
  motor: top speed (`speed` × `VEHICLE.maxWheelSpeed`) and strength (`torque` × `VEHICLE.motorStrength`), interpolated
  linearly between three points: 0 (speed) friction 1.4 / ×1.35 / ×1, 50 (standard, default) 2.5 / ×1 / ×1, 100 (traction)
  4 / ×0.75 / ×3. A grippier tire needs a stronger engine, otherwise the car cannot skid-steer (hence torque ×3). Measured
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
| `TIRE` | 0-100, 3 points | Friction (combine: max), top-speed and engine-strength multipliers along the tire slider (speed / standard / traction) |
| `CHASSIS.friction` | 0.6 | Chassis friction |
| `WHEEL_SIZES` | wheel / bigWheel | Scale, angular speed, motor torque and straight-line (`cruise`) torque of each wheel size |
| `SUSPENSION.*` | see file | Suspension strength range / default, stiffness range, damping ratio, travel, hub mass |
| `WORLD.gravity` | -15 | World gravity |
| `WORLD.step` / `WORLD.maxFrameTime` | 1/60 s / 0.1 s | Fixed step and frame-time clamp |
| `SPAWN_LIFT` | 0.2 | Spawn height so wheels start above the floor |
| `SCENERY_PARTS` (`constants/scenery.ts`) | list of `Part` | Ramps and obstacles of Play mode and the menu, built from catalog parts (slopes, beams, pillars) |
