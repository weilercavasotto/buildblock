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
   - **Small and medium wheels** (`smallWheel` 0.5, `mediumWheel` 1.5, `WHEEL_SIZES`): the same chain, scaled like the large wheel but one cell. `wheelDrop` (in `partCentre`) hangs a wheel smaller than the normal one `WHEEL.radius * (1 - scale)` lower in its cell when its axle is horizontal, so its tread is level with the normal wheel's. The motor is acceleration based, so the force at the ground goes with the wheel's inertia over its radius (about `scale`⁴): `torque` is 12 for the small wheel (a light wheel needs far more) and 0.5 for the medium one, tuned so that a 2 x 2 car accelerates and pitches about like with normal wheels.
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

- **Map edges** (`GROUND_COLLIDER.wallHalfThickness` / `wallHeight`, `PhysicsWorld.buildScenery`): four invisible fixed walls along the edges of the ground (same collision group, no friction) so a vehicle cannot drive off the map.

## Stepping

`step(dt)` accumulates real time (clamped to 0.1 s) and advances Rapier in fixed `1/60 s` steps, then
copies each body's translation/rotation to its mesh. Gravity is `-15`.

## Vehicle control

`VehicleController` (`src/play/vehicle-controller.ts`):

- **Straightening assist and air drag** (`VEHICLE.straighteningGain` / `straighteningMaxRate` / `uprightMin`, `VEHICLE.airDrag`, `PhysicsWorld.straighten` / `drag`, `PhysicsWorld.steering` from `VehicleController.steering`): even a perfectly symmetric car veers a little (a few degrees over a hundred metres; thrusters make it show, because they take the car to 20-30 m/s, and the wheels' spin inertia and the contact solver do the rest), so while the player is not steering an upright vehicle holds the heading it had when the steering ended: before every simulation step the yaw rate of each body that carries wheels is set to `-gain * heading error`. A turn faster than `straighteningMaxRate`, a vehicle that is flipped or on its side, and steering (A / D) switch it off (and the heading is taken again when it calms down). The air drag (an impulse `airDrag * m * (speed - dragFreeSpeed)^2 * dt` against the velocity of those bodies, only above `dragFreeSpeed` = 10 m/s, so engine cars are not affected) gives a thruster car a top speed instead of accelerating forever. Measured on a symmetric 2 x 2 car with two rear thrusters for 6.7 s: without the assist it ended 9.7 m to the side (8° turned) after 128 m, with it 0.9 m (0°).
- **Rotors** (`Part.speed`, `ROTOR`, `PhysicsWorld.buildRotors` / `driveRotors`, `PhysicsWorld.isOn(part)` from `VehicleController.isOn`: the rotor's own key toggles it): the base is a compact collider (`ROTOR.mass` blocks) on the body of its block. The head is a cylinder collider (`ROTOR_VISUAL.headRadius`, a plate thick) on the body of the structural parts that engage its studs (`studsEngaged` treats the head as a plate whose studs point along the rotor's `face`; `Grid.linkedParts` ignores it, so those parts are a separate component from the block's), or on a small body of its own when nothing is on it. A `RevoluteImpulseJoint` along the face joins the block's body to that one, anchored at the centre of the head, with the contacts between the two off (`setContactsEnabled(false)`). Its motor drives the target speed `-speed / ROTOR.max * ROTOR.maxSpeed` (positive is clockwise seen from the head, the other way round about the outward axis) with an acceleration-based `ROTOR.strength` while the rotors are on, else `ROTOR.idleDamping` (it coasts). If the head's parts are welded to the block's too they are one body and no joint is made. Two stacks on the same head are joined by a fixed joint.
- **Explosive bolts** (`BOLT`, `PhysicsWorld.bolts`, `fireBolts`, `buildHeaded`): the base is a compact collider (`BOLT.mass` blocks) on the block's body; the head is a slab collider on the body of the parts welded to its studs and a fixed joint (contacts off) holds the two bodies together. When the key switches the bolt on the joint is removed (once, `fired`) and an impulse `reduced mass * BOLT.separation` along the face (rotated by the host's turn) pushes the head's body out and the block's back, so they part at `separation` m/s whatever their masses. A bolt whose head is welded to the block's body by other studs does nothing (one body).
- **Hinges** (`Part.angle`, `HINGE`, `PhysicsWorld.buildHeaded` / `driveHinges`, `hingePivot` in `part-defs.ts`): built like the rotor and the piston (a base collider on the block's body, a flat plate collider on the body of the parts engaged with its head, or a body of its own, joined by a `RevoluteImpulseJoint` with the contacts between the two off). The pivot is on the pin: along the part's local x, at the back edge (`-frontOf`), tangent to the top of the base; the axis is signed (`-axleOf`) so that a positive angle lifts the head's front away from the block. The joint has limits `[0, π]`, an acceleration-based position motor (stiffness `hingeStiffness(part)` = `HINGE.stiffness` scaled by `Part.strength` over the default 5, damping `hingeDamping` = critical, so it does not depend on the load) and a target that moves at `HINGE.speed` rad/s towards the open angle (`HINGE.angleStep` degrees × `Part.angle`) while the hinge's `run` action is on and back to 0 when it is off. `audioState().pistonsMoving` also counts the hinges that are moving (they make the piston's sound).
- **Springs** (`Part.stroke` = rest length, `Part.stiffness`, `SPRING`, `springRate`, `PhysicsWorld.buildHeaded` / `drivePistons`): a piston's machinery (same bodies and `PrismaticImpulseJoint` along the face, entry of `pistons` with a `spring: { rest, damping }`) used passively. The joint limits are `[0, 2 × rest]`; its motor is `MotorModel.ForceBased` (the piston's is acceleration based, to hold any load), with the spring constant `springRate` (`referenceLoad × gravity / restSag` at the default stiffness, doubling every `SPRING.doubling` steps) fixed by the stiffness and never by the load, so `sag ≈ load · gravity / springRate`. The target unfolds from 0 to `rest` at `SPRING.speed` when Play starts; the damping is `2 · dampingRatio · √(springRate · head mass)` (the real mass of the head body, measured at build time). No key, no sound (`pistonsMoving` skips springs). The coil (`createSpringCoil`, a helix) is scaled along the axis each frame by `syncPistons`, like the piston's rod.
- **Pistons** (`Part.stroke`, `PISTON`, `PhysicsWorld.buildHeaded` / `drivePistons` / `syncPistons`, `PhysicsWorld.isOn(part)`: the piston's own key toggles it): built like the rotor (a base collider on the block's body, the head on the body of the parts engaged with its studs, contacts between the two off) but joined by a `PrismaticImpulseJoint` along the face with limits `[0, stroke]` (`strokeLength`, steps of `PISTON.strokeStep` cells). While `extended` the target of its spring moves towards the stroke, else towards 0, at `PISTON.speed` cells/s, and an acceleration-based position motor (`PISTON.stiffness`, `PISTON.damping`) holds the head there whatever it carries. The rod is a mesh on the block's visual scaled each frame to the distance the head is from the mouth of the barrel (measured in the world, `syncPistons`).
- **Skis** (`ski`, `SKI`, `SKI_BODY`, `skiProfile` in `parts/ski-model.ts`): a rounded convex-hull collider (`roundConvexHull`, border radius `SKI.round`: the points are pulled in by the radius and the shape adds it back; a sharp-edged hull sliding fast produced contacts with tilted normals at its edges that kicked the sled up at 10 m/s and more, with hops of 1-4 m/s, and the rounded one stays within 0.01 m/s of vertical speed up to 25 m/s) (the side profile of the runner, flat underside and a sloping tip, extruded over its width and turned by the part's orientation) on the body of its block, with `SKI.mass` blocks of mass, friction `SKI.friction` and the friction combine rule `Min` (it wins over the ground's, whose rule is the default `Average`), in the `chassis` group (it collides with the ground only, and with other bodies' parts). Its underside is `SKI_BODY.bottom` (= `WHEEL.radius`) below the cell centre, so `SPAWN_LIFT` already starts it above the floor. `Grid.canPlace` makes it lie flat on a side face with its length along the face, so the hull is axis aligned.
- **Ski steering** (`SKI.maxSteer` / `steerRate` / `grip`, `PhysicsWorld.skis` / `steerSkis`, the `steerLeft` / `steerRight` actions of `PART_ACTIONS.ski`): every physics step each ski turns its angle towards the keys (left is a positive turn about the body's up axis, at `steerRate`, up to `maxSteer`), and, while its body touches the ground (`skiGrace`), applies at its place an impulse `-v_across * min(1, grip * dt) * m / skis on the body` along the axis across its turned runner (`up x front`), `v_across` being the velocity of the body at that point along it. Skis have almost no friction, so this edge is what makes them steer (and hold a line); the runner mesh (`SKI_RUNNER`) is turned to show it.
- **Sled assist** (`SKI.levelGain` / `levelMin` / `levelGrace`, `PhysicsWorld.levelSkis` / `groundNormal`): every step, for each body with skis that touched a surface within the last `levelGrace` s and whose up axis is within `levelMin` of vertical, the angular velocity is replaced by its part about the body's up axis (yaw) plus `levelGain * (up x n)`, `n` being the average contact normal of the body's colliders (normals that are mostly sideways ignored), so a thruster above the centre of mass cannot pitch it into the ground and it follows ramps. The ski bodies are in `craft` (no engine lever or heading hold in the air). Without it a rigid sled with 1-cell wheelbase tumbled under two top-mounted thrusters.
- **Parachutes** (`Part.power` as canopy size, `PARACHUTE`, `PhysicsWorld.parachutes`, `applyParachutes`): a compact collider (`PARACHUTE.mass` blocks) on the host body. The canopy opens / folds in `openTime` s with its `run` toggle; while open it applies `drag * (power / ENGINE.default) * open * speed^2` against the velocity of the body at the place where it is mounted (speed capped at `maxSpeed`), at that point, so an off-centre one also turns the body. The force is capped at `stopFraction` of what would stop the body in one step, so a big canopy on a light body brakes without reversing it. Bodies with parachutes are not marked `aero` (the air-drag assist still applies to wheeled ones).
- **Propellers** (`Part.power` as thrust, `PROPELLER`, `PhysicsWorld.propellers`, `applyPropellers`): like a thruster a propeller adds a compact collider (`PROPELLER.mass` blocks) to its host body and records its point, front and static thrust (`PROPELLER.thrust * power / ENGINE.default`). Every `step(dt)` its blade speed `spin` (0-1) moves towards 1 while `isOn(part, 'run')` (a toggle) and 0 otherwise at `1 / PROPELLER.spoolTime` per second, the blades turn by `spin * PROPELLER.maxSpin * dt`, and the force `thrust * spin * max(0, 1 - v / PROPELLER.maxAirSpeed)` (`v` the speed of the mounting point along the front, ignored when negative) is applied at the point with `addForceAtPoint`. It does not need wheels or an engine; its body joins `craft` (so the engines' lever and the heading hold are off in the air) and `aero` (the air-drag assist `drag` skips it).
- **Wings** (`WING`, `PhysicsWorld.wings`, `applyWings`, `pointOf`, `buildWingControls`; the parts `wing` and `wingLarge`): for each wing (its area is the polygon's; its lift side `up` is the face that points up when the creation spawns, so a wing turned over still lifts the right way up, and its control surface tilt follows it), from the velocity of the body at the wing's centre (`linvel + angvel x (point - centre of mass)`) taken in the plane of the wing's chord (`front`, the edge that leads) and `up`: `along`, `across`, `speed`; the angle of attack is `a = atan2(-across, along) + WING.camber (only when flying along the chord) + flap * WING.flapAngle`, the dynamic pressure `q = WING.lift * area * min(speed, WING.maxSpeed)^2`, the lift `q * sin(2a)` along the part of `up` perpendicular to the air (the wing's direction of travel) and the drag `q * (WING.baseDrag + WING.stallDrag * sin(a)^2)` against it; both are applied at the wing's centre, so a wing away from the centre of mass also turns the body (lift behind it is nose-down). **The control surface** (`flap`, -1..1, at `WING.flapRate` per second, tilting the wing's visual about its span) follows `pitch * (pitchUp - pitchDown) + roll * (rollRight - rollLeft) + yaw * (yawRight - yawLeft)` of the held keys, clamped; the gains are fixed at build time (`buildWingControls`): the frame of each body is its wings' area-weighted front (`forward`) and up, `right = forward x up`, and each wing's gain for a turn is the torque of one unit of lift at the wing about the centre of mass (`(point - localCom) x up`) along the axis of that turn (nose up: `right`; roll right: `forward`; yaw right: `-up`) over `WING.controlArm`, clamped to -1..1, so a wing near the centre does nothing, one behind it pitches the other way from one ahead of it and the left and right wings roll opposite ways. Each wing also adds a torque `-WING.damping * area * speed * angvel` to its body (the fuselage and tail are not modelled), except on a rotor head, so a rotor blade spins freely. Because a blade's body turns, a wing on a rotor head lifts by the speed of the head: a helicopter. The bodies with wings or propellers are skipped by `drag`, since their wings already make the drag. The same loop resets the bodies' forces and torques first (`applyThrust`).
- **Thrusters** (`Part.power` as thrust, `THRUSTER`, `PhysicsWorld.thrusters`): a thruster adds a compact collider (`THRUSTER.mass` blocks) to its host body and records where it is (in the body's frame), its direction (`frontOf`) and its force (`THRUSTER.thrust * power / ENGINE.default`). Every `PhysicsWorld.step` (`applyThrust`) resets the forces of those bodies and, for each thruster whose key is held (`PhysicsWorld.isOn(part)`, from `VehicleController.isOn`), adds each thruster's force at its point with `addForceAtPoint`, the direction and the point turned by the body's rotation: so it pushes on the ground or in the air, with or without wheels or an engine, and one away from the centre of mass turns the body. The thrusts of a body's thrusters add up. The flame (`PlayEffects.fireThruster`) follows the same `isOn`.
- **Turbos** (`Part.power` as boost, `TURBO`, `WheelDrive.turbos`): a turbo adds a compact collider (`TURBO.mass` blocks) to its host body. The boosts of the turbos of a body whose keys are held (`VehicleController.isOn`, or `setAutopilot({ boost })`) are summed (in units of one default turbo, capped at `TURBO.maxBoost`) and every wheel of that body gets it. While that is above 0 a driven wheel's target speed is multiplied by `1 + speedGain * boost` and its motor strength by `1 + torqueGain * boost`; a wheel that is not driven (no engine push, or braking) is not boosted. Each turbo whose key is held fires its flame (`PlayEffects.fireTurbo`, `FX.flame`).
- **Brakes** (`Part.brake`, `BRAKE`, `VEHICLE.brakeStrength`, `WheelDrive.brake`): every wheel has its own brake strength over `BRAKE.default`. While the wheel's own key (`Part.key`, `WheelDrive.part`) is held (`VehicleController.isOn`, or `setAutopilot({ brake })`) the wheel is held at velocity 0 with strength `idleBrake + brakeStrength * brake`, driven or not, and the throttle does not apply to it; wheels whose key is not held (or that have no key) ignore it.
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
- **Engine**: `target = rollSign * (throttle - dir * steer * side * STEER_GAIN) * MAX_WHEEL_SPEED`, applied with
  `configureMotorVelocity(target, MOTOR_STRENGTH)`. The `throttle` of a wheel is what the engines of its body are asked (each engine
  has its own input from its Accelerate / Reverse keys, `VehicleController.engineInput`), weighted by their power and the way they
  push; `steer` is the wheel's own input from its Steer left / right keys (`steerInput`), `dir` the way the engines push, so a car with
  its engine turned around still turns right with the right key. Steering is differential: the right wheels slow down or reverse
  while the left wheels speed up, and a wheel with no steering key just keeps going straight.
- `setAutopilot({ throttle, steer })` overrides the keys (every engine gets the throttle and every wheel the steer); the main menu uses it with
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

## Part keys (`Part.keys`)

No part has a default key, and the vehicle has no fixed driving keys. A part has **actions** (`PART_ACTIONS` in `constants/part-keys.ts`: an engine's `forward` / `reverse`, a wheel's `steerLeft` / `steerRight` / `brake`, the `run` of a rotor, piston, thruster or turbo) and each action has a list of `KeyboardEvent.code`s in `Part.keys`. `VehicleController` is built with the parts of the creation (`grid.all()`) and answers `isOn(part, action)`: a `hold` action is on while any of its keys is held, a `toggle` action (rotor, piston) once its keys have been pressed an odd number of times (the toggle state is per part and action, so parts on one key stay in step); an action with no key is never on. `engineInput(engine)` (-1..1, from `forward` / `reverse`) feeds the wheels' throttle and `PhysicsWorld.applyEngines` (each engine's lever follows its own input), and `steerInput(wheel)` the wheels' steering. The keys the parts use are the only ones the controller listens to (`bindings`), so the rest of the keyboard is untouched, and Ctrl / Cmd / Alt combinations are ignored; held keys are released when the window loses focus. `PhysicsWorld.isOn` and `engineInput` are set to the controller's (`main.ts`, `menu-scene.ts`) and read per rotor, piston, thruster, turbo (`PlayEffects`) and wheel (`WheelDrive.part`). Games without engines (`Grid.engineDrive` false) have no engine to key, so their wheels keep W / S / A / D and the arrows (`LEGACY_KEYS`). The main-menu autopilot ignores the keys: `setAutopilot` runs every part of a kind at once.

**Flight is the wings' job**: the old attitude controls (W / S pitch, A / D roll, Q / E yaw while no wheel or block touched the ground, `FLIGHT`, `PhysicsWorld.fly`, in git at commit `70596ad`) were removed when the driving keys stopped being fixed, and came back as the pitch / roll / yaw actions of the wings (see Wings above): a control surface per wing, run by keys the player assigns. `PhysicsWorld.airborne` stays (the engines' lever and the heading hold are off in the air).
