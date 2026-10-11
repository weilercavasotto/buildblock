import * as THREE from 'three';
import { Grid } from './grid';
import { Checkpoint, History } from './history';
import { disposeOutline, createOutline, outlineFill } from './outline';
import { BUILD, COLORS, GROUND_Y, hexToNumber } from '../constants';
import { createPartObject, partBounds } from '../parts/part-defs';
import { CursorMode, Part, PartType, Vec3, addVec, cellKey } from '../types';

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
  /** Grid state before the stroke; committed to the history as one step when the stroke ends. */
  before: Checkpoint;
}

/** A left-button drag in remove mode that erases every part it passes over. */
interface Erase {
  before: Checkpoint;
  /** Pointer position of the last removal; the next one needs some movement (no drilling through a stack). */
  x: number;
  y: number;
}

/**
 * Turns pointer input into edits of the grid, depending on the cursor mode:
 * - build: the left button places the hotbar part (drag to paint blocks), a right click removes;
 * - inspect: a left click selects the part under the cursor (outlined; listeners such as the inspector panel are told);
 * - remove: the left button removes the part under the cursor (drag to erase), a right click removes too.
 * The camera buttons are configured in `main.ts` per mode (the left button only rotates the camera in inspect mode).
 */
export class BuildMode {
  readonly group = new THREE.Group();
  private mode: CursorMode = 'build';
  private ghost: THREE.Object3D | null = null;
  private hover: { part: Part; outline: THREE.Group } | null = null;
  private selection: Part | null = null;
  private selectionOutline: THREE.Group | null = null;
  private selectionListeners: Array<(part: Part | null) => void> = [];
  private erase: Erase | null = null;
  /** The part to place (the one in the selected hotbar slot); null when that slot is empty. */
  private tool: PartType | null = 'block';
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
    private history: History,
  ) {
    scene.add(this.group);
    grid.subscribe(() => this.rebuild());
    this.rebuild();

    dom.addEventListener('pointermove', (e) => this.onMove(e));
    dom.addEventListener('pointerleave', () => this.clearHints());
    dom.addEventListener('pointerdown', (e) => this.onDown(e));
    dom.addEventListener('pointerup', (e) => this.onUp(e));
    // A stroke must end even when the button is released outside the canvas or the window loses focus.
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.endGestures();
    });
    window.addEventListener('blur', () => this.endGestures());
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setTool(tool: PartType | null): void {
    this.tool = tool;
    this.setGhost(null);
  }

  setMode(mode: CursorMode): void {
    if (mode === this.mode) return;
    this.endGestures();
    this.clearHints();
    this.mode = mode;
    if (mode !== 'inspect') this.select(null);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.group.visible = enabled;
    if (!enabled) {
      this.endGestures();
      this.clearHints();
      this.select(null);
    }
  }

  /** The inspected part (outlined), or null. */
  get selected(): Part | null {
    return this.selection;
  }

  /** Called with the new selection (or null) whenever it changes or the selected part is updated by an edit. */
  onSelectionChange(fn: (part: Part | null) => void): void {
    this.selectionListeners.push(fn);
  }

  select(part: Part | null): void {
    const unchanged = part === null ? this.selection === null : this.selection && cellKey(part.cell) === cellKey(this.selection.cell);
    this.selection = part;
    disposeOutline(this.selectionOutline);
    this.selectionOutline = null;
    if (part) {
      this.selectionOutline = createOutline(partBounds(part), hexToNumber(COLORS.accent.highlight), outlineFill.selected);
      this.scene.add(this.selectionOutline);
    }
    if (!unchanged || part) this.selectionListeners.forEach((fn) => fn(part));
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
    if (this.hover) {
      disposeOutline(this.hover.outline);
      this.hover = null;
    }
    // An edit may have removed or changed the inspected part: keep the selection in sync (or drop it).
    if (this.selection) {
      const current = this.grid.get(this.selection.cell);
      this.select(current && current.type === this.selection.type ? current : null);
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
    if (this.tool === null) return null;
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
    if (this.mode === 'remove') {
      this.erase = { before: this.history.begin(), x: e.clientX, y: e.clientY };
      this.eraseAt(e, true);
      return;
    }
    if (this.mode !== 'build') return; // inspect: the click is handled on release (a drag rotates the camera)

    // The left button places on press; for blocks, keeping it down and moving paints more blocks (see `paint`).
    const p = this.pick(e);
    const part = p && this.target(p);
    if (!p || !part) return;
    const before = this.history.begin();
    if (!this.grid.add(part)) return;
    this.setGhost(null);
    if (part.type !== 'block') {
      this.history.commit(before);
    } else {
      const axis = p.normal.findIndex((v) => v !== 0);
      this.stroke = {
        axis,
        surface: part.cell[axis] - 0.5 * p.normal[axis],
        layer: part.cell[axis],
        start: part.cell,
        last: part.cell,
        before,
      };
    }
  }

  /** True while the left button is held after placing a block (further blocks may still be added). */
  get isPainting(): boolean {
    return this.stroke !== null;
  }

  private endStroke(): void {
    if (!this.stroke) return;
    this.history.commit(this.stroke.before);
    this.stroke = null;
  }

  /** Ends a paint stroke or an erase stroke, each as one undo step. */
  private endGestures(): void {
    this.endStroke();
    if (this.erase) {
      this.history.commit(this.erase.before);
      this.erase = null;
    }
  }

  /** Removes the part under the pointer, unless the pointer has not moved since the previous removal. */
  private eraseAt(e: PointerEvent, first = false): void {
    const s = this.erase!;
    if (!first && Math.hypot(e.clientX - s.x, e.clientY - s.y) < BUILD.clickMaxDistance) return;
    const part = this.pick(e)?.part;
    if (!part) return;
    s.x = e.clientX;
    s.y = e.clientY;
    this.grid.remove(part.cell);
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
    if (!this.enabled) return this.clearHints();
    if (this.stroke) {
      if (e.buttons & 1) return this.paint(e);
      this.endStroke();
    }
    if (this.erase) {
      if (e.buttons & 1) return this.eraseAt(e);
      this.endGestures();
    }
    if (e.buttons !== 0) return this.clearHints();
    const p = this.pick(e);
    if (this.mode === 'build') {
      this.setHover(null);
      this.setGhost(p ? this.target(p) : null);
    } else {
      this.setGhost(null);
      this.setHover(p?.part ?? null);
    }
  }

  private clearHints(): void {
    this.setGhost(null);
    this.setHover(null);
  }

  /** Outlines the part that a click would inspect (white) or remove (red). */
  private setHover(part: Part | null): void {
    if (this.hover && part && cellKey(this.hover.part.cell) === cellKey(part.cell) && this.hover.part.type === part.type) return;
    disposeOutline(this.hover?.outline ?? null);
    this.hover = null;
    if (!part || (this.mode === 'inspect' && this.selection && cellKey(part.cell) === cellKey(this.selection.cell))) return;
    const remove = this.mode === 'remove';
    const outline = createOutline(
      partBounds(part),
      hexToNumber(remove ? COLORS.accent.danger : COLORS.white),
      remove ? outlineFill.remove : outlineFill.hover,
    );
    this.scene.add(outline);
    this.hover = { part, outline };
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
    if (e.button === 0) this.endGestures();
    if (!this.enabled || !down || down.button !== e.button) return;
    // Placing / removing with the left button happens on press (see `onDown`). Inspecting is a click on release, and
    // the right button also pans the camera: both only count when the pointer did not move.
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > BUILD.clickMaxDistance;

    if (this.mode === 'inspect') {
      if (e.button === 0 && !moved) this.select(this.pick(e)?.part ?? null);
    } else if (e.button === 2 && !moved) {
      const p = this.pick(e);
      if (p?.part) {
        const cell = p.part.cell;
        this.history.run(() => this.grid.remove(cell));
      }
    }
    this.clearHints();
    this.onMove(e);
  }
}
