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
  FLIGHT,
  ROTOR,
  ROTOR_BODY,
  ROTOR_VISUAL,
  THRUSTER,
  TURBO,
  VEHICLE,
  brakeOf,
  ROUGHNESS,
  SCENERY,
  SPAWN_CLEARANCE,
  SPAWN_LIFT,
  SUSPENSION,
  WHEEL,
  WORLD,
  GROUND_Y,
  hexToNumber,
  powerOf,
  rotorSpeedOf,
  suspensionOf,
  suspensionStiffness,
  tireOf,
  weightMass,
  weightOf,
  wheelSizeOf,
} from '../constants';
import { createCaliperObject, createPartObject, createRotorBaseObject, createRotorHeadObject, faceQuaternion, rotorCentres } from '../parts/part-defs';
import { partBox, relativeBoxes, studsEngaged } from '../parts/part-geometry';
import { EngineFx, PlayEffects, ThrusterFx, TurboFx, WheelFx } from './play-effects';
import { Part, Vec3, axleOf, cellKey, frontOf, isCompactMounted, isStructural, isWheelType, partCentre, subVec } from '../types';

const { ground: GROUND, chassis: CHASSIS_GROUP, wheel: WHEEL_GROUP } = COLLISION_GROUP;
const groups = (member: number, filter: number): number => (member << 16) | filter;


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
  engines: Array<{ front: Vec3; power: number }> | null;
  /** How many wheels are mounted on the same body (the engines' power is shared among them). */
  wheelCount: number;
  /** The boost of the turbos on this wheel's body, 0 with none, in units of one default turbo (capped by `TURBO.maxBoost`): what `Shift` adds. */
  boost: number;
  /** This wheel's brake strength over the default (`BRAKE`), 0 when it has no brake: what it is held with while Space is pressed. */
  brake: number;
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
  /** What the player asks of a flying vehicle, each -1 to 1 (see `VehicleController.pilot` and `FLIGHT`). */
  pilot = { pitch: 0, roll: 0, yaw: 0 };
  /** Has the vehicle left the ground (see `FLIGHT`)? Recomputed every step. */
  airborne = false;
  /** Is the boost key held (see `VehicleController.boosting`)? The turbos' flames follow it. */
  boosting = false;
  /** Is the thrust key held (Space, see `VehicleController.thrusting`)? The thrusters push and fire while it is. */
  thrusting = false;
  /** The throttle (W / S, -1 to 1, see `VehicleController.throttle`): the engines' push on the body follows it. */
  throttle = 0;
  /** Are the rotors switched on (F, see `VehicleController.rotating`)? */
  rotating = false;

  private world = new RAPIER.World({ x: 0, y: WORLD.gravity, z: 0 });
  private pairs: SyncPair[] = [];
  private accumulator = 0;
  private wheelFx: WheelFx[] = [];
  private engineFx: EngineFx[] = [];
  private turboFx: TurboFx[] = [];
  private thrusterFx: ThrusterFx[] = [];
  /** The thrusters: the body each pushes, where (in the body's frame), along which direction and with what force. */
  private thrusters: Array<{ body: RAPIER.RigidBody; point: Vec3; direction: Vec3; thrust: number }> = [];
  /** The engines: the body each is mounted on, where (in the body's frame), where it faces and its power (see `ENGINE.leverage`). */
  private pushers: Array<{ body: RAPIER.RigidBody; point: Vec3; front: Vec3; power: number }> = [];
  /** The direction the vehicle drives in (in the body's frame), the same one the vehicle controller uses. */
  private forward = new THREE.Vector3(0, 0, -1);
  /** The rotors: the hinge between the body of the block and the head (with what it holds) and the signed speed it is driven to (rad/s). */
  private rotors: Array<{ joint: RAPIER.RevoluteImpulseJoint; target: number }> = [];
  private effects: PlayEffects;
  /** The bodies that carry wheels: the ones the straightening assist acts on. */
  private chassis = new Set<RAPIER.RigidBody>();
  /** The heading each of those bodies holds while the player does not steer (see `straighten`). */
  private heldYaw = new Map<RAPIER.RigidBody, number>();
  /** The bodies of the vehicle that can be flown (the ones that carry wheels or thrusters), where each one's nose is, and the colliders that tell whether it touches the ground. */
  private craft = new Set<RAPIER.RigidBody>();
  private noses = new Map<RAPIER.RigidBody, THREE.Vector3>();
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
   * mounted, along its direction turned by the body's rotation (nothing while the thrust key is not held).
   */
  private applyThrust(): void {
    const q = new THREE.Quaternion();
    // A force applied at a point also adds a torque, and Rapier keeps both until they are reset: clear both, or the torque of a
    // thruster that is off the centre would go on spinning the body after the key is released.
    for (const body of new Set([...this.thrusters, ...this.pushers].map((t) => t.body))) {
      body.resetForces(true);
      body.resetTorques(true);
    }
    this.applyEngines(q);
    if (!this.thrusting) return;
    for (const t of this.thrusters) {
      const r = t.body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      const direction = new THREE.Vector3(...t.direction).applyQuaternion(q).multiplyScalar(t.thrust);
      const position = t.body.translation();
      const point = new THREE.Vector3(...t.point).applyQuaternion(q).add(new THREE.Vector3(position.x, position.y, position.z));
      t.body.addForceAtPoint({ x: direction.x, y: direction.y, z: direction.z }, { x: point.x, y: point.y, z: point.z }, true);
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
    if (this.airborne || this.throttle === 0) return;
    for (const e of this.pushers) {
      if (!this.chassis.has(e.body)) continue;
      const front = new THREE.Vector3(...e.front);
      if (Math.abs(front.dot(this.forward)) < 0.5) continue;
      const r = e.body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      const com = e.body.worldCom();
      const position = e.body.translation();
      const arm = new THREE.Vector3(...e.point).applyQuaternion(q).add(new THREE.Vector3(position.x, position.y, position.z)).sub(new THREE.Vector3(com.x, com.y, com.z));
      const push = front.applyQuaternion(q).multiplyScalar(ENGINE.leverage * e.body.mass() * (e.power / ENGINE.default) * this.throttle);
      const torque = arm.cross(push);
      e.body.addTorque({ x: torque.x, y: torque.y, z: torque.z }, true);
    }
  }

  /** Air drag (see `VEHICLE.airDrag`): an impulse against the velocity of every body that carries wheels, growing with the square of the speed above `VEHICLE.dragFreeSpeed`. */
  private drag(dt: number): void {
    for (const body of this.chassis) {
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
      if (this.rotating) rotor.joint.configureMotorVelocity(rotor.target, ROTOR.strength);
      else rotor.joint.configureMotorVelocity(0, ROTOR.idleDamping);
    }
  }

  step(dt: number): void {
    this.applyThrust();
    this.driveRotors();
    this.accumulator = Math.min(this.accumulator + dt, WORLD.maxFrameTime);
    this.airborne = this.craft.size > 0 && !this.touchingGround();
    while (this.accumulator >= WORLD.step) {
      this.fly(WORLD.step);
      this.straighten();
      this.drag(WORLD.step);
      this.world.step();
      this.accumulator -= WORLD.step;
    }
    this.sync();
    this.effects.update(dt, this.level, this.boosting, this.thrusting);
  }

  dispose(): void {
    this.effects.dispose();
    this.world.free();
    this.group.clear();
  }

  private sync(): void {
    for (const { body, object } of this.pairs) {
      const t = body.translation();
      const r = body.rotation();
      object.position.set(t.x, t.y, t.z);
      object.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /**
   * Prepares flying (see `FLIGHT`): the bodies that can be flown, where each one's nose is (the sum of where its horizontal thrusters push,
   * else of where its engines push, else the way the wheels roll, else -z, all in the body's frame) and the colliders whose contacts with
   * the ground say whether it has left it.
   */
  private buildFlight(enginesOfBody: Map<RAPIER.RigidBody, Array<{ front: Vec3; power: number }>>): void {
    for (const t of this.thrusters) this.craft.add(t.body);
    for (const body of this.chassis) this.craft.add(body);
    const onX = this.wheels.filter((w) => w.axis[0] !== 0).length;
    const rolling = new THREE.Vector3(...(onX >= this.wheels.length - onX ? [0, 0, -1] : [1, 0, 0]));
    this.forward.copy(rolling);
    for (const body of this.craft) {
      const nose = new THREE.Vector3();
      // Only the thrusters that push sideways count (a plane's engines, not the ones that lift it).
      for (const t of this.thrusters) if (t.body === body && Math.abs(t.direction[1]) < 0.5) nose.add(new THREE.Vector3(...t.direction));
      if (nose.length() < 0.1) for (const e of enginesOfBody.get(body) ?? []) nose.add(new THREE.Vector3(...e.front));
      if (nose.length() < 0.1) nose.copy(rolling);
      this.noses.set(body, nose.normalize());
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

  /**
   * Flying (see `FLIGHT`): while the vehicle is in the air the pilot's input turns it around its pitch, roll and yaw axes (the
   * angular velocity is changed directly, whatever the shape or mass of the vehicle), and without input its rotation fades.
   */
  private fly(dt: number): void {
    if (!this.airborne) return;
    const q = new THREE.Quaternion();
    const { pitch, roll, yaw } = this.pilot;
    for (const body of this.craft) {
      const r = body.rotation();
      q.set(r.x, r.y, r.z, r.w);
      const nose = this.noses.get(body)!.clone().applyQuaternion(q);
      // The body's own up (the nose's neighbour that is most upright in the body's frame), then right = nose x up.
      let up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      if (Math.abs(up.dot(nose)) > 0.9) up = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const right = new THREE.Vector3().crossVectors(nose, up).normalize();
      up.crossVectors(right, nose).normalize();
      const v = body.linvel();
      const authority = Math.min(1, FLIGHT.minAuthority + (1 - FLIGHT.minAuthority) * (Math.hypot(v.x, v.y, v.z) / FLIGHT.authoritySpeed));
      const w = body.angvel();
      const spin = new THREE.Vector3(w.x, w.y, w.z);
      if (pitch === 0 && roll === 0 && yaw === 0) {
        spin.multiplyScalar(Math.exp(-FLIGHT.damping * dt));
      } else {
        // Positive about the right axis lifts the nose, about the nose banks to the right, about up yaws to the left.
        spin.addScaledVector(right, -pitch * FLIGHT.rate * authority * dt);
        spin.addScaledVector(nose, roll * FLIGHT.rate * authority * dt);
        spin.addScaledVector(up, -yaw * FLIGHT.rate * authority * dt);
        if (spin.length() > FLIGHT.maxRate) spin.setLength(FLIGHT.maxRate);
      }
      body.setAngvel({ x: spin.x, y: spin.y, z: spin.z }, true);
    }
  }

  private buildScenery(): void {
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(GROUND_COLLIDER.halfExtent, GROUND_COLLIDER.halfThickness, GROUND_COLLIDER.halfExtent)
        .setTranslation(0, GROUND_COLLIDER.centerY, 0)
        .setCollisionGroups(groups(GROUND, 0xffff))
        .setFriction(GROUND_COLLIDER.friction),
    );
    for (const { halfExtents: half, position: pos, tiltDeg, color } of SCENERY) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(tiltDeg), 0, 0));
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(...pos).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(...half).setCollisionGroups(groups(GROUND, 0xffff)).setFriction(1),
        body,
      );
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2),
        new THREE.MeshStandardMaterial({ color: hexToNumber(color), roughness: ROUGHNESS.scenery }),
      );
      mesh.position.set(...pos);
      mesh.quaternion.copy(q);
      mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  /**
   * The rotors (see `ROTOR`): the base is a compact collider on the body of its block; the head is a plate collider on the body of the
   * parts welded to its studs (their component, or a small body of its own when nothing is on it), and a hinge along the axis of the
   * face joins that body to the block's, with the contacts between the two off (the head sits on the base and a blade may sweep past
   * the block). When the head's parts are welded to the block's too, they are one body and the rotor is just rigid.
   */
  private buildRotors(
    parts: Part[],
    bodyOfBlock: Map<string, { body: RAPIER.RigidBody; origin: Vec3; visual: THREE.Group }>,
    lift: number,
  ): void {
    const blocks = parts.filter((p) => isStructural(p.type));
    for (const rotor of parts.filter((p) => p.type === 'rotor' && p.face)) {
      const host = bodyOfBlock.get(cellKey(subVec(rotor.cell, rotor.face!)));
      if (!host) continue;
      const face = rotor.face!;
      const axisIndex = face.findIndex((v) => v !== 0);
      const centres = rotorCentres(rotor);
      /** Half sizes of a slab `depth` thick along the axis and `width` across it. */
      const halves = (depth: number, width: number): Vec3 => [0, 1, 2].map((i) => (i === axisIndex ? depth : width) / 2) as Vec3;

      // The base stays with the block.
      const baseHalf = halves(ROTOR_VISUAL.baseDepth, ROTOR_VISUAL.flangeRadius * 2);
      const baseLocal = subVec(centres.base, host.origin);
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(...baseHalf)
          .setTranslation(...baseLocal)
          .setDensity((CHASSIS.density * ROTOR.mass) / (8 * baseHalf[0] * baseHalf[1] * baseHalf[2]))
          .setFriction(CHASSIS.friction)
          .setCollisionGroups(groups(CHASSIS_GROUP, GROUND | CHASSIS_GROUP)),
        host.body,
      );
      const baseObject = createRotorBaseObject(rotor);
      baseObject.position.set(...baseLocal);
      host.visual.add(baseObject);

      // The head goes with the parts on its studs.
      const held = new Map<RAPIER.RigidBody, { body: RAPIER.RigidBody; origin: Vec3; visual: THREE.Group }>();
      for (const block of blocks) {
        if (studsEngaged(rotor, block) === 0) continue;
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
      const turned = faceQuaternion(face); // the cylinder's axis (Y) along the rotor's axis
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(ROTOR_VISUAL.headDepth / 2, ROTOR_VISUAL.headRadius)
          .setRotation({ x: turned.x, y: turned.y, z: turned.z, w: turned.w })
          .setTranslation(...headLocal)
          .setDensity(CHASSIS.density)
          .setFriction(CHASSIS.friction)
          .setCollisionGroups(groups(CHASSIS_GROUP, GROUND | CHASSIS_GROUP)),
        head.body,
      );
      const headObject = createRotorHeadObject(rotor);
      headObject.position.set(...headLocal);
      head.visual.add(headObject);
      // Parts on the head that are not in the same body as the first one (it is rare: two stacks on one head) are fixed to it.
      for (const other of held.values()) {
        if (other.body === head.body) continue;
        const offset = subVec(other.origin, head.origin);
        this.world.createImpulseJoint(RAPIER.JointData.fixed({ x: offset[0], y: offset[1], z: offset[2] }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }), head.body, other.body, true);
      }

      if (head.body === host.body) continue; // welded to the block: it cannot turn
      const pivot = subVec(centres.head, host.origin);
      const joint = this.world.createImpulseJoint(
        RAPIER.JointData.revolute(
          { x: pivot[0], y: pivot[1], z: pivot[2] },
          { x: headLocal[0], y: headLocal[1], z: headLocal[2] },
          { x: face[0], y: face[1], z: face[2] },
        ),
        host.body,
        head.body,
        true,
      ) as RAPIER.RevoluteImpulseJoint;
      joint.setContactsEnabled(false);
      // Positive speed is clockwise seen from the head: the other way round about the axis (right-handed), which points out of the block.
      this.rotors.push({ joint, target: (-rotorSpeedOf(rotor) / ROTOR.max) * ROTOR.maxSpeed });
    }
  }

  private buildCreation(grid: Grid): void {
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
    const enginesOfBody = new Map<RAPIER.RigidBody, Array<{ front: Vec3; power: number }>>();
    /** The boost of the turbos of each body, in units of one turbo of the default strength. */
    const boostOfBody = new Map<RAPIER.RigidBody, number>();
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
        for (const box of relativeBoxes(p)) {
          const half = box.max.map((v, i) => (v - box.min[i]) / 2);
          this.world.createCollider(
            RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2])
              .setTranslation(local[0] + (box.min[0] + box.max[0]) / 2, local[1] + (box.min[1] + box.max[1]) / 2, local[2] + (box.min[2] + box.max[2]) / 2)
              .setDensity(CHASSIS.density * weightMass(weightOf(p)))
              .setFriction(CHASSIS.friction)
              .setCollisionGroups(groups(CHASSIS_GROUP, GROUND | CHASSIS_GROUP)),
            body,
          );
        }
        const obj = createPartObject(p);
        obj.position.set(...local);
        visual.add(obj);
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
    for (const engine of parts.filter((p) => isCompactMounted(p.type) && p.type !== 'rotor' && p.face)) {
      const host = bodyOfBlock.get(cellKey(subVec(engine.cell, engine.face!)));
      if (!host) continue;
      const box = partBox(engine);
      const half = box.max.map((v, i) => (v - box.min[i]) / 2);
      const local = subVec(partCentre(engine), host.origin);
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(half[0], half[1], half[2])
          .setTranslation(...local)
          .setDensity((CHASSIS.density * (engine.type === 'engine' ? ENGINE.mass : TURBO.mass)) / (8 * half[0] * half[1] * half[2]))
          .setFriction(CHASSIS.friction)
          .setCollisionGroups(groups(CHASSIS_GROUP, GROUND | CHASSIS_GROUP)),
        host.body,
      );
      const obj = createPartObject(engine);
      obj.position.set(...local);
      host.visual.add(obj);
      if (engine.type === 'thruster') {
        this.thrusters.push({ body: host.body, point: local, direction: frontOf(engine), thrust: (THRUSTER.thrust * powerOf(engine)) / ENGINE.default });
        this.thrusterFx.push({ object: obj });
        continue;
      }
      if (engine.type === 'turbo') {
        boostOfBody.set(host.body, (boostOfBody.get(host.body) ?? 0) + powerOf(engine) / ENGINE.default);
        this.turboFx.push({ object: obj });
        continue;
      }
      this.pushers.push({ body: host.body, point: local, front: frontOf(engine), power: powerOf(engine) });
      this.engineFx.push({ body: host.body, object: obj, position: obj.position.clone(), quaternion: obj.quaternion.clone() });
      enginesOfBody.set(host.body, [...(enginesOfBody.get(host.body) ?? []), { front: frontOf(engine), power: powerOf(engine) }]);
    }

    this.buildRotors(parts, bodyOfBlock, lift);

    // Each wheel is its own body, spinning on a motorised hinge. The hinge is carried by a light "hub" body that hangs from
    // the block the wheel is mounted on by a vertical spring (the suspension): chassis -spring- hub -hinge- wheel.
    const up = { x: 0, y: 1, z: 0 };
    // The spring must carry the chassis: its force is scaled by the mass each wheel of that body supports.
    const wheelsOn = new Map<RAPIER.RigidBody, number>();
    for (const wheel of wheelParts) {
      const host = bodyOfBlock.get(cellKey(subVec(wheel.cell, wheel.face!)));
      if (host) {
        wheelsOn.set(host.body, (wheelsOn.get(host.body) ?? 0) + 1);
        this.chassis.add(host.body);
      }
    }
    for (const wheel of wheelParts) {
      // `face` is where the wheel is mounted (its host block); the axle comes from its rotation (or is the face normal).
      const host = bodyOfBlock.get(cellKey(subVec(wheel.cell, wheel.face!)));
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
        boost: Math.min(TURBO.maxBoost, boostOfBody.get(host.body) ?? 0),
        brake: brakeOf(wheel) / BRAKE.default,
      });

      // The wheel (with the disc of its brake, which turns with it) follows the wheel body; the caliper follows the hub, so it
      // stays on the suspension while the wheel spins.
      const obj = createPartObject(wheel, undefined, { caliper: false });
      this.group.add(obj);
      this.pairs.push({ body, object: obj });
      if (brakeOf(wheel) > 0) {
        const caliper = createCaliperObject(wheel);
        this.group.add(caliper);
        this.pairs.push({ body: hub, object: caliper });
      }
    }

    this.buildFlight(enginesOfBody);
  }
}
