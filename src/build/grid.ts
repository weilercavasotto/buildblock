import { DEFAULT_GRID_CELLS, GROUND_Y, PART_INFO, SHAPES, SUSPENSION, TIRE, WEIGHT, buildRange, clampSuspension, clampTire, clampPower, clampWeight, legacyTireValue, tireValueOf, partVolume, powerOf, weightOf, ENGINE } from '../constants';
import { isSpin } from '../parts/orientation';
import { EPS, partBox, partsOverlap, studsEngaged } from '../parts/part-geometry';
import { Part, Vec3, cellKey, isAxisDirection, isHexColor, isStructural, isWheelType, isMountedType, frontOf, subVec, StructuralType } from '../types';

export class Grid {
  /** Every part, keyed by its own `cell` (see `cellKey`). */
  private parts = new Map<string, Part>();
  private listeners: Array<() => void> = [];

  subscribe(fn: () => void): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  /** The part whose centre (`cell`) is exactly `cell`, if any. */
  get(cell: Vec3): Part | undefined {
    return this.parts.get(cellKey(cell));
  }

  /** The parts whose box overlaps `part`'s box (the ones in the way if it were placed), `part` itself excluded. */
  private overlapping(part: Part): Part[] {
    return this.all().filter((other) => cellKey(other.cell) !== cellKey(part.cell) && partsOverlap(part, other));
  }

  all(): Part[] {
    return [...this.parts.values()];
  }

  /**
   * Do the wheels need an engine to be driven? True for games made since the engine exists; saves from before it keep
   * driving every wheel. Set by the game when it loads or starts a save; not part of the parts.
   */
  engineDrive = false;

  /** Buildable cells (x / z and height), from the floor-grid size of the current game. */
  private range = buildRange(DEFAULT_GRID_CELLS);

  /** Sets the floor-grid size (squares per side) of the current game; call it before loading its parts. */
  setSize(cells: number): void {
    this.range = buildRange(cells);
  }

  /**
   * Can `part` be placed? It must be inside the build area, not overlap another part and, for a block or plate, be
   * supported: on the ground, or resting on / hanging from another block or plate with at least one stud engaged
   * (a wheel needs the block it is mounted on instead).
   */
  canPlace(part: Part): boolean {
    // Only the area of the floor grid that is drawn on the ground (see `setSize`).
    const { min, max, maxY } = this.range;
    const box = partBox(part);
    if (box.min[0] < min - 0.5 - EPS || box.max[0] > max + 0.5 + EPS || box.min[2] < min - 0.5 - EPS || box.max[2] > max + 0.5 + EPS) return false;
    if (box.min[1] < GROUND_Y - EPS || box.max[1] > maxY + 0.5 + EPS) return false;
    if (this.get(part.cell) || this.overlapping(part).length > 0) return false;
    if (isMountedType(part.type)) {
      // Wheels go on the side faces of a block, an engine on any face (and may not point into the block it is on).
      if (!part.face) return false;
      if (part.type === 'engine') {
        const front = frontOf(part);
        if (!isAxisDirection(front) || front.every((v, i) => v === -part.face![i])) return false;
      } else if (part.face[1] !== 0) {
        return false;
      }
      return this.get(subVec(part.cell, part.face))?.type === 'block';
    }
    // Blocks and plates: on the ground, or at least one stud engaged with a part above or below.
    return box.min[1] <= GROUND_Y + EPS || this.engagedStuds(part) > 0;
  }

  /** How many studs `part` would engage with the blocks and plates touching it above and below. */
  engagedStuds(part: Part): number {
    return this.all().reduce((sum, other) => sum + studsEngaged(part, other), 0);
  }

  /** The blocks and plates connected to `part` by studs (one rests on the other with at least one stud engaged). */
  linkedParts(part: Part): Part[] {
    return this.all().filter((other) => cellKey(other.cell) !== cellKey(part.cell) && studsEngaged(part, other) > 0);
  }

  add(part: Part): boolean {
    if (!this.canPlace(part)) return false;
    this.parts.set(cellKey(part.cell), part);
    this.emit();
    return true;
  }

  /** Adds every part that can be placed (in order) and notifies listeners once. Returns how many were added. */
  addMany(parts: Part[]): number {
    let added = 0;
    for (const part of parts) {
      if (!this.canPlace(part)) continue;
      this.parts.set(cellKey(part.cell), part);
      added++;
    }
    if (added > 0) this.emit();
    return added;
  }

  /**
   * Paints the part at `cell` with `color` (`#rrggbb`), or restores its default colour with `null`. Parts are replaced,
   * not mutated (history snapshots share them). Returns false, changing nothing, when there is no such part, it cannot
   * be painted (`PART_INFO[type].paintable`), the colour is invalid or it already has that colour.
   */
  paint(cell: Vec3, color: string | null): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].paintable || (color !== null && !isHexColor(color))) return false;
    if ((part.color ?? null) === (color && color.toLowerCase())) return false;
    const { color: _old, ...rest } = part;
    this.parts.set(cellKey(part.cell), color === null ? rest : { ...rest, color: color.toLowerCase() });
    this.emit();
    return true;
  }

  /**
   * Sets the suspension strength (0-100) of the wheel at `cell`; the default strength is stored as "not set". Returns
   * false, changing nothing, when there is no such part, it has no suspension or the value does not change it.
   */
  setSuspension(cell: Vec3, strength: number): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasSuspension || !Number.isFinite(strength)) return false;
    const value = clampSuspension(strength);
    if (clampSuspension(part.suspension ?? SUSPENSION.defaultStrength) === value) return false;
    const { suspension: _old, ...rest } = part;
    this.parts.set(cellKey(part.cell), value === SUSPENSION.defaultStrength ? rest : { ...rest, suspension: value });
    this.emit();
    return true;
  }

  /**
   * Sets the power (an integer from `ENGINE.min` to `ENGINE.max`) of the engine at `cell`, or of every engine welded to its body
   * with `connected`; the default power is stored as "not set". Returns false, changing nothing, when there is no such
   * engine or no engine changes.
   */
  setPower(cell: Vec3, power: number, connected = false): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasPower || !Number.isFinite(power)) return false;
    const value = clampPower(power);
    let changed = false;
    for (const target of connected ? this.enginesOnBody(part.cell) : [part]) {
      if (powerOf(target) === value) continue;
      const { power: _old, ...rest } = target;
      this.parts.set(cellKey(target.cell), value === ENGINE.default ? rest : { ...rest, power: value });
      changed = true;
    }
    if (changed) this.emit();
    return changed;
  }

  /** The engines mounted on the same rigid body as the block or engine at `cell` (the engine itself included); [] when there is none. */
  enginesOnBody(cell: Vec3): Part[] {
    const part = this.get(cell);
    if (!part) return [];
    const host = part.type === 'engine' && part.face ? subVec(part.cell, part.face) : part.cell;
    return this.connectedBlockParts(host).flatMap((block) => this.mountedOn(block.cell).filter((p) => PART_INFO[p.type].hasPower));
  }

  /**
   * Sets the weight (an integer from `WEIGHT.min` to `WEIGHT.max`) of the block at `cell`, or of every block welded to it
   * with `connected`; the default weight is stored as "not set". Returns false, changing nothing, when there is no such
   * block, it has no weight or no block changes.
   */
  setWeight(cell: Vec3, weight: number, connected = false): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasWeight || !Number.isFinite(weight)) return false;
    const value = clampWeight(weight);
    let changed = false;
    for (const target of connected ? this.connectedBlockParts(part.cell) : [part]) {
      if (weightOf(target) === value) continue;
      const { weight: _old, ...rest } = target;
      this.parts.set(cellKey(target.cell), value === WEIGHT.default ? rest : { ...rest, weight: value });
      changed = true;
    }
    if (changed) this.emit();
    return changed;
  }

  /**
   * Sets the tire (an integer from `TIRE.min` to `TIRE.max`) of the wheel at `cell`, or of every wheel on the same body
   * with `wholeBody` (see `wheelsOnBody`); the default tire is stored as "not set". Returns false, changing nothing,
   * when there is no such part, it has no tires or no wheel changes.
   */
  setTire(cell: Vec3, tire: number, wholeBody = false): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasTire || !Number.isFinite(tire)) return false;
    const value = clampTire(tire);
    let changed = false;
    for (const target of wholeBody ? this.wheelsOnBody(part.cell) : [part]) {
      if (tireValueOf(target) === value) continue;
      const { tire: _old, ...rest } = target;
      this.parts.set(cellKey(target.cell), value === TIRE.default ? rest : { ...rest, tire: value });
      changed = true;
    }
    if (changed) this.emit();
    return changed;
  }

  /**
   * Removes the part whose centre is `cell`; removing a block also removes the wheels mounted on it. Parts that rested on
   * it stay where they are (they simply stop being supported).
   */
  remove(cell: Vec3): void {
    const part = this.get(cell);
    if (!part) return;
    this.parts.delete(cellKey(part.cell));
    if (part.type === 'block') {
      for (const mounted of this.mountedOn(part.cell)) this.parts.delete(cellKey(mounted.cell));
    }
    this.emit();
  }

  clear(): void {
    this.parts.clear();
    this.emit();
  }

  load(parts: Part[]): void {
    this.parts.clear();
    for (const p of parts) {
      const clean = sanitize(p);
      if (clean) this.parts.set(cellKey(clean.cell), clean);
    }
    this.emit();
  }

  /** The blocks and plates welded together with the part at `cell` (linked by studs, see `linkedParts`: they form one rigid body), itself included; [] if none. */
  connectedBlockParts(cell: Vec3): Part[] {
    const start = this.get(cell);
    if (!start || !isStructural(start.type)) return [];
    const seen = new Map<string, Part>([[cellKey(start.cell), start]]);
    const queue: Part[] = [start];
    while (queue.length) {
      for (const n of this.linkedParts(queue.pop()!)) {
        if (!seen.has(cellKey(n.cell))) {
          seen.set(cellKey(n.cell), n);
          queue.push(n);
        }
      }
    }
    return [...seen.values()];
  }

  /** Number of blocks welded together with the block at `cell`; 0 if none. */
  connectedBlocks(cell: Vec3): number {
    return this.connectedBlockParts(cell).length;
  }

  /**
   * Total weight of the blocks and plates welded together with the part at `cell` (what the rigid body weighs): the weight of
   * each part times its volume (a plate is thin, so it weighs a fraction of a block), to one decimal; 0 if none.
   */
  connectedWeight(cell: Vec3): number {
    const blocks = this.connectedBlockParts(cell);
    if (blocks.length === 0) return 0;
    const engines = blocks.reduce((total, p) => total + this.mountedOn(p.cell).filter((m) => m.type === 'engine').length, 0);
    const sum = blocks.reduce((total, p) => total + weightOf(p) * partVolume(p as Part & { type: StructuralType }), 0) + engines * ENGINE.mass * WEIGHT.default;
    return Math.round(sum * 10) / 10;
  }

  /**
   * The wheels (of any size) mounted on the same rigid body as the wheel at `cell`: those on the host block of that wheel
   * and on every block welded to it, the wheel itself included; [] when there is no such wheel.
   */
  wheelsOnBody(cell: Vec3): Part[] {
    const wheel = this.get(cell);
    if (!wheel || !isWheelType(wheel.type) || !wheel.face) return [];
    const hostCell = subVec(wheel.cell, wheel.face);
    return this.connectedBlockParts(hostCell).flatMap((block) => this.wheelsOn(block.cell));
  }

  /** Wheels (of any size) mounted on the block at `cell`. */
  wheelsOn(cell: Vec3): Part[] {
    return this.mountedOn(cell).filter((p) => isWheelType(p.type));
  }

  /** The parts mounted on a face of the block at `cell`: its wheels and engines. */
  mountedOn(cell: Vec3): Part[] {
    return this.all().filter((p) => isMountedType(p.type) && p.face && cellKey(subVec(p.cell, p.face)) === cellKey(cell));
  }

}

/**
 * Cleans a part from a save: drops what its type does not allow (a bad or forbidden paint / suspension / tire / weight) and
 * converts older shapes. Returns null for a part that cannot be kept.
 */
function sanitize(part: Part): Part | null {
  const { color, suspension, tire: savedTire, weight, power, studs, spin, pitch, front, ...rest } = part as Part & { layers?: number };
  const info = PART_INFO[part.type];
  if (!info) return null; // a type this version does not know
  let out: Part = { ...rest };
  delete (out as { layers?: number }).layers;
  if (part.type === 'plate') {
    // Plates used to be thin slabs inside a cell, lying against any face. They now rest on studs, so only the flat ones
    // survive: the slab's centre becomes the part's centre.
    const face = part.face;
    delete out.face;
    if (face && face[1] === 0) return null; // a standing plate cannot be connected
    if (face) out = { ...out, cell: [part.cell[0], part.cell[1] + (face[1] > 0 ? -0.4 : 0.4), part.cell[2]] };
  }
  const tire = legacyTireValue(savedTire); // saves from when the tire was one of three named types
  if (color !== undefined && isHexColor(color) && info.paintable) out.color = color;
  if (suspension !== undefined && typeof suspension === 'number' && info.hasSuspension) out.suspension = clampSuspension(suspension);
  if (typeof tire === 'number' && info.hasTire) out.tire = clampTire(tire);
  if (power !== undefined && typeof power === 'number' && info.hasPower) out.power = clampPower(power);
  if (weight !== undefined && typeof weight === 'number' && info.hasWeight) out.weight = clampWeight(weight);
  if (isStructural(part.type) && isAxisDirection(studs) && !(studs[0] === 0 && studs[1] === 1 && studs[2] === 0)) out.studs = studs;
  if (isStructural(part.type) && isSpin(spin) && spin % SHAPES[part.type].spins !== 0) out.spin = spin % SHAPES[part.type].spins;
  if (part.type === 'wheel' && (pitch === 1 || pitch === -1)) out.pitch = pitch;
  if (part.type === 'engine') {
    if (!part.face) return null; // an engine is always mounted on a block
    if (isAxisDirection(front) && !front.every((v, i) => v === -part.face![i]) && !front.every((v, i) => v === part.face![i])) out.front = front;
  }
  return out;
}
