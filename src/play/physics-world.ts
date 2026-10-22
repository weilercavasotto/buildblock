import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Grid } from '../build/grid';
import {
  CELL_SIZE,
  CHASSIS,
  COLLISION_GROUP,
  GROUND_COLLIDER,
  BRAKE,
  ENGINE,
  HINGE,
  HINGE_BODY,
  HINGE_VISUAL,
  PISTON,
  PISTON_VISUAL,
  PROPELLER,
  ROTOR,
  ROTOR_VISUAL,
  THRUSTER,
  TURBO,
  VEHICLE,
  WING,
  brakeOf,
  hingeDamping,
  hingeRadians,
  hingeStiffness,
  ROUGHNESS,
  SCENERY_PARTS,
  SHAPES,
  polygonArea,
  SPAWN_CLEARANCE,
  SPAWN_LIFT,
  SUSPENSION,
  WHEEL,
  WORLD,
  GROUND_Y,
  hexToNumber,
  powerOf,
  rotorSpeedOf,
  strokeLength,
  suspensionOf,
  suspensionStiffness,
  tireOf,
  weightMass,
  weightOf,
  wheelSizeOf,
} from '../constants';
import { createCaliperObject, createHeadedBaseObject, createHeadedHeadObject, createPartObject, createPistonRod, faceQuaternion, headedCentres, hingePivot, orientationQuaternion } from '../parts/part-defs';
import { matrixOf, orientationOfPart } from '../parts/orientation';
import { PROPELLER_BLADES } from '../parts/propeller-model';
import { partBox, relativeBoxes, studsEngaged, wedgePoints } from '../parts/part-geometry';
import { EngineFx, PlayEffects, ThrusterFx, TurboFx, WheelFx } from './play-effects';
import { Part, Vec3, axleOf, cellKey, frontOf, isCompactMounted, isHeaded, isStructural, isWheelType, isWing, partCentre, subVec } from '../types';

const { ground: GROUND, chassis: CHASSIS_GROUP, wheel: WHEEL_GROUP } = COLLISION_GROUP;
const groups = (member: number, filter: number): number => (member << 16) | filter;


/** What `PhysicsWorld.audioState` reports for the vehicle's sounds. */
export interface AudioState {
  speed: number;
  rumble: number;
  slip: number;
  wheels: number;
  engines: number;
  thrusters: number;
  /** How fast each propeller's blades turn, 0 (stopped) to 1 (full speed). */
  propellers: number[];
  turbos: number;
  /** False for an old save, where every wheel is driven without engines. */
  engineDrive: boolean;
  /** How fast each rotor turns relative to its block (rad/s). */
  rotors: number[];
  pistonsMoving: number;
  /** The strongest sudden change of velocity (m/s) since the last read. */
  impact: number;
}

export interface WheelDrive {
  joint: RAPIER.RevoluteImpulseJoint;
  axis: Vec3;
  cell: Vec3;
  /** Multiplies the top wheel speed (the wheel's tire type). */
  speed: number;
  /** Multiplies the motor strength (the wheel's tire type). */
  torque: number;
  /** Fraction of `torque` used when driving straight (1 = the same as when steering). */
  cruise: number;
  /**
   * The engines welded to the body this wheel is mounted on (where each pushes towards and its power); null when the game
   * does not need engines (an old save), in which case every wheel is driven at full torque.
   */
  engines: Array<{ front: Vec3; power: number; part: Part }> | null;
  /** How many wheels are mounted on the same body (the engines' power is shared among them). */
  wheelCount: number;
  /** The turbos on this wheel's body, each with its boost in units of one default turbo: the ones whose key is held add up (capped by `TURBO.maxBoost`). */
  turbos: Array<{ part: Part; boost: number }>;
  /** This wheel's brake strength over the default (`BRAKE`): what it is held with while its key is pressed. */
  brake: number;
  /** The wheel itself: its key (`Part.key`) is its brake's. */
  part: Part;
}

interface SyncPair {
  body: RAPIER.RigidBody;
  object: THREE.Object3D;
}

export class PhysicsWorld {
  readonly group = new THREE.Group();
  readonly wheels: WheelDrive[] = [];
  focus: RAPIER.RigidBody | null = null;
  /** How hard the vehicle is being driven (0-1): what the engines' smoke and shaking follow (see `VehicleController.level`). */
  level = 0;
  /** Is the player steering (see `VehicleController.steering`)? The straightening assist is off while so. */
  steering = false;
  /** Has the vehicle left the ground (no wheel or block touches it)? Recomputed every step: the engines' lever and the heading hold are off in the air. */
  airborne = false;
  /**
   * Is this rotor, piston, thruster or turbo switched on right now (see `VehicleController.isOn`)? Each is run by its own key, so the
   * physics asks about every part. Nothing is on until the controller is wired in.
   */
  isOn: (part: Part, action: string) => boolean = () => false;
  /** The throttle an engine is given, -1 to 1 (see `VehicleController.engineInput`): its push on the body follows it. */
  engineInput: (engine: Part) => number = () => 0;
  /** Are the dust, smoke and flames drawn (a setting)? */
  effectsEnabled = true;

  private world = new RAPIER.World({ x: 0, y: WORLD.gravity, z: 0 });
  private pairs: SyncPair[] = [];
  private accumulator = 0;
  private wheelFx: WheelFx[] = [];
  private engineFx: EngineFx[] = [];
  private turboFx: TurboFx[] = [];
  private thrusterFx: ThrusterFx[] = [];
  /** The thrusters: the body each pushes, where (in the body's frame), along which direction and with what force. */
  private thrusters: Array<{ part: Part; body: RAPIER.RigidBody; point: Vec3; direction: Vec3; thrust: number }> = [];
  /** The propellers: the body each pushes, where (in the body's frame), along which direction, with what static force, how fast the blades turn now (0-1) and the blades to spin. */
  private propellers: Array<{ part: Part; body: RAPIER.RigidBody; point: Vec3; direction: Vec3; thrust: number; spin: number; blades: THREE.Object3D | null }> = [];
  /** The wings: the body each is on, where and how it is turned (in the body's frame), its area (cells²), the flap now (-1..1) and the visual to tilt with it. */
  private wings: Array<{ part: Part; body: RAPIER.RigidBody; point: Vec3; up: Vec3; front: Vec3; area: number; lift: 1 | -1; flap: number; object: THREE.Object3D; rest: THREE.Quaternion; pitch: number; roll: number; yaw: number }> = [];
  /** The engines: the body each is mounted on, where (in the body's frame), where it faces and its power (see `ENGINE.leverage`). */
  private pushers: Array<{ part: Part; body: RAPIER.RigidBody; point: Vec3; front: Vec3; power: number }> = [];
  /** The direction the vehicle drives in (in the body's frame), the same one the vehicle controller uses. */
  private forward = new THREE.Vector3(0, 0, -1);
  /** The rotors: the hinge between the body of the block and the head (with what it holds) and the signed speed it is driven to (rad/s). */
  private rotors: Array<{ part: Part; joint: RAPIER.RevoluteImpulseJoint; target: number; host: RAPIER.RigidBody; head: RAPIER.RigidBody }> = [];
  /** The hinges: the joint between the body of the block and the head, how far it opens (rad), where the servo is aiming now (rad), and the two bodies. */
  private hinges: Array<{ part: Part; joint: RAPIER.RevoluteImpulseJoint; open: number; target: number; host: RAPIER.RigidBody; head: RAPIER.RigidBody }> = [];
  /** The pistons: the slider between the body of the block and the head, how far (cells) it may go, where its spring is aiming now, the two bodies, the pivot in each (the head's in its own body), the axis and the rod to scale. */
  private pistons: Array<{ part: Part; joint: RAPIER.PrismaticImpulseJoint; stroke: number; target: number; host: RAPIER.RigidBody; head: RAPIER.RigidBody; pivot: Vec3; headLocal: Vec3; face: Vec3; rod: THREE.Mesh }> = [];
  private effects: PlayEffects;
  /** The bodies that carry wheels: the ones the straightening assist acts on. */
  private chassis = new Set<RAPIER.RigidBody>();
  /** The heading each of those bodies holds while the player does not steer (see `straighten`). */
  private heldYaw = new Map<RAPIER.RigidBody, number>();
  /** The bodies that carry wings: the way their wings lead (in the body's frame) and the total area of the wings. */
  private wingFrames = new Map<RAPIER.RigidBody, { forward: THREE.Vector3; area: number }>();
  /** The bodies that carry wings or propellers: the air drag assist leaves them alone. */
  private aero = new Set<RAPIER.RigidBody>();
  /** The bodies of the vehicle that can be flown (the ones that carry wheels or thrusters), where each one's nose is, and the colliders that tell whether it touches the ground. */
  private craft = new Set<RAPIER.RigidBody>();
  private groundColliders: RAPIER.Collider[] = [];

  constructor(grid: Grid) {
    this.buildScenery();
    this.buildCreation(grid);
    this.effects = new PlayEffects(this.world, this.wheelFx, this.engineFx, this.turboFx, this.thrusterFx);
    this.group.add(this.effects.group);
    this.sync();
  }

  /**
   * Pushes the bodies that have thrusters: every step the force of each thruster is applied to its body at the place where it is
   * mounted, along its direction turned by the body's rotation (nothing while its key is not held).
   */
  private applyThrust(dt: number): void {
    const q = new THREE.Quaternion();
    // A force applied at a point also adds a torque, and Rapier keeps both until they are reset: clear both, or the torque of a
    // thruster that is off the centre would go on spinning the body after the key is released.
    for (const body of new Set([...this.thrusters, ...this.pushers, ...this.propellers, ...this.wings].map((t) => t.body))) {
      body.resetForces(true);
      body.resetTorques(true);
    }
    this.applyEngines(q);
    this.applyPropellers(q, dt);
    this.applyWings(q, dt);
    for (const t of this.thrusters) {
      if (!this.isOn(t.part, 'run')) continue;
      const r = t.body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      const direction = new THREE.Vector3(...t.direction).applyQuaternion(q).multiplyScalar(t.thrust);
      const position = t.body.translation();
      const point = new THREE.Vector3(...t.point).applyQuaternion(q).add(new THREE.Vector3(position.x, position.y, position.z));
      t.body.addForceAtPoint({ x: direction.x, y: direction.y, z: direction.z }, { x: point.x, y: point.y, z: point.z }, true);
    }
  }


  /** Where a point of `body` (given in its frame) is in the world, and how fast that point moves (the body's velocity plus its turn about the centre of mass). */
  private pointOf(body: RAPIER.RigidBody, q: THREE.Quaternion, local: Vec3): { at: THREE.Vector3; velocity: THREE.Vector3 } {
    const r = body.rotation();
    q.set(r.x, r.y, r.z, r.w);
    const position = body.translation();
    const at = new THREE.Vector3(...local).applyQuaternion(q).add(new THREE.Vector3(position.x, position.y, position.z));
    const com = body.worldCom();
    const v = body.linvel();
    const w = body.angvel();
    const velocity = new THREE.Vector3(w.x, w.y, w.z).cross(at.clone().sub(new THREE.Vector3(com.x, com.y, com.z))).add(new THREE.Vector3(v.x, v.y, v.z));
    return { at, velocity };
  }

  /**
   * The propellers (see `PROPELLER`): the blades speed up while the part is switched on and slow down when it is not; the push along the
   * front, at the place where the propeller is mounted, is the static thrust times the blade speed times how much of the way to
   * `maxAirSpeed` the air along the front has not gone.
   */
  private applyPropellers(q: THREE.Quaternion, dt: number): void {
    for (const p of this.propellers) {
      const goal = this.isOn(p.part, 'run') ? 1 : 0;
      p.spin += Math.max(-dt / PROPELLER.spoolTime, Math.min(dt / PROPELLER.spoolTime, goal - p.spin));
      if (p.blades) p.blades.rotation.z += p.spin * PROPELLER.maxSpin * dt;
      if (p.spin <= 0) continue;
      const { at, velocity } = this.pointOf(p.body, q, p.point);
      const direction = new THREE.Vector3(...p.direction).applyQuaternion(q);
      const push = p.thrust * p.spin * Math.max(0, 1 - Math.max(0, velocity.dot(direction)) / PROPELLER.maxAirSpeed);
      p.body.addForceAtPoint({ x: direction.x * push, y: direction.y * push, z: direction.z * push }, { x: at.x, y: at.y, z: at.z }, true);
    }
  }

  /**
   * The wings (see `WING`): from the velocity of the air at each wing (the opposite of the velocity of the wing there, in the plane of
   * its chord and its up) the lift (perpendicular to the air, towards the wing's up) and the drag (against it) of a flat cambered plate
   * are applied at the wing's centre, so a wing far from the centre of mass also turns the body. The pitch / roll / yaw keys move the wing's control surface
   * (its incidence, and the wing itself, a little, so it shows; see `buildWingControls`), and every wing damps the turn of its body (`WING.damping`) unless it is on a rotor head.
   */
  private applyWings(q: THREE.Quaternion, dt: number): void {
    const heads = new Set(this.rotors.map((r) => r.head));
    // The fuselage and the tail are not modelled, so a body with wings gets their main effect: a torque that turns its nose (the way its
    // wings lead) towards the way it is moving, which keeps a plane pointing where it flies instead of tumbling nose over tail.
    for (const [body, frame] of this.wingFrames) {
      if (heads.has(body)) continue;
      const r = body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      const v = body.linvel();
      const velocity = new THREE.Vector3(v.x, v.y, v.z);
      const speed = Math.min(velocity.length(), WING.maxSpeed);
      if (speed < 1) continue;
      const nose = frame.forward.clone().applyQuaternion(q);
      const torque = nose.cross(velocity.normalize()).multiplyScalar(WING.stability * frame.area * speed * speed);
      body.addTorque({ x: torque.x, y: torque.y, z: torque.z }, true);
    }
    for (const wing of this.wings) {
      const on = (action: string) => Number(this.isOn(wing.part, action));
      const target = Math.max(-1, Math.min(1, (on('pitchUp') - on('pitchDown')) * wing.pitch + (on('rollRight') - on('rollLeft')) * wing.roll + (on('yawRight') - on('yawLeft')) * wing.yaw));
      wing.flap += Math.max(-WING.flapRate * dt, Math.min(WING.flapRate * dt, target - wing.flap));
      wing.object.quaternion.copy(wing.rest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -wing.lift * wing.flap * WING.flapAngle));
      const { at, velocity } = this.pointOf(wing.body, q, wing.point);
      const up = new THREE.Vector3(...wing.up).applyQuaternion(q);
      const chord = new THREE.Vector3(...wing.front).applyQuaternion(q);
      const along = velocity.dot(chord);
      const across = velocity.dot(up);
      const speed = Math.hypot(along, across);
      if (speed < 0.1) continue;
      const alpha = Math.atan2(-across, along) + (along > 0 ? WING.camber : 0) + wing.flap * WING.flapAngle;
      const air = chord.clone().multiplyScalar(along / speed).addScaledVector(up, across / speed); // the wing's direction of travel, in its plane
      const lift = up.clone().addScaledVector(air, -up.dot(air)).normalize();
      const pressure = WING.lift * wing.area * Math.min(speed, WING.maxSpeed) ** 2;
      const force = lift.multiplyScalar(pressure * Math.sin(2 * alpha)).addScaledVector(air, -pressure * (WING.baseDrag + WING.stallDrag * Math.sin(alpha) ** 2));
      wing.body.addForceAtPoint({ x: force.x, y: force.y, z: force.z }, { x: at.x, y: at.y, z: at.z }, true);
      if (heads.has(wing.body)) continue; // a rotor blade is meant to spin
      const turn = wing.body.angvel();
      const damping = -WING.damping * wing.area * Math.min(velocity.length(), WING.maxSpeed);
      wing.body.addTorque({ x: turn.x * damping, y: turn.y * damping, z: turn.z * damping }, true);
    }
  }

  /**
   * Where an engine is matters: while the vehicle is driven on the ground, the push of each engine along its front (`ENGINE.leverage`,
   * scaled by the mass of its body, its power and the throttle) is turned into a torque about the centre of mass of the body, so an
   * engine high above it lifts the nose when accelerating, one far to a side pulls the vehicle that way, and one low and central does
   * nothing. The wheels still do the driving (see `VehicleController`): this only adds the lever, so an engine facing sideways (it
   * drives nothing) has none. Rapier keeps the torque until it is reset, which `applyThrust` does every step.
   */
  private applyEngines(q: THREE.Quaternion): void {
    if (this.airborne) return;
    for (const e of this.pushers) {
      const input = this.engineInput(e.part);
      if (input === 0 || !this.chassis.has(e.body)) continue;
      const front = new THREE.Vector3(...e.front);
      if (Math.abs(front.dot(this.forward)) < 0.5) continue;
      const r = e.body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      const com = e.body.worldCom();
      const position = e.body.translation();
      const arm = new THREE.Vector3(...e.point).applyQuaternion(q).add(new THREE.Vector3(position.x, position.y, position.z)).sub(new THREE.Vector3(com.x, com.y, com.z));
      const push = front.applyQuaternion(q).multiplyScalar(ENGINE.leverage * e.body.mass() * (e.power / ENGINE.default) * input);
      const torque = arm.cross(push);
      e.body.addTorque({ x: torque.x, y: torque.y, z: torque.z }, true);
    }
  }

  /** Air drag (see `VEHICLE.airDrag`): an impulse against the velocity of every body that carries wheels, growing with the square of the speed above `VEHICLE.dragFreeSpeed`. */
  private drag(dt: number): void {
    for (const body of this.chassis) {
      if (this.aero.has(body)) continue; // the wings and the propellers already make the drag and the top speed of a plane
      const v = body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      const excess = speed - VEHICLE.dragFreeSpeed;
      if (excess <= 0) continue;
      const k = (VEHICLE.airDrag * body.mass() * excess * excess * dt) / speed; // an impulse against the velocity
      body.applyImpulse({ x: -v.x * k, y: -v.y * k, z: -v.z * k }, true);
    }
  }

  /**
   * Driving assist (see `VEHICLE.straighteningGain`): while the player is not steering, an upright vehicle holds the heading it had
   * when the steering ended, so a vehicle that is built symmetrically does not veer to one side.
   */
  private straighten(): void {
    const q = new THREE.Quaternion();
    for (const body of this.chassis) {
      const r = body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      const w = body.angvel();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q).y;
      // Steering, or flipped / on its side, or turning fast: nothing to hold; the heading is taken again when it calms down.
      if (this.airborne || this.steering || up < VEHICLE.uprightMin || Math.abs(w.y) > VEHICLE.straighteningMaxRate) {
        this.heldYaw.delete(body);
        continue;
      }
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const yaw = Math.atan2(forward.x, forward.z);
      const held = this.heldYaw.get(body);
      if (held === undefined) {
        this.heldYaw.set(body, yaw);
        continue;
      }
      let error = yaw - held;
      error -= Math.PI * 2 * Math.round(error / (Math.PI * 2));
      body.setAngvel({ x: w.x, y: -VEHICLE.straighteningGain * error, z: w.z }, true);
    }
  }

  /** Drives the rotors: towards their speed while they are switched on, else almost free (a light damping). */
  private driveRotors(): void {
    for (const rotor of this.rotors) {
      if (this.isOn(rotor.part, 'run')) rotor.joint.configureMotorVelocity(rotor.target, ROTOR.strength);
      else rotor.joint.configureMotorVelocity(0, ROTOR.idleDamping);
    }
  }

  /** The biggest sudden change of the vehicle's velocity (m/s) since `audioState` last read it: a bump or a crash. */
  private impactChange = 0;
  /** Does the game need engines to drive the wheels (see `Grid.engineDrive`)? */
  private engineDrive = false;

  /**
   * What the vehicle sounds like right now, for `VehicleSound`: its speed, how hard the wheels grip and slip, how many engines, jets
   * and turbos it has, how fast each rotor turns, how many pistons are moving and the strongest bump since the last call.
   */
  audioState(): AudioState {
    const v = this.focus?.linvel() ?? { x: 0, y: 0, z: 0 };
    const impact = this.impactChange;
    this.impactChange = 0;
    return {
      speed: Math.hypot(v.x, v.y, v.z),
      rumble: this.effects.rumble,
      slip: this.effects.slip,
      wheels: this.wheels.length,
      engines: this.engineFx.length,
      thrusters: this.thrusterFx.length,
      propellers: this.propellers.map((p) => p.spin),
      turbos: this.turboFx.length,
      engineDrive: this.engineDrive,
      rotors: this.rotors.map((r) => {
        const a = r.head.angvel();
        const b = r.host.angvel();
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      }),
      pistonsMoving:
        this.hinges.filter((h) => Math.abs((this.isOn(h.part, 'run') ? h.open : 0) - h.target) > 1e-3).length +
        this.pistons.filter((p) => Math.abs((this.isOn(p.part, 'run') ? p.stroke : 0) - p.target) > 1e-3).length,
      impact,
    };
  }

  /** Slides the pistons: the target of each spring moves towards out (the stroke) or back (0) at `PISTON.speed` and the spring follows it. */
  private drivePistons(dt: number): void {
    for (const piston of this.pistons) {
      const goal = this.isOn(piston.part, 'run') ? piston.stroke : 0;
      const step = PISTON.speed * dt;
      piston.target += Math.max(-step, Math.min(step, goal - piston.target));
      piston.joint.configureMotorPosition(piston.target, PISTON.stiffness, PISTON.damping);
    }
  }

  /** Swings the hinges: the target of each servo moves towards open (the angle) or closed (0) at `HINGE.speed` and the motor follows it. */
  private driveHinges(dt: number): void {
    for (const hinge of this.hinges) {
      const goal = this.isOn(hinge.part, 'run') ? hinge.open : 0;
      const step = HINGE.speed * dt;
      hinge.target += Math.max(-step, Math.min(step, goal - hinge.target));
      hinge.joint.configureMotorPosition(hinge.target, hingeStiffness(hinge.part), hingeDamping(hinge.part));
    }
  }

  step(dt: number): void {
    this.applyThrust(dt);
    this.driveRotors();
    this.drivePistons(dt);
    this.driveHinges(dt);
    this.accumulator = Math.min(this.accumulator + dt, WORLD.maxFrameTime);
    this.airborne = this.craft.size > 0 && !this.touchingGround();
    while (this.accumulator >= WORLD.step) {
      this.straighten();
      this.drag(WORLD.step);
      const before = this.focus?.linvel();
      this.world.step();
      if (before && this.focus) {
        const after = this.focus.linvel();
        this.impactChange = Math.max(this.impactChange, Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z));
      }
      this.accumulator -= WORLD.step;
    }
    this.sync();
    this.effects.group.visible = this.effectsEnabled;
    this.effects.update(dt, this.level, (part) => this.isOn(part, 'run'));
  }

  dispose(): void {
    this.effects.dispose();
    this.world.free();
    this.group.clear();
  }

  /** Scales the rod of every piston to the distance the head has gone from the mouth of the barrel (measured along the axis, in the world). */
  private syncPistons(): void {
    const qHost = new THREE.Quaternion();
    const qHead = new THREE.Quaternion();
    for (const p of this.pistons) {
      const hr = p.host.rotation();
      const br = p.head.rotation();
      qHost.set(hr.x, hr.y, hr.z, hr.w);
      qHead.set(br.x, br.y, br.z, br.w);
      const hostAt = new THREE.Vector3(...p.pivot).applyQuaternion(qHost).add(p.host.translation() as THREE.Vector3);
      const headAt = new THREE.Vector3(...p.headLocal).applyQuaternion(qHead).add(p.head.translation() as THREE.Vector3);
      const out = headAt.sub(hostAt).dot(new THREE.Vector3(...p.face).applyQuaternion(qHost));
      p.rod.visible = out > 0.01;
      p.rod.scale.y = Math.max(out, 0.001);
    }
  }

  private sync(): void {
    this.syncPistons();
    for (const { body, object } of this.pairs) {
      const t = body.translation();
      const r = body.rotation();
      object.position.set(t.x, t.y, t.z);
      object.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /**
   * Prepares what tells whether the vehicle has left the ground: the bodies of the vehicle (the ones that carry wheels or thrusters)
   * and the colliders whose contacts with the ground are checked, and the direction the vehicle drives in.
   */
  private buildGroundSensors(): void {
    for (const t of [...this.thrusters, ...this.propellers]) this.craft.add(t.body);
    for (const t of [...this.propellers, ...this.wings]) this.aero.add(t.body);
    for (const body of this.chassis) this.craft.add(body);
    const onX = this.wheels.filter((w) => w.axis[0] !== 0).length;
    this.forward.copy(new THREE.Vector3(...(onX >= this.wheels.length - onX ? [0, 0, -1] : [1, 0, 0])));
    for (const body of this.craft) {
      for (let i = 0; i < body.numColliders(); i++) this.groundColliders.push(body.collider(i));
    }
    for (const wheel of this.wheelFx) this.groundColliders.push(wheel.body.collider(0));
  }

  /** Does any collider of the vehicle touch the ground? */
  private touchingGround(): boolean {
    for (const collider of this.groundColliders) {
      let touching = false;
      this.world.contactPairsWith(collider, (other) => {
        if (touching || ((other.collisionGroups() >> 16) & GROUND) === 0) return;
        this.world.contactPair(collider, other, (manifold) => {
          if (manifold.numContacts() > 0) touching = true;
        });
      });
      if (touching) return true;
    }
    return false;
  }

  private buildScenery(): void {
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(GROUND_COLLIDER.halfExtent, GROUND_COLLIDER.halfThickness, GROUND_COLLIDER.halfExtent)
        .setTranslation(0, GROUND_COLLIDER.centerY, 0)
        .setCollisionGroups(groups(GROUND, 0xffff))
        .setFriction(GROUND_COLLIDER.friction),
    );
    // The ramps and obstacles: parts of the catalog, fixed in place (one fixed body, a collider per box of each part).
    const fixed = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    for (const part of SCENERY_PARTS) {
      this.addStructuralColliders(fixed, part, part.cell, (desc) => desc.setCollisionGroups(groups(GROUND, 0xffff)).setFriction(1));
      const object = createPartObject(part);
      object.position.set(...part.cell);
      this.group.add(object);
    }
  }

  /**
   * One collider on `body` for each box of the structural `part`, `local` being where the part's cell is in the body's frame: a cuboid
   * around the centre of the box, or the convex hull of the corners of a wedge. `configure` sets the rest (density, friction, groups).
   */
  private addStructuralColliders(body: RAPIER.RigidBody, part: Part, local: Vec3, configure: (desc: RAPIER.ColliderDesc) => RAPIER.ColliderDesc): void {
    const wedges = wedgePoints(part);
    relativeBoxes(part).forEach((box, i) => {
      const half = box.max.map((v, k) => (v - box.min[k]) / 2);
      const corners = wedges[i];
      const hull = corners ? RAPIER.ColliderDesc.convexHull(new Float32Array(corners.flatMap((c) => [local[0] + c[0], local[1] + c[1], local[2] + c[2]]))) : null;
      const shape =
        hull ??
        RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2]).setTranslation(local[0] + (box.min[0] + box.max[0]) / 2, local[1] + (box.min[1] + box.max[1]) / 2, local[2] + (box.min[2] + box.max[2]) / 2);
      this.world.createCollider(configure(shape), body);
    });
  }

  /**
   * The rotors and the pistons (see `ROTOR`, `PISTON`): the base is a compact collider on the body of its block; the head is a disc
   * collider on the body of the parts welded to its studs (their component, or a small body of its own when nothing is on it), and a
   * joint along the axis of the face (a hinge for the rotor, a slider with limits for the piston) joins that body to the block's,
   * with the contacts between the two off (the head sits on the base and a blade may sweep past the block). When the head's parts are
   * welded to the block's too, they are one body and the part is just rigid.
   */
  private buildHeaded(
    parts: Part[],
    bodyOfBlock: Map<string, { body: RAPIER.RigidBody; origin: Vec3; visual: THREE.Group }>,
    hostBody: (part: Part) => { body: RAPIER.RigidBody; origin: Vec3; visual: THREE.Group } | undefined,
    lift: number,
  ): void {
    const blocks = parts.filter((p) => isStructural(p.type));
    for (const part of parts.filter((p) => isHeaded(p.type) && p.face)) {
      const host = hostBody(part);
      if (!host) continue;
      const piston = part.type === 'piston';
      const hinge = part.type === 'hinge';
      const look = piston ? PISTON_VISUAL : hinge ? HINGE_VISUAL : ROTOR_VISUAL;
      const face = part.face!;
      const axisIndex = face.findIndex((v) => v !== 0);
      const centres = headedCentres(part);
      /** Half sizes of a slab `depth` thick along the axis and `width` across it. */
      const halves = (depth: number, width: number): Vec3 => [0, 1, 2].map((i) => (i === axisIndex ? depth : width) / 2) as Vec3;

      // The base stays with the block.
      const baseHalf = halves(look.baseDepth, hinge ? HINGE_BODY.width : (look as typeof ROTOR_VISUAL).flangeRadius * 2);
      const baseLocal = subVec(centres.base, host.origin);
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(...baseHalf)
          .setTranslation(...baseLocal)
          .setDensity((CHASSIS.density * (piston ? PISTON.mass : hinge ? HINGE.mass : ROTOR.mass)) / (8 * baseHalf[0] * baseHalf[1] * baseHalf[2]))
          .setFriction(CHASSIS.friction)
          .setCollisionGroups(groups(CHASSIS_GROUP, GROUND | CHASSIS_GROUP)),
        host.body,
      );
      const baseObject = createHeadedBaseObject(part);
      baseObject.position.set(...baseLocal);
      host.visual.add(baseObject);

      // The head goes with the parts on its studs.
      const held = new Map<RAPIER.RigidBody, { body: RAPIER.RigidBody; origin: Vec3; visual: THREE.Group }>();
      for (const block of blocks) {
        if (studsEngaged(part, block) === 0) continue;
        const holder = bodyOfBlock.get(cellKey(block.cell));
        if (holder) held.set(holder.body, holder);
      }
      let head = [...held.values()][0];
      if (!head) {
        const body = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic().setTranslation(centres.head[0], centres.head[1] + lift, centres.head[2]).setCanSleep(false),
        );
        const visual = new THREE.Group();
        this.group.add(visual);
        this.pairs.push({ body, object: visual });
        head = { body, origin: centres.head, visual };
      }
      const headLocal = subVec(centres.head, head.origin);
      const turned = faceQuaternion(face); // the cylinder's axis (Y) along the part's axis
      const headHalf = halves(HINGE_VISUAL.headDepth, HINGE_BODY.width);
      this.world.createCollider(
        (hinge
          ? RAPIER.ColliderDesc.cuboid(...headHalf) // a flat plate, as wide as the cell
          : RAPIER.ColliderDesc.cylinder(look.headDepth / 2, (look as typeof ROTOR_VISUAL).headRadius).setRotation({ x: turned.x, y: turned.y, z: turned.z, w: turned.w })
        )
          .setTranslation(...headLocal)
          .setDensity(CHASSIS.density)
          .setFriction(CHASSIS.friction)
          .setCollisionGroups(groups(CHASSIS_GROUP, GROUND | CHASSIS_GROUP)),
        head.body,
      );
      const headObject = createHeadedHeadObject(part);
      headObject.position.set(...headLocal);
      head.visual.add(headObject);
      // Parts on the head that are not in the same body as the first one (it is rare: two stacks on one head) are fixed to it.
      for (const other of held.values()) {
        if (other.body === head.body) continue;
        const offset = subVec(other.origin, head.origin);
        this.world.createImpulseJoint(RAPIER.JointData.fixed({ x: offset[0], y: offset[1], z: offset[2] }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }), head.body, other.body, true);
      }

      if (head.body === host.body) continue; // welded to the block: it cannot move
      const pivot = subVec(centres.head, host.origin);
      const axis = { x: face[0], y: face[1], z: face[2] };
      const anchors = [{ x: pivot[0], y: pivot[1], z: pivot[2] }, { x: headLocal[0], y: headLocal[1], z: headLocal[2] }] as const;
      if (piston) {
        const stroke = strokeLength(part);
        const data = RAPIER.JointData.prismatic(anchors[0], anchors[1], axis);
        data.limitsEnabled = true;
        data.limits = [0, stroke];
        const joint = this.world.createImpulseJoint(data, host.body, head.body, true) as RAPIER.PrismaticImpulseJoint;
        joint.setContactsEnabled(false);
        joint.configureMotorModel(RAPIER.MotorModel.AccelerationBased);
        joint.configureMotorPosition(0, PISTON.stiffness, PISTON.damping);
        // The rod shows between the barrel and the head while it is out: a cylinder on the barrel's mouth, as long as the head is away (see `sync`).
        const rod = createPistonRod();
        rod.quaternion.copy(orientationQuaternion(orientationOfPart(part)));
        rod.position.set(...baseLocal).addScaledVector(new THREE.Vector3(...face), PISTON_VISUAL.baseDepth / 2);
        rod.visible = false;
        host.visual.add(rod);
        this.pistons.push({ part, joint, stroke, target: 0, host: host.body, head: head.body, pivot, headLocal, face, rod });
        continue;
      }
      if (hinge) {
        // The head swings on the pin along its back edge: the pivot is on the pin, the same point in the frame of each body.
        const { point, axis: pin } = hingePivot(part);
        const onHost = subVec(point, host.origin);
        const onHead = subVec(point, head.origin);
        const data = RAPIER.JointData.revolute({ x: onHost[0], y: onHost[1], z: onHost[2] }, { x: onHead[0], y: onHead[1], z: onHead[2] }, { x: pin[0], y: pin[1], z: pin[2] });
        data.limitsEnabled = true;
        data.limits = [0, Math.PI];
        const joint = this.world.createImpulseJoint(data, host.body, head.body, true) as RAPIER.RevoluteImpulseJoint;
        joint.setContactsEnabled(false);
        joint.configureMotorModel(RAPIER.MotorModel.AccelerationBased);
        joint.configureMotorPosition(0, hingeStiffness(part), hingeDamping(part));
        this.hinges.push({ part, joint, open: hingeRadians(part), target: 0, host: host.body, head: head.body });
        continue;
      }
      const joint = this.world.createImpulseJoint(RAPIER.JointData.revolute(anchors[0], anchors[1], axis), host.body, head.body, true) as RAPIER.RevoluteImpulseJoint;
      joint.setContactsEnabled(false);
      // Positive speed is clockwise seen from the head: the other way round about the axis (right-handed), which points out of the block.
      this.rotors.push({ part, joint, target: (-rotorSpeedOf(part) / ROTOR.max) * ROTOR.maxSpeed, host: host.body, head: head.body });
    }
  }

  private buildCreation(grid: Grid): void {
    this.engineDrive = grid.engineDrive;
    const parts = grid.all();
    const blocks = parts.filter((p) => isStructural(p.type)); // blocks and plates
    const wheelParts = parts.filter((p) => isWheelType(p.type) && p.face);
    // Everything spawns raised so that the largest wheel starts just above the floor (the wheel centre is `partCentre`).
    const lift = Math.max(
      SPAWN_LIFT,
      ...wheelParts.map((w) => WHEEL.radius * wheelSizeOf(w.type).scale - (partCentre(w)[1] - GROUND_Y) + SPAWN_CLEARANCE),
    );
    const seen = new Set<string>();
    const bodyOfBlock = new Map<string, { body: RAPIER.RigidBody; origin: Vec3; visual: THREE.Group }>();
    /** The body (and its frame) of the block that a mounted part sits on. */
    const hostBody = (part: Part) => {
      const host = grid.hostOf(part);
      return host ? bodyOfBlock.get(cellKey(host.cell)) : undefined;
    };
    const enginesOfBody = new Map<RAPIER.RigidBody, Array<{ front: Vec3; power: number; part: Part }>>();
    /** The turbos of each body, each with its boost in units of one turbo of the default strength. */
    const boostOfBody = new Map<RAPIER.RigidBody, Array<{ part: Part; boost: number }>>();
    let biggest = 0;

    // Blocks and plates linked by studs become ONE rigid body with a collider per part (keeps the structure stiff).
    for (const start of blocks) {
      if (seen.has(cellKey(start.cell))) continue;
      const comp: Part[] = [];
      const queue = [start];
      seen.add(cellKey(start.cell));
      while (queue.length) {
        const cur = queue.pop()!;
        comp.push(cur);
        for (const n of grid.linkedParts(cur)) {
          if (!seen.has(cellKey(n.cell))) {
            seen.add(cellKey(n.cell));
            queue.push(n);
          }
        }
      }

      const origin = comp
        .reduce<Vec3>((s, p) => [s[0] + p.cell[0], s[1] + p.cell[1], s[2] + p.cell[2]], [0, 0, 0])
        .map((v) => v / comp.length) as Vec3;
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(origin[0], origin[1] + lift, origin[2])
          .setCanSleep(false),
      );
      const visual = new THREE.Group();
      for (const p of comp) {
        const local = subVec(p.cell, origin);
        // One collider per box of the part (a block is one cube, a plate a slab, an L bracket two slabs), around its centre.
        this.addStructuralColliders(body, p, local, (desc) =>
          desc.setDensity(CHASSIS.density * weightMass(weightOf(p))).setFriction(CHASSIS.friction).setCollisionGroups(groups(CHASSIS_GROUP, GROUND | CHASSIS_GROUP)),
        );
        const obj = createPartObject(p);
        obj.position.set(...local);
        visual.add(obj);
        if (isWing(p.type)) {
          // A wing is a surface at the centre of its box (a wing on the left and one on the right answer the roll keys the opposite way).
          const m = matrixOf(orientationOfPart(p));
          relativeBoxes(p).forEach((box, i) => {
            const shape = SHAPES[p.type as keyof typeof SHAPES].boxes[i];
            const half = obj.children[i];
            const centre = box.min.map((v, k) => (v + box.max[k]) / 2) as Vec3;
            this.wings.push({ part: p, body, point: [local[0] + centre[0], local[1] + centre[1], local[2] + centre[2]], up: m[1][1] < -0.5 ? (m[1].map((v) => -v) as Vec3) : m[1], front: m[2], lift: m[1][1] < -0.5 ? -1 : 1, area: polygonArea(shape.polygon!), flap: 0, object: half, rest: half.quaternion.clone(), pitch: 0, roll: 0, yaw: 0 });
          });
        }
        bodyOfBlock.set(cellKey(p.cell), { body, origin, visual });
      }
      this.group.add(visual);
      this.pairs.push({ body, object: visual });
      if (comp.length > biggest) {
        biggest = comp.length;
        this.focus = body;
      }
    }

    // Engines and turbos are mounted on a block: a compact collider on its body (an engine weighs `ENGINE.mass` blocks, a turbo
    // `TURBO.mass`), its visual and what it does (the engine's drive, the turbo's boost).
    for (const engine of parts.filter((p) => isCompactMounted(p.type) && !isHeaded(p.type) && p.face)) {
      const host = hostBody(engine);
      if (!host) continue;
      const box = partBox(engine);
      const half = box.max.map((v, i) => (v - box.min[i]) / 2);
      const local = subVec(partCentre(engine), host.origin);
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2])
          .setTranslation(...local)
          .setDensity((CHASSIS.density * (engine.type === 'engine' ? ENGINE.mass : engine.type === 'propeller' ? PROPELLER.mass : TURBO.mass)) / (8 * half[0] * half[1] * half[2]))
          .setFriction(CHASSIS.friction)
          .setCollisionGroups(groups(CHASSIS_GROUP, GROUND | CHASSIS_GROUP)),
        host.body,
      );
      const obj = createPartObject(engine);
      obj.position.set(...local);
      host.visual.add(obj);
      if (engine.type === 'thruster') {
        this.thrusters.push({ part: engine, body: host.body, point: local, direction: frontOf(engine), thrust: (THRUSTER.thrust * powerOf(engine)) / ENGINE.default });
        this.thrusterFx.push({ part: engine, object: obj });
        continue;
      }
      if (engine.type === 'propeller') {
        this.propellers.push({ part: engine, body: host.body, point: local, direction: frontOf(engine), thrust: (PROPELLER.thrust * powerOf(engine)) / ENGINE.default, spin: 0, blades: obj.getObjectByName(PROPELLER_BLADES) ?? null });
        continue;
      }
      if (engine.type === 'turbo') {
        boostOfBody.set(host.body, [...(boostOfBody.get(host.body) ?? []), { part: engine, boost: powerOf(engine) / ENGINE.default }]);
        this.turboFx.push({ part: engine, object: obj });
        continue;
      }
      this.pushers.push({ part: engine, body: host.body, point: local, front: frontOf(engine), power: powerOf(engine) });
      this.engineFx.push({ body: host.body, object: obj, position: obj.position.clone(), quaternion: obj.quaternion.clone() });
      enginesOfBody.set(host.body, [...(enginesOfBody.get(host.body) ?? []), { front: frontOf(engine), power: powerOf(engine), part: engine }]);
    }

    this.buildHeaded(parts, bodyOfBlock, hostBody, lift);

    // Each wheel is its own body, spinning on a motorised hinge. The hinge is carried by a light "hub" body that hangs from
    // the block the wheel is mounted on by a vertical spring (the suspension): chassis -spring- hub -hinge- wheel.
    const up = { x: 0, y: 1, z: 0 };
    // The spring must carry the chassis: its force is scaled by the mass each wheel of that body supports.
    const wheelsOn = new Map<RAPIER.RigidBody, number>();
    for (const wheel of wheelParts) {
      const host = hostBody(wheel);
      if (host) {
        wheelsOn.set(host.body, (wheelsOn.get(host.body) ?? 0) + 1);
        this.chassis.add(host.body);
      }
    }
    for (const wheel of wheelParts) {
      // `face` is where the wheel is mounted (its host block); the axle comes from its rotation (or is the face normal).
      const host = hostBody(wheel);
      const axle = axleOf(wheel);
      if (!host) continue;

      const centre = partCentre(wheel);
      const { scale, speed: sizeSpeed, torque: sizeTorque, cruise } = wheelSizeOf(wheel.type);
      const q = faceQuaternion(axle);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(centre[0], centre[1] + lift, centre[2])
          .setCanSleep(false),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder((WHEEL.width * scale) / 2, WHEEL.radius * scale)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setDensity(WHEEL.density)
          .setFriction(tireOf(wheel).friction)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
          .setCollisionGroups(groups(WHEEL_GROUP, GROUND)),
        body,
      );
      const axis = { x: axle[0], y: axle[1], z: axle[2] };
      this.wheelFx.push({ body, radius: WHEEL.radius * scale, width: WHEEL.width * scale, axle: new THREE.Vector3(...axle) });
      const anchor = subVec(centre, host.origin);

      const hub = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(centre[0], centre[1] + lift, centre[2])
          // A large rotational inertia keeps the wheel motor strong: it acts on the reduced inertia of hub and wheel.
          .setAdditionalMassProperties(
            SUSPENSION.hubMass,
            { x: 0, y: 0, z: 0 },
            { x: SUSPENSION.hubInertia, y: SUSPENSION.hubInertia, z: SUSPENSION.hubInertia },
            { x: 0, y: 0, z: 0, w: 1 },
          )
          .setCanSleep(false),
      );
      const springData = RAPIER.JointData.prismatic({ x: anchor[0], y: anchor[1], z: anchor[2] }, { x: 0, y: 0, z: 0 }, up);
      springData.limitsEnabled = true;
      springData.limits = [-SUSPENSION.travelDown * scale, SUSPENSION.travelUp * scale];
      const spring = this.world.createImpulseJoint(springData, host.body, hub, true) as RAPIER.PrismaticImpulseJoint;
      // The spring constant (N/m) is fixed by the strength (stiffness x a reference load), so the more mass a wheel carries
      // the more it sinks. The damping follows the actual load, so a heavy body is not left bouncing.
      const load = host.body.mass() / (wheelsOn.get(host.body) ?? 1);
      const springConstant = suspensionStiffness(suspensionOf(wheel)) * SUSPENSION.referenceLoad;
      spring.configureMotorModel(RAPIER.MotorModel.ForceBased);
      spring.configureMotorPosition(-SUSPENSION.rideHeight * scale, springConstant, 2 * SUSPENSION.dampingRatio * Math.sqrt(springConstant * load));

      const joint = this.world.createImpulseJoint(
        RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, axis),
        hub,
        body,
        true,
      ) as RAPIER.RevoluteImpulseJoint;
      this.wheels.push({ joint, axis: axle, cell: centre, speed: tireOf(wheel).speed * sizeSpeed, torque: tireOf(wheel).torque * sizeTorque, cruise,
        engines: grid.engineDrive ? (enginesOfBody.get(host.body) ?? []) : null,
        wheelCount: wheelsOn.get(host.body) ?? 1,
        turbos: boostOfBody.get(host.body) ?? [],
        brake: brakeOf(wheel) / BRAKE.default,
        part: wheel,
      });

      // The wheel (with its brake disc, which turns with it) follows the wheel body; the caliper follows the hub, so it
      // stays on the suspension while the wheel spins.
      const obj = createPartObject(wheel, undefined, { caliper: false });
      this.group.add(obj);
      this.pairs.push({ body, object: obj });
      const caliper = createCaliperObject(wheel);
      this.group.add(caliper);
      this.pairs.push({ body: hub, object: caliper });
    }

    this.buildWingControls();
    this.buildGroundSensors();
  }

  /**
   * How each wing answers the pitch, roll and yaw keys (see `WING.controlArm`): the frame of each body that has wings (the way its wings
   * lead, `forward`, and their up, area-weighted), and for every wing, for each of the three turns, how much its lift has to change to
   * make the body turn that way: the torque of a change of lift `up` at the wing's place about the centre of mass, along the axis of
   * the turn (nose up: `right`; roll right: `forward`; yaw right: down), over `controlArm`, from -1 (the control surface moves the
   * other way) to 1. A wing near the centre of mass changes nothing, so every wing can be given the same keys and each does its part.
   */
  private buildWingControls(): void {
    const frames = new Map<RAPIER.RigidBody, { forward: THREE.Vector3; up: THREE.Vector3 }>();
    for (const wing of this.wings) {
      const frame = frames.get(wing.body) ?? { forward: new THREE.Vector3(), up: new THREE.Vector3() };
      this.wingFrames.set(wing.body, { forward: frame.forward, area: (this.wingFrames.get(wing.body)?.area ?? 0) + wing.area });
      frame.forward.addScaledVector(new THREE.Vector3(...wing.front), wing.area);
      frame.up.addScaledVector(new THREE.Vector3(...wing.up), wing.area);
      frames.set(wing.body, frame);
    }
    for (const frame of frames.values()) {
      frame.forward.normalize();
      frame.up.addScaledVector(frame.forward, -frame.up.dot(frame.forward));
      if (frame.up.lengthSq() < 1e-6) frame.up.set(0, 1, 0).addScaledVector(frame.forward, -frame.forward.y);
      frame.up.normalize();
    }
    for (const wing of this.wings) {
      const { forward, up } = frames.get(wing.body)!;
      const right = forward.clone().cross(up);
      const com = wing.body.localCom();
      const arm = new THREE.Vector3(...wing.point).sub(new THREE.Vector3(com.x, com.y, com.z));
      const torque = arm.cross(new THREE.Vector3(...wing.up)); // of one unit of lift at the wing
      const clamp = (v: number) => Math.max(-1, Math.min(1, v / WING.controlArm));
      wing.pitch = clamp(torque.dot(right));
      wing.roll = clamp(torque.dot(forward));
      wing.yaw = clamp(-torque.dot(up));
    }
  }
}
