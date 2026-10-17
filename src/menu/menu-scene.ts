import * as THREE from 'three';
import { CAMERA, MENU_SCENE } from '../constants';
import { PhysicsWorld } from '../play/physics-world';
import { VehicleController } from '../play/vehicle-controller';
import { generateRandomBuild } from './random-build';

/** Main-menu background: a random car wandering around while the camera slowly orbits it. */
export class MenuScene {
  private physics: PhysicsWorld | null = null;
  private vehicle: VehicleController | null = null;
  private age = 0;
  private lifetime = 0;
  private flippedFor = 0;
  private driveTimer = 0;
  private throttle = 1;
  private steer = 0;
  private angle = Math.random() * Math.PI * 2;
  private focus = new THREE.Vector3(...CAMERA.startTarget);

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {}

  start(): void {
    this.spawn();
  }

  stop(): void {
    this.despawn();
  }

  update(dt: number): void {
    if (!this.physics || !this.vehicle) return;
    this.age += dt;

    const body = this.physics.focus;
    if (!body) return this.spawn();
    const t = body.translation();
    const q = body.rotation();
    const rotation = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);

    this.flippedFor = up.y < MENU_SCENE.flipUpThreshold ? this.flippedFor + dt : 0;
    if (
      this.age > this.lifetime ||
      this.flippedFor > MENU_SCENE.flipSeconds ||
      t.y < MENU_SCENE.fallY ||
      Math.hypot(t.x, t.z) > MENU_SCENE.respawnDistance
    ) {
      return this.spawn();
    }

    this.drive(dt, new THREE.Vector3(t.x, 0, t.z), rotation);
    this.vehicle.update();
    this.physics.level = this.vehicle.level;
    this.physics.throttle = this.vehicle.throttle;
    this.physics.boosting = this.vehicle.boosting;
    this.physics.thrusting = this.vehicle.thrusting;
    this.physics.steering = this.vehicle.steering;
    this.physics.step(dt);

    this.focus.lerp(new THREE.Vector3(t.x, t.y + MENU_SCENE.focusYOffset, t.z), 1 - Math.exp(-dt * MENU_SCENE.focusSmoothing));
    this.angle += MENU_SCENE.orbitSpeed * dt;
    this.camera.position.set(
      this.focus.x + Math.cos(this.angle) * MENU_SCENE.orbitRadius,
      this.focus.y + MENU_SCENE.orbitHeight,
      this.focus.z + Math.sin(this.angle) * MENU_SCENE.orbitRadius,
    );
    this.camera.lookAt(this.focus.x, this.focus.y + MENU_SCENE.lookOffsetY, this.focus.z);
  }

  /** Random wandering; when too far from the origin, steer back towards it. */
  private drive(dt: number, position: THREE.Vector3, rotation: THREE.Quaternion): void {
    this.driveTimer -= dt;
    if (this.driveTimer <= 0) {
      this.driveTimer = MENU_SCENE.driveIntervalMin + Math.random() * MENU_SCENE.driveIntervalJitter;
      this.throttle = Math.random() < MENU_SCENE.forwardChance ? 1 : MENU_SCENE.reverseThrottle;
      this.steer = Math.random() < MENU_SCENE.straightChance ? 0 : Math.random() < 0.5 ? -1 : 1;
    }

    if (position.length() > MENU_SCENE.roamRadius) {
      // Random builds are built with X axles, so the car's forward is local -Z.
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation).setY(0).normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
      const toOrigin = position.clone().negate().normalize();
      this.throttle = 1;
      this.steer = toOrigin.dot(right) > 0 ? 1 : -1;
      this.driveTimer = MENU_SCENE.returnInterval;
    }
    this.vehicle?.setAutopilot({ throttle: this.throttle, steer: this.steer });
  }

  private spawn(): void {
    this.despawn();
    this.physics = new PhysicsWorld(generateRandomBuild());
    this.vehicle = new VehicleController(this.physics.wheels, { keyboard: false });
    this.scene.add(this.physics.group);
    this.age = 0;
    this.flippedFor = 0;
    this.driveTimer = 0;
    this.lifetime = MENU_SCENE.minLifetime + Math.random() * (MENU_SCENE.maxLifetime - MENU_SCENE.minLifetime);
  }

  private despawn(): void {
    this.vehicle?.dispose();
    if (this.physics) {
      this.scene.remove(this.physics.group);
      this.physics.dispose();
    }
    this.vehicle = this.physics = null;
  }
}
