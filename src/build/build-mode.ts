import * as THREE from 'three';
import { Grid } from './grid';
import { sound } from '../audio/sound';
import { Checkpoint, History } from './history';
import { disposeOutline, createOutline, outlineFill } from './outline';
import { BUILD, COLORS, FX, GROUND_Y, MOVE, PART_INFO, ROTATION, STUD, hexToNumber, partVolume } from '../constants';
import { createPartObject, orientationQuaternion, partBounds } from '../parts/part-defs';
import { Orientation, canonicalOrientation, mainAxisOf, orientationFields, turnOrientation } from '../parts/orientation';
import { EPS, StudBox, partBox, partBoxes, relativeBoxes, headOf } from '../parts/part-geometry';
import { CursorMode, Part, PartType, StructuralType, Vec3, addVec, cellKey, isHostType, isStructural, isWheelType, partCentre, roundCoord } from '../types';

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

/** A direction the selection can be moved in: seen from the camera on the ground, or up / down. */
export type MoveDirection = 'left' | 'right' | 'forward' | 'back' | 'up' | 'down';

/**
 * Turns pointer input into edits of the grid, depending on the cursor mode:
 * - build: the left button places the hotbar part (drag to paint blocks), a right click removes;
 * - inspect: a left click selects the part under the cursor, a left drag draws a box and selects every part it touches on the screen
 *   (Shift adds to the selection; a Shift click toggles a part), unless it starts on a selected part: then it moves the selection (Shift: up / down); selected parts are outlined and listeners such as the inspector panel are told;
 * - paint: the left button paints the part under the cursor with the chosen colour (drag to paint several; wheels are skipped);
 * - remove: the left button removes the part under the cursor (drag to erase), a right click removes too.
 * The camera buttons are configured in `main.ts` (the left button never moves the camera).
 */
export class BuildMode {
  readonly group = new THREE.Group();
  private mode: CursorMode = 'build';
  /** The placement preview. It outlives pointer moves so that its rotation can be animated. */
  private ghost: { object: THREE.Group; type: PartType; valid: boolean } | null = null;
  /** Current and target orientation of the placement ghost: it turns smoothly from one to the other (see `update`). */
  private ghostQuat = new THREE.Quaternion();
  private ghostTargetQuat = new THREE.Quaternion();
  /** Orientation of the next part, the same for every part (see `Part.studs`): local up plus a spin, 24 turns; the default is unturned. */
  private orientation: Orientation = { studs: [0, 1, 0], spin: 0 };
  private lastPointer: { clientX: number; clientY: number } | null = null;
  private hover: { part: Part; outline: THREE.Group } | null = null;
  private selection: Part[] = [];
  private selectionOutlines: THREE.Group[] = [];
  private selectionListeners: Array<(parts: ReadonlyArray<Part>) => void> = [];
  /** The selection box being dragged in inspect mode (client pixels), and the element that draws it. */
  private marquee: { x: number; y: number; element: HTMLElement | null } | null = null;
  /** True while the selection is being moved, so `rebuild` does not drop the parts that are no longer where they were. */
  private moving = false;
  /** A drag that moves the selection: the undo checkpoint, the plane the pointer slides on, where it started and how far the selection has gone (cells). */
  private dragMove: { before: Checkpoint; plane: THREE.Plane; vertical: boolean; start: THREE.Vector3; applied: Vec3 } | null = null;
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
  /** Placed parts that are squashing and stretching like jelly (see `FX.bounce`), with the seconds since they were placed. */
  private bounces: Array<{ key: string; holder: THREE.Group; age: number }> = [];
  /** True while the player's own placement is adding parts: only those bounce (not a load, an undo or a redo). */
  private placing = false;
  /** The parts in the scene (their holders, by cell), to tell the new ones and the removed ones apart on a rebuild. */
  private shown = new Map<string, THREE.Group>();
  /** True while the player's own removal is running: only the parts it removes pop away (not an undo, a redo or a load). */
  private removing = false;
  /** The parts that are popping away (`FX.pop`), kept in their own group so that they cannot be picked any more. */
  private dyingGroup = new THREE.Group();
  private dying: Array<{ holder: THREE.Group; age: number }> = [];

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private dom: HTMLElement,
    private grid: Grid,
    private history: History,
  ) {
    scene.add(this.group, this.dyingGroup);
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
      this.orientation = { studs: [0, 1, 0], spin: 0 };
    }
    this.tool = tool;
    this.setGhost(null);
  }

  /** True when `rotate` has an effect: build mode with a part that can be rotated. */
  get canRotate(): boolean {
    return this.mode === 'build' && this.tool !== null && PART_INFO[this.tool].rotatable;
  }

  /** True when `tilt` has an effect: the same as `canRotate`, every part turns freely. */
  get canTilt(): boolean {
    return this.canRotate;
  }

  /**
   * Rotates the part to place by a quarter turn around the vertical axis: `1` clockwise, `-1` counter-clockwise (seen from
   * above). Every part turns the same way, freely: its studs, axle or front go with it (nothing visibly changes for a part
   * that looks the same after the turn, but the ghost still turns).
   */
  rotate(direction: 1 | -1): void {
    if (!this.canRotate || this.tool === null) return;
    this.orientation = turnOrientation(this.tool, this.orientation, [0, 1, 0], -direction, false);
    sound.play('rotate');
    // Re-aim the ghost at its new orientation: it turns smoothly (see `update`).
    if (this.lastPointer) this.onMove({ ...this.lastPointer, buttons: 0 });
  }

  /**
   * Tilts the part to place by a quarter turn up (`1`: the top turns away from the camera) or down (`-1`: towards it), around
   * the horizontal axis that is the screen's left-right (snapped to x or z). A plate can stand as a wall, a block can lie with
   * its studs to the side, a wheel's axle can point up, an engine can face down: all parts alike.
   */
  tilt(direction: 1 | -1): void {
    if (!this.canTilt || this.tool === null) return;
    const type = this.tool;
    const axis = this.screenRight();
    const same = (a: Orientation, b: Orientation) => {
      const [x, y] = [canonicalOrientation(type, a), canonicalOrientation(type, b)];
      return x.spin === y.spin && x.studs.every((v, i) => v === y.studs[i]);
    };
    let next = turnOrientation(type, this.orientation, axis, -direction, false);
    if (same(next, this.orientation)) {
      // The part's main direction lies along the tilt axis and it looks the same after turning around it: roll around the other
      // horizontal axis so the key still does something, `↑` pointing that direction up and `↓` down.
      const other: Vec3 = axis[0] !== 0 ? [0, 0, 1] : [1, 0, 0];
      const [a, b] = [turnOrientation(type, this.orientation, other, 1, false), turnOrientation(type, this.orientation, other, -1, false)];
      const up = (o: Orientation) => mainAxisOf(type, o)[1];
      next = direction > 0 ? (up(a) >= up(b) ? a : b) : (up(a) <= up(b) ? a : b);
    }
    this.orientation = next;
    sound.play('tilt');
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
    if (this.ghost) this.ghost.object.quaternion.copy(this.ghostQuat);
    this.animateBounces(dt);
    this.animateRemovals(dt);
  }

  /** Runs `edit` (which removes parts from the grid) so that the parts it removes pop away (see `FX.pop`). */
  removeAnimated(edit: () => void): void {
    const before = this.grid.all().length;
    this.removing = true;
    try {
      edit();
    } finally {
      this.removing = false;
    }
    if (this.grid.all().length < before) sound.play('remove');
  }

  /** The pitch of the sound of placing `part`: a bigger one sounds lower. */
  private placePitch(part: Part): number {
    const size = isStructural(part.type) ? partVolume(part as Part & { type: StructuralType }) : 1;
    return 1.25 - 0.3 * Math.min(1, Math.sqrt(size) / 2);
  }

  /** A removed part swells a little and then shrinks to nothing, quickly. */
  private animateRemovals(dt: number): void {
    const { duration, swell } = FX.pop;
    this.dying = this.dying.filter((d) => {
      d.age += dt;
      const t = Math.min(1, d.age / duration);
      d.holder.scale.setScalar(Math.max(0, (1 - t * t) * (1 + swell * Math.sin(Math.PI * t))));
      if (t >= 1) this.dyingGroup.remove(d.holder);
      return t < 1;
    });
  }

  /**
   * Jelly: a part that has just been placed squashes flat, stretches tall and settles in a few wobbles (a damped cosine along
   * the vertical, the sides giving the other way by `FX.bounce.volume`).
   */
  private animateBounces(dt: number): void {
    const { duration, amplitude, frequency, damping, volume } = FX.bounce;
    this.bounces = this.bounces.filter((bounce) => {
      bounce.age += dt;
      const done = bounce.age >= duration;
      const wobble = done ? 0 : -amplitude * Math.exp(-damping * bounce.age) * Math.cos(2 * Math.PI * frequency * bounce.age);
      bounce.holder.scale.set(1 - wobble * volume, 1 + wobble, 1 - wobble * volume);
      return !done;
    });
  }

  setPaintColor(color: string | null): void {
    this.paintColor = color;
  }

  /** The current cursor mode. */
  get cursorMode(): CursorMode {
    return this.mode;
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

  /** The inspected part (outlined) when exactly one is selected, else null. */
  get selected(): Part | null {
    return this.selection.length === 1 ? this.selection[0] : null;
  }

  /** Every selected part (outlined). */
  get selectedParts(): ReadonlyArray<Part> {
    return this.selection;
  }

  /** Called with the new selection (empty when nothing is selected) whenever it changes or a selected part is updated by an edit. */
  onSelectionChange(fn: (parts: ReadonlyArray<Part>) => void): void {
    this.selectionListeners.push(fn);
  }

  select(part: Part | null): void {
    this.selectMany(part ? [part] : []);
  }

  selectMany(parts: ReadonlyArray<Part>): void {
    const same =
      parts.length === this.selection.length &&
      parts.every((p) => this.selection.some((s) => cellKey(s.cell) === cellKey(p.cell) && s.type === p.type));
    this.selection = [...parts];
    this.selectionOutlines.forEach(disposeOutline);
    this.selectionOutlines = this.selection.map((part) => {
      const outline = createOutline(partBounds(part), hexToNumber(COLORS.accent.highlight), outlineFill.selected);
      this.scene.add(outline);
      return outline;
    });
    if (!same || parts.length > 0) this.selectionListeners.forEach((fn) => fn(this.selection));
  }

  private isSelected(part: Part): boolean {
    return this.selection.some((s) => cellKey(s.cell) === cellKey(part.cell));
  }

  /** Shift click: adds the part to the selection, or takes it out when it is already in. */
  private toggle(part: Part): void {
    this.selectMany(this.isSelected(part) ? this.selection.filter((s) => cellKey(s.cell) !== cellKey(part.cell)) : [...this.selection, part]);
  }

  /** Moves the selection by `delta` cells (see `Grid.moveParts`); false, and nothing moves, when some part cannot go there. */
  private moveSelection(delta: Vec3): boolean {
    if (this.selection.length === 0) return false;
    this.moving = true;
    let moved: Part[] | null;
    try {
      moved = this.grid.moveParts(this.selection, delta);
    } finally {
      this.moving = false;
    }
    if (moved) {
      this.selectMany(moved);
      sound.play('move');
    }
    return moved !== null;
  }

  /**
   * The world axes that the screen's right and forward (away from the camera, on the ground) are closest to, so the movement buttons
   * follow the view like the rotation ones do.
   */
  private screenAxes(): { right: Vec3; forward: Vec3 } {
    this.camera.updateMatrixWorld();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).setY(0);
    const ahead = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).setY(0);
    const snap = (v: THREE.Vector3): Vec3 => (Math.abs(v.x) >= Math.abs(v.z) ? [Math.sign(v.x) || 1, 0, 0] : [0, 0, Math.sign(v.z) || 1]);
    const r = snap(right);
    const perpendicular: Vec3 = [r[2], 0, -r[0]];
    const sign = ahead.x * perpendicular[0] + ahead.z * perpendicular[2] >= 0 ? 1 : -1;
    return { right: r, forward: [perpendicular[0] * sign, 0, perpendicular[2] * sign] };
  }

  /** Moves the selection one step in a direction seen from the camera (the buttons of the inspector); one undo step. */
  moveSelectionBy(direction: MoveDirection): void {
    const { right, forward } = this.screenAxes();
    const unit: Record<MoveDirection, Vec3> = {
      left: [-right[0], 0, -right[2]],
      right,
      forward,
      back: [-forward[0], 0, -forward[2]],
      up: [0, 0, 0],
      down: [0, 0, 0],
    };
    const step = direction === 'up' ? [0, MOVE.lift, 0] : direction === 'down' ? [0, -MOVE.lift, 0] : unit[direction].map((v) => v * MOVE.step);
    this.history.run(() => void this.moveSelection(step as Vec3));
  }

  /** Slides the selection after the pointer while a move drag is on, as far as the parts can go (each axis on its own when both together are blocked). */
  private dragSelection(e: PointerLike): void {
    const drag = this.dragMove;
    if (!drag) return;
    this.setRay(e);
    const point = this.raycaster.ray.intersectPlane(drag.plane, new THREE.Vector3());
    if (!point) return;
    const off = point.sub(drag.start);
    const target: Vec3 = drag.vertical
      ? [0, Math.round(off.y / MOVE.lift) * MOVE.lift, 0]
      : [Math.round(off.x / MOVE.step) * MOVE.step, 0, Math.round(off.z / MOVE.step) * MOVE.step];
    const need: Vec3 = [target[0] - drag.applied[0], target[1] - drag.applied[1], target[2] - drag.applied[2]];
    if (need.every((v) => Math.abs(v) < EPS)) return;
    const apply = (delta: Vec3): boolean => {
      if (!this.moveSelection(delta)) return false;
      drag.applied = [drag.applied[0] + delta[0], drag.applied[1] + delta[1], drag.applied[2] + delta[2]];
      return true;
    };
    if (apply(need)) return;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(need[i]) < EPS) continue;
      const single: Vec3 = [0, 0, 0];
      single[i] = need[i];
      apply(single);
    }
  }

  /** Ends a move drag as one undo step. */
  private endMove(): void {
    if (!this.dragMove) return;
    this.history.commit(this.dragMove.before);
    this.dragMove = null;
  }

  /** The parts whose box, seen from the camera, touches the screen rectangle (client pixels). */
  private partsInRect(x0: number, y0: number, x1: number, y1: number): Part[] {
    const rect = this.dom.getBoundingClientRect();
    const [left, right] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [top, bottom] = [Math.min(y0, y1), Math.max(y0, y1)];
    this.camera.updateMatrixWorld();
    const corner = new THREE.Vector3();
    return this.grid.all().filter((part) => {
      const box = partBounds(part);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(this.camera);
        if (corner.z > 1) continue; // behind the camera
        const px = rect.left + ((corner.x + 1) / 2) * rect.width;
        const py = rect.top + ((1 - corner.y) / 2) * rect.height;
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
      return maxX >= left && minX <= right && maxY >= top && minY <= bottom;
    });
  }

  /** Draws (creating it on first use) or removes the selection box. */
  private drawMarquee(x: number, y: number): void {
    const m = this.marquee;
    if (!m) return;
    m.element ??= document.body.appendChild(Object.assign(document.createElement('div'), { className: 'selection-marquee' }));
    Object.assign(m.element.style, {
      left: `${Math.min(m.x, x)}px`,
      top: `${Math.min(m.y, y)}px`,
      width: `${Math.abs(x - m.x)}px`,
      height: `${Math.abs(y - m.y)}px`,
    });
  }

  private endMarquee(): void {
    this.marquee?.element?.remove();
    this.marquee = null;
  }

  private rebuild(): void {
    this.group.clear();
    const wobbling = new Map(this.bounces.map((bounce) => [bounce.key, bounce.age])); // a rebuild does not cut a bounce short
    this.bounces = [];
    const shown = new Map<string, THREE.Group>();
    for (const part of this.grid.all()) {
      // Each part sits in a holder at its place, so it can be squashed along the world's vertical whatever its own turn.
      const holder = new THREE.Group();
      holder.position.set(...partCentre(part));
      holder.userData.part = part;
      holder.add(createPartObject(part));
      this.group.add(holder);
      const key = cellKey(part.cell);
      shown.set(key, holder);
      const age = wobbling.get(key) ?? (this.placing && !this.shown.has(key) ? 0 : undefined);
      if (age !== undefined) this.bounces.push({ key, holder, age });
      // Raycasts use the world matrix, which is otherwise only refreshed on the next rendered frame.
      holder.updateMatrixWorld(true);
    }
    // A part that is gone because the player removed it (and its wheels with it) pops away instead of just vanishing.
    if (this.removing) {
      for (const [key, holder] of this.shown) {
        if (shown.has(key)) continue;
        this.dyingGroup.add(holder);
        this.dying.push({ holder, age: 0 });
      }
    }
    this.shown = shown;
    if (this.hover) {
      disposeOutline(this.hover.outline);
      this.hover = null;
    }
    // An edit may have removed or changed the inspected part: keep the selection in sync (or drop it).
    if (this.selection.length > 0 && !this.moving) {
      this.selectMany(
        this.selection.flatMap((old) => {
          const current = this.grid.get(old.cell);
          return current && current.type === old.type ? [current] : [];
        }),
      );
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
    // Wheels and engines are mounted on a face of a block (`face` says which), turned as the user chose, like any part.
    if (!p.part || !isHostType(p.part.type)) return null;
    if (isWheelType(this.tool) && p.normal[1] !== 0) return null; // wheels go on the sides (the rest on any face)
    // The part's cell is the unit cell against the face. Across the face it is centred on a face that is not wider than a cell (a plain
    // block: its middle), else it follows the pointer in half-cell steps, kept inside the face.
    const box = partBox(p.part);
    const axis = p.normal.findIndex((v) => v !== 0);
    const cell: Vec3 = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      if (i === axis) {
        cell[i] = roundCoord((p.normal[axis] > 0 ? box.max[i] : box.min[i]) + p.normal[axis] / 2);
      } else if (box.max[i] - box.min[i] <= 1 + EPS) {
        cell[i] = roundCoord((box.min[i] + box.max[i]) / 2);
      } else {
        const stepped = Math.round(p.point.getComponent(i) / STUD.pitch) * STUD.pitch;
        cell[i] = roundCoord(Math.min(box.max[i] - 0.5, Math.max(box.min[i] + 0.5, stepped)));
      }
    }
    return { type: this.tool, cell, face: p.normal, ...orientationFields(canonicalOrientation(this.tool, this.orientation)) };
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
    const turn = canonicalOrientation(type, this.orientation);
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
    // Parts are built on blocks, plates and brackets, and on the head of a rotor or a piston (nothing is built on a wheel or the rest of an engine).
    const head = headOf(base);
    const boxes = isStructural(base.type) ? partBoxes(base) : head ? [head] : null;
    if (!boxes) return null;
    // The box of the part that was pointed at: where the point lies on its face.
    const axis = p.normal.findIndex((v) => v !== 0);
    const sign = p.normal[axis];
    const target = pointedBox(boxes, p.point, axis, sign);
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
    if (this.mode === 'inspect') {
      // A drag that starts on a selected part moves the selection (Shift: up and down); anywhere else it draws a selection box.
      // Either way a click without movement is handled on release.
      const hit = this.pick(e);
      if (hit?.part && this.isSelected(hit.part)) {
        const vertical = e.shiftKey;
        const ahead = new THREE.Vector3();
        this.camera.getWorldDirection(ahead).setY(0).normalize();
        const plane = vertical ? new THREE.Plane().setFromNormalAndCoplanarPoint(ahead, hit.point) : new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y);
        this.dragMove = { before: this.history.begin(), plane, vertical, start: hit.point.clone(), applied: [0, 0, 0] };
      } else {
        this.marquee = { x: e.clientX, y: e.clientY, element: null };
      }
      return;
    }
    if (this.mode !== 'build') return;

    // The left button places on press; for blocks, keeping it down and moving paints more blocks (see `paint`).
    const p = this.pick(e);
    const part = p && this.target(p);
    if (!p || !part) return;
    const before = this.history.begin();
    this.placing = true;
    const added = this.grid.add(part);
    this.placing = false;
    if (!added) {
      sound.play('error');
      return;
    }
    sound.play('place', { pitch: this.placePitch(part) });
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
    this.endMarquee();
    this.endMove();
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
    if (this.mode === 'paint') {
      if (this.grid.paint(part.cell, this.paintColor)) sound.play('paint');
    }
    else this.removeAnimated(() => this.grid.remove(part.cell));
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
      cells.push({ type: 'block', cell, ...orientationFields(canonicalOrientation('block', this.orientation)) });
    }
    this.placing = true;
    if (this.grid.addMany(cells) > 0) sound.play('place', { gain: 0.6 });
    this.placing = false;
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
    if (this.dragMove) {
      if (e.buttons & 1) {
        if (Math.hypot(e.clientX - (this.down?.x ?? e.clientX), e.clientY - (this.down?.y ?? e.clientY)) > BUILD.clickMaxDistance) this.dragSelection(e);
        return;
      }
      this.endMove();
    }
    if (this.marquee) {
      if (e.buttons & 1) {
        if (Math.hypot(e.clientX - this.marquee.x, e.clientY - this.marquee.y) > BUILD.clickMaxDistance || this.marquee.element) {
          this.drawMarquee(e.clientX, e.clientY);
          this.setHover(null);
        }
        return;
      }
      this.endMarquee();
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
    if (!part || (this.mode === 'paint' && !PART_INFO[part.type].paintable) || (this.mode === 'inspect' && this.isSelected(part))) return;
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
   * Shows the placement preview for `part` (or hides it). The preview is built unturned and only its orientation is animated
   * towards the one the user chose (`this.orientation`, the same for every part), so every quarter turn is seen, even for a
   * part that looks the same afterwards (the placed part stores `canonicalOrientation`).
   */
  private setGhost(part: Part | null): void {
    if (!part) {
      if (this.ghost) this.scene.remove(this.ghost.object);
      this.ghost = null;
      return;
    }
    const valid = this.grid.canPlace(part);
    this.ghostTargetQuat.copy(orientationQuaternion(this.orientation));
    if (!this.ghost) this.ghostQuat.copy(this.ghostTargetQuat); // newly shown: no spin-in from an old orientation

    if (!this.ghost || this.ghost.type !== part.type || this.ghost.valid !== valid) {
      if (this.ghost) this.scene.remove(this.ghost.object);
      const object = createPartObject({ type: part.type }, valid ? 'ok' : 'bad');
      this.scene.add(object);
      this.ghost = { object, type: part.type, valid };
    }
    this.ghost.object.position.set(...partCentre(part));
    this.ghost.object.quaternion.copy(this.ghostQuat);
  }

  private onUp(e: PointerEvent): void {
    const down = this.down;
    this.down = null;
    const wasMoving = this.dragMove !== null;
    if (e.button === 0) this.endGestures();
    if (!this.enabled || !down || down.button !== e.button) return;
    // Placing / removing with the left button happens on press (see `onDown`). Inspecting is a click on release, and
    // the right button also pans the camera: both only count when the pointer did not move.
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > BUILD.clickMaxDistance;

    if (this.mode === 'inspect') {
      if (e.button === 0) {
        const shift = e.shiftKey;
        if (moved) {
          if (wasMoving) {
            this.clearHints();
            return this.onMove(e);
          }
          const found = this.partsInRect(down.x, down.y, e.clientX, e.clientY);
          this.selectMany(shift ? [...this.selection, ...found.filter((p) => !this.isSelected(p))] : found);
          if (found.length > 0) sound.play('select');
        } else {
          const part = this.pick(e)?.part ?? null;
          if (shift) {
            if (part) this.toggle(part);
          } else this.select(part);
          if (part) sound.play('select');
        }
      }
    } else if (e.button === 2 && !moved && this.mode !== 'paint') {
      const p = this.pick(e);
      if (p?.part) {
        const cell = p.part.cell;
        this.history.run(() => this.removeAnimated(() => this.grid.remove(cell)));
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
