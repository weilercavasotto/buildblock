import * as THREE from 'three';
import { Grid } from './grid';
import { createPartObject } from '../parts/part-defs';
import { Part, PartType, Vec3, addVec } from '../types';

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.5);
const CLICK_MAX_DISTANCE = 5;

interface Pick {
  part: Part | null;
  /** Dominant axis of the surface normal that was hit. */
  normal: Vec3;
  point: THREE.Vector3;
}

export class BuildMode {
  readonly group = new THREE.Group();
  private ghost: THREE.Object3D | null = null;
  private tool: PartType = 'block';
  private enabled = true;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private down: { x: number; y: number; button: number } | null = null;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private dom: HTMLElement,
    private grid: Grid,
  ) {
    scene.add(this.group);
    grid.subscribe(() => this.rebuild());
    this.rebuild();

    dom.addEventListener('pointermove', (e) => this.onMove(e));
    dom.addEventListener('pointerleave', () => this.setGhost(null));
    dom.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, button: e.button };
    });
    dom.addEventListener('pointerup', (e) => this.onUp(e));
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setTool(tool: PartType): void {
    this.tool = tool;
    this.setGhost(null);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.group.visible = enabled;
    if (!enabled) this.setGhost(null);
  }

  private rebuild(): void {
    this.group.clear();
    for (const part of this.grid.all()) {
      const obj = createPartObject(part);
      obj.position.set(...part.cell);
      obj.userData.part = part;
      this.group.add(obj);
    }
  }

  private pick(e: PointerEvent): Pick | null {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.intersectObjects(this.group.children, true)[0];
    const groundPoint = this.raycaster.ray.intersectPlane(GROUND_PLANE, new THREE.Vector3());

    if (hit && hit.face && (!groundPoint || hit.distance <= groundPoint.distanceTo(this.raycaster.ray.origin))) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData.part) obj = obj.parent;
      if (!obj) return null;
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      const axis = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
      const i = axis.indexOf(Math.max(...axis));
      const normal: Vec3 = [0, 0, 0];
      normal[i] = Math.sign([n.x, n.y, n.z][i]);
      return { part: obj.userData.part as Part, normal, point: hit.point };
    }
    if (groundPoint) return { part: null, normal: [0, 1, 0], point: groundPoint };
    return null;
  }

  /** The part that a click would place for the current pick, or null when nothing sensible. */
  private target(p: Pick): Part | null {
    if (this.tool === 'block') {
      const cell: Vec3 = p.part ? addVec(p.part.cell, p.normal) : [Math.round(p.point.x), 0, Math.round(p.point.z)];
      return { type: 'block', cell };
    }
    if (!p.part || p.part.type !== 'block' || p.normal[1] !== 0) return null;
    return { type: 'wheel', cell: addVec(p.part.cell, p.normal), face: p.normal };
  }

  private onMove(e: PointerEvent): void {
    if (!this.enabled || e.buttons !== 0) return this.setGhost(null);
    const p = this.pick(e);
    this.setGhost(p ? this.target(p) : null);
  }

  private setGhost(part: Part | null): void {
    if (this.ghost) this.scene.remove(this.ghost);
    this.ghost = null;
    if (!part) return;
    this.ghost = createPartObject(part, this.grid.canPlace(part) ? 'ok' : 'bad');
    this.ghost.position.set(...part.cell);
    this.scene.add(this.ghost);
  }

  private onUp(e: PointerEvent): void {
    const down = this.down;
    this.down = null;
    if (!this.enabled || !down || down.button !== e.button) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_MAX_DISTANCE) return;

    const p = this.pick(e);
    if (!p) return;
    if (e.button === 0) {
      const part = this.target(p);
      if (part) this.grid.add(part);
    } else if (e.button === 2 && p.part) {
      this.grid.remove(p.part.cell);
    }
    this.setGhost(null);
    this.onMove(e);
  }
}
