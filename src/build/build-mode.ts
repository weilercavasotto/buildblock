import * as THREE from 'three';
import { Grid } from './grid';
import { Checkpoint, History } from './history';
import { disposeOutline, createOutline, outlineFill } from './outline';
import { BUILD, COLORS, GROUND_Y, PART_INFO, ROTATION, SHAPES, STUD, hexToNumber } from '../constants';
import { createPartObject, orientationQuaternion, partBounds } from '../parts/part-defs';
import { Orientation, orientationFields, orientationOfPart, turnOrientation } from '../parts/orientation';
import { EPS, StudBox, partBoxes, relativeBoxes } from '../parts/part-geometry';
import { CursorMode, Part, PartType, StructuralType, Vec3, addVec, cellKey, isStructural, normalizeRotation, partCentre, partRotation, rotationOfFace, roundCoord, yawOfTurns } from '../types';

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);

/** What the pick / hover code needs from a pointer event (so it can be re-run without one). */
interface PointerLike {
  clientX: number;
  clientY: number;
  buttons: number;
}

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

/** A left-button drag in remove or paint mode that removes / paints every part it passes over. */
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
 * - paint: the left button paints the part under the cursor with the chosen colour (drag to paint several; wheels are skipped);
 * - remove: the left button removes the part under the cursor (drag to erase), a right click removes too.
 * The camera buttons are configured in `main.ts` per mode (the left button only rotates the camera in inspect mode).
 */
export class BuildMode {
  readonly group = new THREE.Group();
  private mode: CursorMode = 'build';
  /** The placement preview. It outlives pointer moves so that its rotation can be animated. */
  private ghost: { object: THREE.Group; type: PartType; valid: boolean; key: string } | null = null;
  /** Current and target orientation of the placement ghost: it turns smoothly from one to the other (see `update`). */
  private ghostQuat = new THREE.Quaternion();
  private ghostTargetQuat = new THREE.Quaternion();
  /** Rotation (clockwise quarter turns, 0-3) given to the next rotatable part placed; for a wheel it is relative to its face. */
  private rotation = 0;
  /** Orientation of the next structural part (studs up, no spin by default); a wheel's pitch is `pitch`. */
  private orientation: Orientation = { studs: [0, 1, 0], spin: 0 };
  private pitch: 1 | -1 | undefined;
  private lastPointer: { clientX: number; clientY: number } | null = null;
  private hover: { part: Part; outline: THREE.Group } | null = null;
  private selection: Part | null = null;
  private selectionOutline: THREE.Group | null = null;
  private selectionListeners: Array<(part: Part | null) => void> = [];
  private erase: Erase | null = null;
  /** Colour of the paint mode (null = the default colour, i.e. removes paint). */
  private paintColor: string | null = null;
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
    dom.addEventListener('pointerleave', () => {
      this.lastPointer = null;
      this.clearHints();
    });
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
    if (tool !== this.tool) {
      // the orientation chosen for one part does not carry over to another
      this.rotation = 0;
      this.orientation = { studs: [0, 1, 0], spin: 0 };
      this.pitch = undefined;
    }
    this.tool = tool;
    this.setGhost(null);
  }

  /** True when `rotate` has an effect: build mode with a part that can be rotated. */
  get canRotate(): boolean {
    return this.mode === 'build' && this.tool !== null && PART_INFO[this.tool].rotatable;
  }

  /** True when `tilt` has an effect: blocks, plates and (small) wheels can point up / down; the large wheel cannot. */
  get canTilt(): boolean {
    return this.canRotate && this.tool !== 'bigWheel';
  }

  /**
   * Rotates the part to place by a quarter turn around the vertical axis: `1` clockwise, `-1` counter-clockwise (seen from
   * above). For a structural part it turns the part (nothing changes for a square part while its studs point up); for a wheel it
   * turns the axle.
   */
  rotate(direction: 1 | -1): void {
    if (!this.canRotate) return;
    if (this.tool !== null && isStructural(this.tool)) this.orientation = turnOrientation(this.tool, this.orientation, [0, 1, 0], -direction);
    else this.rotation = normalizeRotation(this.rotation + direction);
    // Re-aim the ghost at its new orientation: it turns smoothly (see `update`).
    if (this.lastPointer) this.onMove({ ...this.lastPointer, buttons: 0 });
  }

  /**
   * Tilts the part to place by a quarter turn up (`1`: the top turns away from the camera) or down (`-1`: towards it), around
   * the horizontal axis that is the screen's left-right (snapped to x or z). For a block or plate it turns the studs, so a
   * plate can stand as a wall and a block can lie with its studs to the side; a wheel's axle goes straight up or down and back.
   */
  tilt(direction: 1 | -1): void {
    if (!this.canTilt) return;
    if (this.tool !== null && isStructural(this.tool)) {
      const axis = this.screenRight();
      const same = (a: Orientation, b: Orientation) => a.spin === b.spin && a.studs.every((v, i) => v === b.studs[i]);
      let next = turnOrientation(this.tool, this.orientation, axis, -direction);
      if (same(next, this.orientation)) {
        // The studs lie along the tilt axis and the part looks the same after turning around it: roll around the other
        // horizontal axis so the key still does something, `↑` pointing the studs up and `↓` down.
        const other: Vec3 = axis[0] !== 0 ? [0, 0, 1] : [1, 0, 0];
        const [a, b] = [turnOrientation(this.tool, this.orientation, other, 1), turnOrientation(this.tool, this.orientation, other, -1)];
        next = direction > 0 ? (a.studs[1] >= b.studs[1] ? a : b) : (a.studs[1] <= b.studs[1] ? a : b);
      }
      this.orientation = next;
    } else {
      // axle: horizontal -> down (-1) / up (+1) -> horizontal
      const next = (this.pitch ?? 0) + direction;
      this.pitch = next === 0 || Math.abs(next) > 1 ? undefined : (next as 1 | -1);
    }
    if (this.lastPointer) this.onMove({ ...this.lastPointer, buttons: 0 });
  }

  /** The horizontal axis (x or z, signed) that points to the right of the screen. */
  private screenRight(): Vec3 {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    // right = forward x up
    return Math.abs(forward.x) >= Math.abs(forward.z) ? [0, 0, Math.sign(forward.x) || 1] : [-(Math.sign(forward.z) || 1), 0, 0];
  }

  /** Call every frame: turns the placement ghost smoothly towards its target orientation. */
  update(dt: number): void {
    if (this.ghostQuat.angleTo(this.ghostTargetQuat) > ROTATION.snapEpsilon) {
      this.ghostQuat.slerp(this.ghostTargetQuat, 1 - Math.exp(-ROTATION.smoothing * dt));
    } else {
      this.ghostQuat.copy(this.ghostTargetQuat);
    }
    // The large wheel's ghost is built facing the right way and does not turn.
    if (this.ghost && this.ghost.type !== 'bigWheel') this.ghost.object.quaternion.copy(this.ghostQuat);
  }

  setPaintColor(color: string | null): void {
    this.paintColor = color;
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
      obj.position.set(...partCentre(part));
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

  private setRay(e: PointerLike): void {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private pick(e: PointerLike): Pick | null {
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
    if (isStructural(this.tool)) return this.structuralTarget(this.tool, p);
    if (!p.part || p.part.type !== 'block' || p.normal[1] !== 0) return null;
    if (this.tool === 'bigWheel') {
      // The axle is the face normal; the rotation (A / D) only picks the side the wheel extends toward (see `partCells`).
      return { type: 'bigWheel', cell: addVec(p.part.cell, p.normal), face: p.normal, rotation: this.rotation };
    }
    // `face` says where the wheel is mounted. Its axle is the face normal (a normal wheel) turned by the user's rotation:
    // 0 turns = perpendicular to the face, an odd number = lying along it (like a caster).
    const rotation = normalizeRotation(rotationOfFace(p.normal) + this.rotation);
    return { type: 'wheel', cell: addVec(p.part.cell, p.normal), face: p.normal, rotation, ...(this.pitch ? { pitch: this.pitch } : {}) };
  }

  /**
   * Where a structural part goes for the current pick, turned as the user chose (`this.orientation`). The edges of its
   * anchor box (the first box of the shape) snap to the stud pitch in x and z. On the ground the part sits on the floor under
   * the pointer. On a face of another part it touches that face (on top, underneath or beside) with its footprint shifted by
   * the pointer, so it can engage many studs, or only one. Beside a part with the studs up it goes level with the bottom, so
   * building on the ground stays easy. `Grid.canPlace` then checks that it is supported (ground or at least one stud
   * engaged) and nothing is in the way.
   */
  private structuralTarget(type: StructuralType, p: Pick): Part | null {
    const turn = this.orientation;
    const shape = (cell: Vec3): Part => ({ type, cell: [roundCoord(cell[0]), roundCoord(cell[1]), roundCoord(cell[2])], ...orientationFields(turn) });
    const rel = relativeBoxes({ type, ...orientationFields(turn) }); // relative to the cell; the first box is the anchor
    const anchor = rel[0];
    const size = (i: number) => anchor.max[i] - anchor.min[i];
    const low = Math.min(...rel.map((b) => b.min[1]));
    const snap = (v: number) => roundCoord(Math.round(v / STUD.pitch) * STUD.pitch);
    // `cell` coordinate along axis `i` for the pointer at `point`: the anchor's lower edge on the stud lattice. When the anchor is
    // not a whole number of pitches long there (the thin side of a plate standing as a wall) it rests on the lattice line
    // nearest to the pointer, on the side the pointer is on, so it stays in the half cell that is pointed at.
    const thin = (i: number) => Math.abs(size(i) / STUD.pitch - Math.round(size(i) / STUD.pitch)) > EPS;
    const along = (i: number, point: number) => {
      if (!thin(i)) return snap(point - size(i) / 2) - anchor.min[i];
      const line = snap(point);
      return roundCoord((point < line ? line - size(i) / 2 : line + size(i) / 2) - (anchor.min[i] + anchor.max[i]) / 2);
    };
    if (!p.part) return shape([along(0, p.point.x), GROUND_Y - low, along(2, p.point.z)]);

    const base = p.part;
    if (!isStructural(base.type)) return null; // nothing is built on a wheel
    // The box of the part that was pointed at: where the point lies on its face.
    const axis = p.normal.findIndex((v) => v !== 0);
    const sign = p.normal[axis];
    const target = pointedBox(partBoxes(base), p.point, axis, sign);
    const cell: Vec3 = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      if (i === axis) {
        cell[i] = sign > 0 ? target.max[i] - Math.min(...rel.map((b) => b.min[i])) : target.min[i] - Math.max(...rel.map((b) => b.max[i]));
      } else {
        // The anchor must overlap the box by at least one stud pitch (or by all of the thinner of the two when that is less).
        const overlap = Math.min(STUD.pitch, size(i), target.max[i] - target.min[i]);
        const edge = along(i, p.point.getComponent(i)) + anchor.min[i];
        const clamped = Math.min(target.max[i] - overlap, Math.max(target.min[i] - size(i) + overlap, edge));
        cell[i] = roundCoord(clamped - anchor.min[i]);
      }
    }
    // Beside a part with its studs up: level with the bottom of the part it is next to.
    if (axis !== 1 && turn.studs[1] === 1) cell[1] = target.min[1] - low;
    return shape(cell);
  }

  private onDown(e: PointerEvent): void {
    this.down = { x: e.clientX, y: e.clientY, button: e.button };
    if (!this.enabled || e.button !== 0) return;
    if (this.mode === 'remove' || this.mode === 'paint') {
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

  /** Ends a block-placing stroke or an erase / paint stroke, each as one undo step. */
  private endGestures(): void {
    this.endStroke();
    if (this.erase) {
      this.history.commit(this.erase.before);
      this.erase = null;
    }
  }

  /** Removes the part under the pointer, unless the pointer has not moved since the previous removal. */
  private eraseAt(e: PointerLike, first = false): void {
    const s = this.erase!;
    if (!first && Math.hypot(e.clientX - s.x, e.clientY - s.y) < BUILD.clickMaxDistance) return;
    const part = this.pick(e)?.part;
    if (!part) return;
    s.x = e.clientX;
    s.y = e.clientY;
    if (this.mode === 'paint') this.grid.paint(part.cell, this.paintColor);
    else this.grid.remove(part.cell);
  }

  /**
   * Extends the stroke to the cell under the pointer. The pointer ray is intersected with the plane of the face the
   * stroke started on (not with the blocks just placed, which would make the stroke grow towards the camera), and
   * the cells between the previous and the new position are filled so fast mouse moves leave no gaps.
   */
  private paint(e: PointerLike): void {
    const s = this.stroke!;
    this.setRay(e);
    const normal = new THREE.Vector3();
    normal.setComponent(s.axis, 1);
    const point = this.raycaster.ray.intersectPlane(new THREE.Plane(normal, -s.surface), new THREE.Vector3());
    if (!point) return;

    // Whole cells from where the stroke started, so a stroke that starts on a half cell keeps its offset.
    const goal: Vec3 = [0, 1, 2].map((i) => (i === s.axis ? s.layer : roundCoord(s.start[i] + Math.round(point.getComponent(i) - s.start[i])))) as Vec3;
    if (goal.some((v, i) => Math.abs(v - s.start[i]) > BUILD.maxPaintDistance)) return;

    const steps = Math.round(Math.max(...goal.map((v, i) => Math.abs(v - s.last[i]))));
    const cells: Part[] = [];
    for (let step = 1; step <= steps; step++) {
      const cell = s.last.map((v, i) => roundCoord(s.start[i] + Math.round(v + ((goal[i] - v) * step) / steps - s.start[i]))) as Vec3;
      cells.push({ type: 'block', cell, ...orientationFields(this.orientation) });
    }
    this.grid.addMany(cells);
    s.last = goal;
  }

  private onMove(e: PointerLike): void {
    this.lastPointer = { clientX: e.clientX, clientY: e.clientY };
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
    if (!part || (this.mode === 'paint' && !PART_INFO[part.type].paintable) || (this.mode === 'inspect' && this.selection && cellKey(part.cell) === cellKey(this.selection.cell))) return;
    const remove = this.mode === 'remove';
    const outline = createOutline(
      partBounds(part),
      hexToNumber(remove ? COLORS.accent.danger : COLORS.white),
      remove ? outlineFill.remove : outlineFill.hover,
    );
    this.scene.add(outline);
    this.hover = { part, outline };
  }

  /**
   * Shows the placement preview for `part` (or hides it). The preview is built unturned (a block with its studs up, a wheel
   * with its axle along X) and only its orientation is animated towards the part's: where the studs point, or the wheel's
   * axle (yaw from its rotation, pitch up / down). The large wheel's axle is its face normal, so it is built facing the right
   * way and not turned.
   */
  private setGhost(part: Part | null): void {
    if (!part) {
      if (this.ghost) this.scene.remove(this.ghost.object);
      this.ghost = null;
      return;
    }
    const valid = this.grid.canPlace(part);
    this.ghostTargetQuat.copy(this.orientationOf(part));
    if (!this.ghost) this.ghostQuat.copy(this.ghostTargetQuat); // newly shown: no spin-in from an old orientation

    const big = part.type === 'bigWheel';
    const key = big ? String(part.face) : '';
    if (!this.ghost || this.ghost.type !== part.type || this.ghost.valid !== valid || this.ghost.key !== key) {
      if (this.ghost) this.scene.remove(this.ghost.object);
      const object = createPartObject(big ? { type: part.type, face: part.face } : { type: part.type }, valid ? 'ok' : 'bad');
      this.scene.add(object);
      this.ghost = { object, type: part.type, valid, key };
    }
    this.ghost.object.position.set(...partCentre(part));
    this.ghost.object.quaternion.copy(big ? new THREE.Quaternion() : this.ghostQuat);
  }

  /** The turn that takes a part built unturned to the orientation of `part`. */
  private orientationOf(part: Part): THREE.Quaternion {
    if (isStructural(part.type)) {
      // Turns that look the same (a quarter turn around the studs of a square part): take the one nearest to where the ghost is
      // now, so the turn looks like the quarter turn it is, without an extra twist.
      const { studs, spin } = orientationOfPart(part);
      const turns = SHAPES[part.type].spins;
      const options = [0, 1, 2, 3].filter((k) => (k - spin) % turns === 0).map((k) => orientationQuaternion({ studs, spin: k }));
      return options.reduce((best, q) => (q.angleTo(this.ghostQuat) < best.angleTo(this.ghostQuat) ? q : best));
    }
    if (part.type !== 'wheel') return new THREE.Quaternion();
    // A wheel is built with its axle along X: pitch turns it up / down, then the yaw of its rotation turns it around.
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawOfTurns(partRotation(part)));
    if (part.pitch) turn.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (part.pitch * Math.PI) / 2));
    return turn;
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
    } else if (e.button === 2 && !moved && this.mode !== 'paint') {
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

/**
 * Of the boxes of a part, the one whose face on the side `sign` of `axis` is the one the pointer is on (the nearest to the
 * point, counting how far the point is outside the box along the other axes).
 */
function pointedBox(boxes: StudBox[], point: THREE.Vector3, axis: number, sign: number): StudBox {
  const cost = (box: StudBox) => {
    let outside = 0;
    for (let i = 0; i < 3; i++) {
      if (i === axis) continue;
      outside += Math.max(0, box.min[i] - point.getComponent(i), point.getComponent(i) - box.max[i]);
    }
    return Math.abs(point.getComponent(axis) - (sign > 0 ? box.max[axis] : box.min[axis])) + outside;
  };
  return boxes.reduce((best, box) => (cost(box) < cost(best) ? box : best));
}
