import * as THREE from 'three';
import { PhysicsWorld } from '../play/physics-world';
import { VehicleController } from '../play/vehicle-controller';
import { generateRandomBuild } from './random-build';

const ORBIT_SPEED = 0.12; // rad/s
const ORBIT_RADIUS = 13;
const ORBIT_HEIGHT = 5;
/** Looking above the car pushes it to the lower part of the screen, clear of the menu text. */
const LOOK_OFFSET_Y = 3.2;
const ROAM_RADIUS = 22;
const MIN_LIFETIME = 25;
const MAX_LIFETIME = 45;

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
  private focus = new THREE.Vector3(0, 0.5, 0);

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

    this.flippedFor = up.y < 0.2 ? this.flippedFor + dt : 0;
    if (this.age > this.lifetime || this.flippedFor > 2 || t.y < -5 || Math.hypot(t.x, t.z) > 80) {
      return this.spawn();
    }

    this.drive(dt, new THREE.Vector3(t.x, 0, t.z), rotation);
    this.vehicle.update();
    this.physics.step(dt);

    this.focus.lerp(new THREE.Vector3(t.x, t.y + 0.5, t.z), 1 - Math.exp(-dt * 2));
    this.angle += ORBIT_SPEED * dt;
    this.camera.position.set(
      this.focus.x + Math.cos(this.angle) * ORBIT_RADIUS,
      this.focus.y + ORBIT_HEIGHT,
      this.focus.z + Math.sin(this.angle) * ORBIT_RADIUS,
    );
    this.camera.lookAt(this.focus.x, this.focus.y + LOOK_OFFSET_Y, this.focus.z);
  }

  /** Random wandering; when too far from the origin, steer back towards it. */
  private drive(dt: number, position: THREE.Vector3, rotation: THREE.Quaternion): void {
    this.driveTimer -= dt;
    if (this.driveTimer <= 0) {
      this.driveTimer = 1.2 + Math.random() * 2.5;
      this.throttle = Math.random() < 0.85 ? 1 : -0.6;
      this.steer = Math.random() < 0.4 ? 0 : Math.random() < 0.5 ? -1 : 1;
    }

    if (position.length() > ROAM_RADIUS) {
      // Random builds are built with X axles, so the car's forward is local -Z.
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation).setY(0).normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
      const toOrigin = position.clone().negate().normalize();
      this.throttle = 1;
      this.steer = toOrigin.dot(right) > 0 ? 1 : -1;
      this.driveTimer = 0.5;
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
    this.lifetime = MIN_LIFETIME + Math.random() * (MAX_LIFETIME - MIN_LIFETIME);
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
