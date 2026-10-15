import * as THREE from 'three';

/** One particle: where it is, how it moves and how it grows and fades (see `ParticleSystem`). */
export interface ParticleSpawn {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  /** Seconds it lives. */
  life: number;
  /** Size at birth and at death (it grows, or shrinks, in between: `peak` is the fraction of its life it is biggest at). */
  sizeStart: number;
  sizeEnd: number;
  colour: THREE.Color;
}

interface Particle extends ParticleSpawn {
  age: number;
}

/**
 * A pool of small solids (cubes for clods of earth, low-poly balls for smoke) drawn with one instanced mesh (one draw call): particles move with a constant `gravity` (negative
 * values rise) and `drag`, change size over their life and vanish by shrinking to nothing at the end, so no per-particle
 * transparency is needed. Add `mesh` to the scene; `update(dt)` every frame; `dispose()` when done.
 */
export class ParticleSystem {
  readonly mesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private dummy = new THREE.Object3D();

  constructor(
    private max: number,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    private gravity: number,
    private drag: number,
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // the instances move around far from the mesh's own origin
    this.mesh.castShadow = false;
    this.mesh.raycast = () => {}; // never picked
    this.mesh.count = 0;
    // Make sure the colour buffer exists.
    this.mesh.setColorAt(0, new THREE.Color());
  }

  get alive(): number {
    return this.particles.length;
  }

  /** Adds a particle (ignored when the pool is full). */
  spawn(p: ParticleSpawn): void {
    if (this.particles.length >= this.max) return;
    this.particles.push({ ...p, position: p.position.clone(), velocity: p.velocity.clone(), age: 0 });
  }

  update(dt: number): void {
    const drag = Math.exp(-this.drag * dt);
    let n = 0;
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.velocity.y -= this.gravity * dt;
      p.velocity.multiplyScalar(drag);
      p.position.addScaledVector(p.velocity, dt);
      const t = p.age / p.life;
      // Grows from the start size to the end size, then shrinks away over the last part of its life.
      const size = THREE.MathUtils.lerp(p.sizeStart, p.sizeEnd, Math.min(1, t * 1.6)) * (1 - Math.pow(Math.max(0, (t - 0.55) / 0.45), 2));
      this.dummy.position.copy(p.position);
      this.dummy.rotation.set(t * 3 + p.life * 5, t * 2, p.life);
      this.dummy.scale.setScalar(Math.max(size, 0.0001));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(n, this.dummy.matrix);
      this.mesh.setColorAt(n, p.colour);
      this.particles[n++] = p;
    }
    this.particles.length = n;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
