import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { COLLISION_GROUP, COLORS, FX, hexToNumber } from '../constants';
import { thrusterTip } from '../parts/thruster-model';
import { turboNozzleTip } from '../parts/turbo-model';
import { Part } from '../types';
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

/** A thruster the effects follow: its visual (the flame leaves the bell). */
export interface ThrusterFx {
  /** The thruster: its key says whether it is firing. */
  part: Part;
  object: THREE.Object3D;
}

/** A turbo the effects follow: its visual (the flame leaves its nozzle). */
export interface TurboFx {
  /** The turbo: its key says whether it is blowing. */
  part: Part;
  object: THREE.Object3D;
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
  private flame = new ParticleSystem(FX.flame.max, new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 3.5);
  private smoke = new ParticleSystem(FX.smoke.max, new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.65, depthWrite: false }), -0.3, FX.smoke.drag);
  /** Particles still owed to each wheel / engine (the fractions of a particle that did not fit in a frame). */
  private wheelDebt: number[];
  private engineDebt: number[];
  private turboDebt: number[];
  private thrusterDebt: number[];
  private time = 0;
  /** How hard each wheel is throwing earth (0-1) and how much it slips (0-1), this frame: what the wheel sounds follow. */
  private rumbles: number[];
  private slips: number[];
  private ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

  constructor(
    private world: RAPIER.World,
    private wheels: WheelFx[],
    private engines: EngineFx[],
    private turbos: TurboFx[],
    private thrusters: ThrusterFx[],
  ) {
    this.wheelDebt = wheels.map(() => 0);
    this.rumbles = wheels.map(() => 0);
    this.slips = wheels.map(() => 0);
    this.engineDebt = engines.map(() => 0);
    this.turboDebt = turbos.map(() => 0);
    this.thrusterDebt = thrusters.map(() => 0);
    this.group.add(this.dust.mesh, this.smoke.mesh, this.flame.mesh);
  }

  /** The mean strength of the earth the wheels throw (0-1): the rumble of the wheels on the ground. */
  get rumble(): number {
    return this.rumbles.length ? this.rumbles.reduce((sum, v) => sum + v, 0) / this.rumbles.length : 0;
  }

  /** How much the most slipping wheel slips (0-1): the hiss of a skid. */
  get slip(): number {
    return Math.max(0, ...this.slips);
  }

  update(dt: number, level: number, isOn: (part: Part) => boolean): void {
    this.time += dt;
    this.wheels.forEach((wheel, i) => this.emitDust(wheel, i, dt));
    this.engines.forEach((engine, i) => this.runEngine(engine, i, dt, level));
    this.turbos.forEach((turbo, i) => this.fireTurbo(turbo, i, dt, isOn(turbo.part)));
    this.thrusters.forEach((thruster, i) => this.fireThruster(thruster, i, dt, isOn(thruster.part)));
    this.dust.update(dt);
    this.smoke.update(dt);
    this.flame.update(dt);
  }

  dispose(): void {
    this.dust.dispose();
    this.smoke.dispose();
    this.flame.dispose();
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
    this.rumbles[index] = 0;
    this.slips[index] = 0;
    if (speed < FX.dust.minSpeed && spin < FX.dust.minSpeed) return;
    // Only a wheel on the ground (anything of the scenery below it, within a wheel radius).
    this.ray.origin = { x: t.x, y: t.y, z: t.z };
    const hit = this.world.castRay(this.ray, wheel.radius + 0.15, true, undefined, (0xffff << 16) | COLLISION_GROUP.ground);
    if (!hit) return;

    // How strong the effect is, 0-1.5 (1 = the configured values, at `FX.dust.maxSpeed`): the rate, and how big and lively each clod is.
    const intensity = Math.min(1.5, (speed + Math.max(0, spin - speed) * FX.dust.slip) / FX.dust.maxSpeed);
    this.rumbles[index] = Math.min(1, intensity);
    this.slips[index] = Math.min(1, Math.max(0, spin - speed) / FX.dust.maxSpeed);
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

  /** While its key is held, a turbo breathes a blue-white flame out of its nozzle (backwards along the bottle). */
  private fireTurbo(turbo: TurboFx, index: number, dt: number, boosting: boolean): void {
    if (!boosting) {
      this.turboDebt[index] = 0;
      return;
    }
    turbo.object.updateWorldMatrix(true, false);
    const [x, y, z] = turboNozzleTip;
    const tip = turbo.object.localToWorld(new THREE.Vector3(x, y, z));
    const direction = turbo.object.localToWorld(new THREE.Vector3(x, y, z - 1)).sub(tip).normalize();
    this.turboDebt[index] += FX.flame.rate * dt;
    while (this.turboDebt[index] >= 1) {
      this.turboDebt[index] -= 1;
      const velocity = direction.clone().multiplyScalar(range(FX.flame.speed));
      velocity.add(new THREE.Vector3((Math.random() - 0.5) * FX.flame.spread, (Math.random() - 0.5) * FX.flame.spread, (Math.random() - 0.5) * FX.flame.spread));
      const size = range(FX.flame.size);
      this.flame.spawn({ position: tip.clone(), velocity, life: range(FX.flame.life), sizeStart: size, sizeEnd: size * 0.3, colour: pickColour(COLORS.fx.flame) });
    }
  }

  /** While its key is held, a thruster breathes an orange flame out of its bell (backwards along the jet). */
  private fireThruster(thruster: ThrusterFx, index: number, dt: number, thrusting: boolean): void {
    if (!thrusting) {
      this.thrusterDebt[index] = 0;
      return;
    }
    thruster.object.updateWorldMatrix(true, false);
    const [x, y, z] = thrusterTip;
    const tip = thruster.object.localToWorld(new THREE.Vector3(x, y, z));
    const direction = thruster.object.localToWorld(new THREE.Vector3(x, y, z - 1)).sub(tip).normalize();
    const f = FX.thrustFlame;
    this.thrusterDebt[index] += f.rate * dt;
    while (this.thrusterDebt[index] >= 1) {
      this.thrusterDebt[index] -= 1;
      const velocity = direction.clone().multiplyScalar(range(f.speed));
      velocity.add(new THREE.Vector3((Math.random() - 0.5) * f.spread, (Math.random() - 0.5) * f.spread, (Math.random() - 0.5) * f.spread));
      const size = range(f.size);
      this.flame.spawn({ position: tip.clone(), velocity, life: range(f.life), sizeStart: size, sizeEnd: size * 0.25, colour: pickColour(COLORS.fx.thrust) });
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
