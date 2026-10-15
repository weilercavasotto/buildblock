import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { COLLISION_GROUP, COLORS, FX, hexToNumber } from '../constants';
import { ParticleSystem } from './particles';

/** A wheel the effects follow: its body, its size and its axle (in the body's own frame, where the joint's axis is given). */
export interface WheelFx {
  body: RAPIER.RigidBody;
  radius: number;
  width: number;
  axle: THREE.Vector3;
}

/** An engine the effects follow: its visual and where / how it sits when it is not shaking. */
export interface EngineFx {
  /** The body the engine is on (its speed sets how much it smokes). */
  body: RAPIER.RigidBody;
  object: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

const range = ([low, high]: readonly [number, number]): number => low + Math.random() * (high - low);
const pickColour = (hexes: readonly string[]): THREE.Color => new THREE.Color(hexToNumber(hexes[Math.floor(Math.random() * hexes.length)]));

/**
 * Effects of Play mode, drawn into `group`: earth thrown up by the wheels that grip the ground, smoke from the engines and the
 * shaking of a running engine (all tuned through `FX`). `level` (0-1) says how hard the vehicle is being driven.
 */
export class PlayEffects {
  readonly group = new THREE.Group();
  private dust = new ParticleSystem(FX.dust.max, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), FX.dust.gravity, FX.dust.drag);
  private smoke = new ParticleSystem(FX.smoke.max, new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.65, depthWrite: false }), -0.3, FX.smoke.drag);
  /** Particles still owed to each wheel / engine (the fractions of a particle that did not fit in a frame). */
  private wheelDebt: number[];
  private engineDebt: number[];
  private time = 0;
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

  constructor(
    private world: RAPIER.World,
    private wheels: WheelFx[],
    private engines: EngineFx[],
  ) {
    this.wheelDebt = wheels.map(() => 0);
    this.engineDebt = engines.map(() => 0);
    this.group.add(this.dust.mesh, this.smoke.mesh);
  }

  update(dt: number, level: number): void {
    this.time += dt;
    this.wheels.forEach((wheel, i) => this.emitDust(wheel, i, dt));
    this.engines.forEach((engine, i) => this.runEngine(engine, i, dt, level));
    this.dust.update(dt);
    this.smoke.update(dt);
  }

  dispose(): void {
    this.dust.dispose();
    this.smoke.dispose();
    this.group.clear();
  }

  /** A wheel that touches the ground and moves (or spins) throws up earth, more the faster it goes and the more it slips. */
  private emitDust(wheel: WheelFx, index: number, dt: number): void {
    const t = wheel.body.translation();
    const v = wheel.body.linvel();
    const speed = Math.hypot(v.x, v.z);
    const r = wheel.body.rotation();
    const axleWorld = wheel.axle.clone().applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
    const w = wheel.body.angvel();
    const spin = Math.abs(w.x * axleWorld.x + w.y * axleWorld.y + w.z * axleWorld.z) * wheel.radius;
    if (speed < FX.dust.minSpeed && spin < FX.dust.minSpeed) return;
    // Only a wheel on the ground (anything of the scenery below it, within a wheel radius).
    this.ray.origin = { x: t.x, y: t.y, z: t.z };
    const hit = this.world.castRay(this.ray, wheel.radius + 0.15, true, undefined, (0xffff << 16) | COLLISION_GROUP.ground);
    if (!hit) return;

    // How strong the effect is, 0-1.5 (1 = the configured values, at `FX.dust.maxSpeed`): the rate, and how big and lively each clod is.
    const intensity = Math.min(1.5, (speed + Math.max(0, spin - speed) * FX.dust.slip) / FX.dust.maxSpeed);
    const scale = THREE.MathUtils.lerp(FX.dust.scaleMin, 1, Math.min(1, intensity));
    this.wheelDebt[index] += FX.dust.rate * intensity * dt;
    const moving = speed > 0.3 ? new THREE.Vector3(v.x / speed, 0, v.z / speed) : null;
    while (this.wheelDebt[index] >= 1) {
      this.wheelDebt[index] -= 1;
      const along = (Math.random() - 0.5) * wheel.width;
      const position = new THREE.Vector3(t.x, t.y - wheel.radius * 0.9, t.z).addScaledVector(axleWorld, along);
      // Thrown backwards and up, with a little sideways scatter.
      const velocity = new THREE.Vector3((Math.random() - 0.5) * FX.dust.spread * scale, range(FX.dust.lift) * scale, (Math.random() - 0.5) * FX.dust.spread * scale);
      if (moving) velocity.addScaledVector(moving, -speed * FX.dust.back * Math.random());
      const size = range(FX.dust.size) * scale;
      this.dust.spawn({ position, velocity, life: range(FX.dust.life), sizeStart: size * 0.6, sizeEnd: size, colour: pickColour(COLORS.fx.dust) });
    }
  }

  /** Shakes the engine and lets its exhaust puff: a little at idle, a lot while the vehicle is driven. */
  private runEngine(engine: EngineFx, index: number, dt: number, level: number): void {
    const amount = THREE.MathUtils.lerp(FX.vibration.idle, FX.vibration.driving, level);
    const w = this.time * FX.vibration.frequency * Math.PI * 2;
    engine.object.position.set(
      engine.position.x + Math.sin(w) * amount,
      engine.position.y + Math.sin(w * 1.13 + 1.7) * amount,
      engine.position.z + Math.sin(w * 0.87 + 3.1) * amount,
    );
    const tilt = FX.vibration.tilt * (0.3 + 0.7 * level);
    engine.object.quaternion.copy(engine.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(w * 1.3) * tilt, Math.sin(w * 0.9 + 1) * tilt, Math.sin(w * 1.1 + 2) * tilt)));

    // How strong the smoke is, 0-1 (1 = the configured values, at `FX.smoke.maxSpeed`): the vehicle's speed, or what the throttle alone gives.
    const v = engine.body.linvel();
    const strength = Math.min(1, Math.max(Math.hypot(v.x, v.y, v.z) / FX.smoke.maxSpeed, level * FX.smoke.throttleShare));
    const scale = THREE.MathUtils.lerp(FX.smoke.scaleMin, 1, strength);
    this.engineDebt[index] += THREE.MathUtils.lerp(FX.smoke.idleRate, FX.smoke.drivingRate, strength) * dt;
    engine.object.updateWorldMatrix(true, false);
    while (this.engineDebt[index] >= 1) {
      this.engineDebt[index] -= 1;
      const [x, y, z] = FX.smoke.exhaust;
      const side = Math.random() < 0.5 ? -1 : 1; // one pipe on each side of the V
      const position = engine.object.localToWorld(new THREE.Vector3(x * side, y, z));
      const velocity = new THREE.Vector3((Math.random() - 0.5) * FX.smoke.drift * scale, range(FX.smoke.rise) * scale, (Math.random() - 0.5) * FX.smoke.drift * scale);
      const size = range(FX.smoke.size) * scale;
      this.smoke.spawn({ position, velocity, life: range(FX.smoke.life), sizeStart: FX.smoke.size[0] * scale, sizeEnd: size, colour: pickColour(COLORS.fx.smoke) });
    }
  }
}
