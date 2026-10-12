import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Grid } from '../build/grid';
import {
  CELL_SIZE,
  CHASSIS,
  COLLISION_GROUP,
  GROUND_COLLIDER,
  ROUGHNESS,
  SCENERY,
  SPAWN_LIFT,
  SUSPENSION,
  WHEEL,
  WORLD,
  hexToNumber,
  suspensionOf,
  suspensionStiffness,
} from '../constants';
import { createPartObject, faceQuaternion } from '../parts/part-defs';
import { Part, Vec3, cellKey, subVec, wheelAxle } from '../types';

const { ground: GROUND, chassis: CHASSIS_GROUP, wheel: WHEEL_GROUP } = COLLISION_GROUP;
const groups = (member: number, filter: number): number => (member << 16) | filter;


export interface WheelDrive {
  joint: RAPIER.RevoluteImpulseJoint;
  axis: Vec3;
  cell: Vec3;
}

interface SyncPair {
  body: RAPIER.RigidBody;
  object: THREE.Object3D;
}

export class PhysicsWorld {
  readonly group = new THREE.Group();
  readonly wheels: WheelDrive[] = [];
  focus: RAPIER.RigidBody | null = null;

  private world = new RAPIER.World({ x: 0, y: WORLD.gravity, z: 0 });
  private pairs: SyncPair[] = [];
  private accumulator = 0;

  constructor(grid: Grid) {
    this.buildScenery();
    this.buildCreation(grid);
    this.sync();
  }

  step(dt: number): void {
    this.accumulator = Math.min(this.accumulator + dt, WORLD.maxFrameTime);
    while (this.accumulator >= WORLD.step) {
      this.world.step();
      this.accumulator -= WORLD.step;
    }
    this.sync();
  }

  dispose(): void {
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

  private buildCreation(grid: Grid): void {
    const parts = grid.all();
    const blocks = parts.filter((p) => p.type === 'block');
    const seen = new Set<string>();
    const bodyOfBlock = new Map<string, { body: RAPIER.RigidBody; origin: Vec3 }>();
    let biggest = 0;

    // Connected blocks become ONE rigid body with a collider per block (keeps the structure stiff).
    for (const start of blocks) {
      if (seen.has(cellKey(start.cell))) continue;
      const comp: Part[] = [];
      const queue = [start];
      seen.add(cellKey(start.cell));
      while (queue.length) {
        const cur = queue.pop()!;
        comp.push(cur);
        for (const n of grid.neighbors(cur.cell)) {
          if (n.type === 'block' && !seen.has(cellKey(n.cell))) {
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
          .setTranslation(origin[0], origin[1] + SPAWN_LIFT, origin[2])
          .setCanSleep(false),
      );
      const visual = new THREE.Group();
      for (const p of comp) {
        const local = subVec(p.cell, origin);
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 2)
            .setTranslation(...local)
            .setDensity(CHASSIS.density)
            .setFriction(CHASSIS.friction)
            .setCollisionGroups(groups(CHASSIS_GROUP, GROUND | CHASSIS_GROUP)),
          body,
        );
        const obj = createPartObject(p);
        obj.position.set(...local);
        visual.add(obj);
        bodyOfBlock.set(cellKey(p.cell), { body, origin });
      }
      this.group.add(visual);
      this.pairs.push({ body, object: visual });
      if (comp.length > biggest) {
        biggest = comp.length;
        this.focus = body;
      }
    }

    // Each wheel is its own body, spinning on a motorised hinge. The hinge is carried by a light "hub" body that hangs from
    // the block the wheel is mounted on by a vertical spring (the suspension): chassis -spring- hub -hinge- wheel.
    const up = { x: 0, y: 1, z: 0 };
    // The spring must carry the chassis: its force is scaled by the mass each wheel of that body supports.
    const wheelsOn = new Map<RAPIER.RigidBody, number>();
    for (const wheel of parts.filter((p) => p.type === 'wheel' && p.face)) {
      const host = bodyOfBlock.get(cellKey(subVec(wheel.cell, wheel.face!)));
      if (host) wheelsOn.set(host.body, (wheelsOn.get(host.body) ?? 0) + 1);
    }
    for (const wheel of parts.filter((p) => p.type === 'wheel' && p.face)) {
      // `face` is where the wheel is mounted (its host block); the axle comes from its rotation.
      const host = bodyOfBlock.get(cellKey(subVec(wheel.cell, wheel.face!)));
      const axle = wheelAxle(wheel);
      if (!host) continue;

      const q = faceQuaternion(axle);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(wheel.cell[0], wheel.cell[1] + SPAWN_LIFT, wheel.cell[2])
          .setCanSleep(false),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(WHEEL.width / 2, WHEEL.radius)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setDensity(WHEEL.density)
          .setFriction(WHEEL.friction)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
          .setCollisionGroups(groups(WHEEL_GROUP, GROUND)),
        body,
      );
      const axis = { x: axle[0], y: axle[1], z: axle[2] };
      const anchor = subVec(wheel.cell, host.origin);

      const hub = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(wheel.cell[0], wheel.cell[1] + SPAWN_LIFT, wheel.cell[2])
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
      springData.limits = [-SUSPENSION.travelDown, SUSPENSION.travelUp];
      const spring = this.world.createImpulseJoint(springData, host.body, hub, true) as RAPIER.PrismaticImpulseJoint;
      // Spring constant (N/m) = stiffness (1/s², from the strength) x the mass this wheel supports; damping from the damping ratio.
      const load = host.body.mass() / (wheelsOn.get(host.body) ?? 1);
      const stiffness = suspensionStiffness(suspensionOf(wheel));
      spring.configureMotorModel(RAPIER.MotorModel.ForceBased);
      spring.configureMotorPosition(0, stiffness * load, 2 * SUSPENSION.dampingRatio * Math.sqrt(stiffness) * load);

      const joint = this.world.createImpulseJoint(
        RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, axis),
        hub,
        body,
        true,
      ) as RAPIER.RevoluteImpulseJoint;
      this.wheels.push({ joint, axis: axle, cell: wheel.cell });

      const obj = createPartObject(wheel);
      this.group.add(obj);
      this.pairs.push({ body, object: obj });
    }
  }
}
