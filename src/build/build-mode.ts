import * as THREE from 'three';
import { Grid } from './grid';
import { BUILD, GROUND_Y } from '../constants';
import { createPartObject } from '../parts/part-defs';
import { Part, PartType, Vec3, addVec } from '../types';

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);

interface Pick {
  part: Part | null;
  /** Dominant axis of the surface normal that was hit. */
  normal: Vec3;
  point: THREE.Vector3;
}

/** A left-button drag that keeps placing blocks on the plane of the face where it started. */
interface Stroke {
  /** Axis (0 = x, 1 = y, 2 = z) perpendicular to the painted plane. */
  axis: number;
  /** Coordinate of the painted surface along `axis` (a cell face, half a cell from the cell centres). */
  surface: number;
  /** Coordinate along `axis` shared by every cell of the stroke. */
  layer: number;
  start: Vec3;
  last: Vec3;
}

export class BuildMode {
  readonly group = new THREE.Group();
  private ghost: THREE.Object3D | null = null;
  private tool: PartType = 'block';
  private enabled = true;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private down: { x: number; y: number; button: number } | null = null;
  private stroke: Stroke | null = null;

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
    dom.addEventListener('pointerdown', (e) => this.onDown(e));
    dom.addEventListener('pointerup', (e) => this.onUp(e));
    // A stroke must end even when the button is released outside the canvas or the window loses focus.
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.stroke = null;
    });
    window.addEventListener('blur', () => (this.stroke = null));
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setTool(tool: PartType): void {
    this.tool = tool;
    this.setGhost(null);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.group.visible = enabled;
    if (!enabled) {
      this.stroke = null;
      this.setGhost(null);
    }
  }

  private rebuild(): void {
    this.group.clear();
    for (const part of this.grid.all()) {
      const obj = createPartObject(part);
      obj.position.set(...part.cell);
      obj.userData.part = part;
      this.group.add(obj);
      // Raycasts use the world matrix, which is otherwise only refreshed on the next rendered frame.
      obj.updateMatrixWorld(true);
    }
  }

  private setRay(e: PointerEvent): void {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private pick(e: PointerEvent): Pick | null {
    this.setRay(e);

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

  private onDown(e: PointerEvent): void {
    this.down = { x: e.clientX, y: e.clientY, button: e.button };
    if (!this.enabled || e.button !== 0) return;

    // The left button places on press; for blocks, keeping it down and moving paints more blocks (see `paint`).
    const p = this.pick(e);
    const part = p && this.target(p);
    if (!p || !part || !this.grid.add(part)) return;
    this.setGhost(null);
    if (part.type === 'block') {
      const axis = p.normal.findIndex((v) => v !== 0);
      this.stroke = {
        axis,
        surface: part.cell[axis] - 0.5 * p.normal[axis],
        layer: part.cell[axis],
        start: part.cell,
        last: part.cell,
      };
    }
  }

  /**
   * Extends the stroke to the cell under the pointer. The pointer ray is intersected with the plane of the face the
   * stroke started on (not with the blocks just placed, which would make the stroke grow towards the camera), and
   * the cells between the previous and the new position are filled so fast mouse moves leave no gaps.
   */
  private paint(e: PointerEvent): void {
    const s = this.stroke!;
    this.setRay(e);
    const normal = new THREE.Vector3();
    normal.setComponent(s.axis, 1);
    const point = this.raycaster.ray.intersectPlane(new THREE.Plane(normal, -s.surface), new THREE.Vector3());
    if (!point) return;

    const goal: Vec3 = [Math.round(point.x), Math.round(point.y), Math.round(point.z)];
    goal[s.axis] = s.layer;
    if (goal.some((v, i) => Math.abs(v - s.start[i]) > BUILD.maxPaintDistance)) return;

    const steps = Math.max(...goal.map((v, i) => Math.abs(v - s.last[i])));
    const cells: Part[] = [];
    for (let step = 1; step <= steps; step++) {
      const cell = s.last.map((v, i) => Math.round(v + ((goal[i] - v) * step) / steps)) as Vec3;
      cells.push({ type: 'block', cell });
    }
    this.grid.addMany(cells);
    s.last = goal;
  }

  private onMove(e: PointerEvent): void {
    if (!this.enabled) return this.setGhost(null);
    if (this.stroke) {
      if (e.buttons & 1) return this.paint(e);
      this.stroke = null;
    }
    if (e.buttons !== 0) return this.setGhost(null);
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
    if (e.button === 0) this.stroke = null;
    if (!this.enabled || !down || down.button !== e.button) return;
    // Placing happens on press (see `onDown`). The right button also pans the camera: only a press without
    // movement counts as a click (remove).
    if (e.button === 2 && Math.hypot(e.clientX - down.x, e.clientY - down.y) > BUILD.clickMaxDistance) return;

    if (e.button === 2) {
      const p = this.pick(e);
      if (p?.part) this.grid.remove(p.part.cell);
    }
    this.setGhost(null);
    this.onMove(e);
  }
}
