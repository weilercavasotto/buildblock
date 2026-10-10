import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { Grid } from '../build/grid';
import { WHEEL_RADIUS, WHEEL_WIDTH, createPartObject, faceQuaternion } from '../parts/part-defs';
import { Part, Vec3, cellKey, subVec } from '../types';

const GROUND = 1;
const CHASSIS = 2;
const WHEEL = 4;
const groups = (member: number, filter: number): number => (member << 16) | filter;

/** Vertical offset at spawn so the (taller than a cell) wheels do not start inside the floor. */
const SPAWN_LIFT = WHEEL_RADIUS - 0.5 + 0.05;
const STEP = 1 / 60;

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

  private world = new RAPIER.World({ x: 0, y: -15, z: 0 });
  private pairs: SyncPair[] = [];
  private accumulator = 0;

  constructor(grid: Grid) {
    this.buildScenery();
    this.buildCreation(grid);
    this.sync();
  }

  step(dt: number): void {
    this.accumulator = Math.min(this.accumulator + dt, 0.1);
    while (this.accumulator >= STEP) {
      this.world.step();
      this.accumulator -= STEP;
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
      RAPIER.ColliderDesc.cuboid(200, 0.5, 200)
        .setTranslation(0, -1, 0)
        .setCollisionGroups(groups(GROUND, 0xffff))
        .setFriction(1),
    );
    const addStatic = (half: Vec3, pos: Vec3, rotX: number, color: number) => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, 0, 0));
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(...pos).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(...half).setCollisionGroups(groups(GROUND, 0xffff)).setFriction(1),
        body,
      );
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2),
        new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
      );
      mesh.position.set(...pos);
      mesh.quaternion.copy(q);
      mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    const tilt = THREE.MathUtils.degToRad(15);
    addStatic([3, 0.25, 4], [0, 0.3, -16], tilt, 0x8a6f4d);
    addStatic([2.5, 0.25, 3], [14, 0.1, -10], tilt, 0x6f8a4d);
    addStatic([6, 0.5, 0.5], [-10, -0.25, -6], 0, 0x4d6f8a);
    addStatic([6, 0.5, 0.5], [-10, -0.25, -9], 0, 0x4d6f8a);
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
          RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
            .setTranslation(...local)
            .setDensity(1)
            .setFriction(0.6)
            .setCollisionGroups(groups(CHASSIS, GROUND | CHASSIS)),
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

    // Each wheel is its own body, attached to the block it is mounted on by a motorised hinge.
    for (const wheel of parts.filter((p) => p.type === 'wheel' && p.face)) {
      const face = wheel.face!;
      const host = bodyOfBlock.get(cellKey(subVec(wheel.cell, face)));
      if (!host) continue;

      const q = faceQuaternion(face);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(wheel.cell[0], wheel.cell[1] + SPAWN_LIFT, wheel.cell[2])
          .setCanSleep(false),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(WHEEL_WIDTH / 2, WHEEL_RADIUS)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setDensity(1)
          .setFriction(2.5)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max)
          .setCollisionGroups(groups(WHEEL, GROUND)),
        body,
      );
      const axis = { x: face[0], y: face[1], z: face[2] };
      const anchor = subVec(wheel.cell, host.origin);
      const joint = this.world.createImpulseJoint(
        RAPIER.JointData.revolute({ x: anchor[0], y: anchor[1], z: anchor[2] }, { x: 0, y: 0, z: 0 }, axis),
        host.body,
        body,
        true,
      ) as RAPIER.RevoluteImpulseJoint;
      this.wheels.push({ joint, axis: face, cell: wheel.cell });

      const obj = createPartObject(wheel);
      this.group.add(obj);
      this.pairs.push({ body, object: obj });
    }
  }
}
