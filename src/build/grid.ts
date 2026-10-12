import { DEFAULT_GRID_CELLS, PART_INFO, SUSPENSION, TIRE, WEIGHT, buildRange, clampSuspension, clampTire, clampWeight, legacyTireValue, tireValueOf, weightOf } from '../constants';
import { Part, Vec3, addVec, cellKey, isHexColor, isWheelType, partCells, subVec } from '../types';

export class Grid {
  /** Every part, keyed by its own `cell`. */
  private parts = new Map<string, Part>();
  /** Which part occupies each cell (key of the occupied cell -> key of the part's `cell`); a large wheel occupies 4 cells. */
  private occupant = new Map<string, string>();
  private listeners: Array<() => void> = [];

  subscribe(fn: () => void): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  /** The part occupying `cell` (for a large wheel, any of its 4 cells), if any. */
  get(cell: Vec3): Part | undefined {
    const owner = this.occupant.get(cellKey(cell));
    return owner === undefined ? undefined : this.parts.get(owner);
  }

  /** Stores `part` and marks the cells it occupies. */
  private put(part: Part): void {
    this.parts.set(cellKey(part.cell), part);
    for (const cell of partCells(part)) this.occupant.set(cellKey(cell), cellKey(part.cell));
  }

  /** Forgets `part` and frees its cells. */
  private drop(part: Part): void {
    this.parts.delete(cellKey(part.cell));
    for (const cell of partCells(part)) this.occupant.delete(cellKey(cell));
  }

  all(): Part[] {
    return [...this.parts.values()];
  }

  /** Buildable cells (x / z and height), from the floor-grid size of the current game. */
  private range = buildRange(DEFAULT_GRID_CELLS);

  /** Sets the floor-grid size (squares per side) of the current game; call it before loading its parts. */
  setSize(cells: number): void {
    this.range = buildRange(cells);
  }

  canPlace(part: Part): boolean {
    // Only cells over the floor grid that is drawn on the ground (see `setSize`).
    const { min, max, maxY } = this.range;
    for (const cell of partCells(part)) {
      if (cell[1] < 0 || cell[1] > maxY || cell[0] < min || cell[0] > max || cell[2] < min || cell[2] > max) return false;
      if (this.get(cell)) return false;
    }
    if (isWheelType(part.type)) {
      if (!part.face || part.face[1] !== 0) return false;
      return this.get(subVec(part.cell, part.face))?.type === 'block';
    }
    return true;
  }

  add(part: Part): boolean {
    if (!this.canPlace(part)) return false;
    this.put(part);
    this.emit();
    return true;
  }

  /** Adds every part that can be placed (in order) and notifies listeners once. Returns how many were added. */
  addMany(parts: Part[]): number {
    let added = 0;
    for (const part of parts) {
      if (!this.canPlace(part)) continue;
      this.put(part);
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
   * Removes the part occupying `cell` (any of the cells of a large wheel); removing a block also removes the wheels
   * mounted on it.
   */
  remove(cell: Vec3): void {
    const part = this.get(cell);
    if (!part) return;
    this.drop(part);
    if (part.type === 'block') {
      for (const wheel of this.wheelsOn(part.cell)) this.drop(wheel);
    }
    this.emit();
  }

  clear(): void {
    this.parts.clear();
    this.occupant.clear();
    this.emit();
  }

  load(parts: Part[]): void {
    this.parts.clear();
    this.occupant.clear();
    for (const p of parts) this.put(sanitize(p));
    this.emit();
  }

  /** The blocks welded together with the block at `cell` (touching blocks form one rigid body), itself included; [] if none. */
  connectedBlockParts(cell: Vec3): Part[] {
    const start = this.get(cell);
    if (start?.type !== 'block') return [];
    const seen = new Map<string, Part>([[cellKey(start.cell), start]]);
    const queue: Part[] = [start];
    while (queue.length) {
      for (const n of this.neighbors(queue.pop()!.cell)) {
        if (n.type === 'block' && !seen.has(cellKey(n.cell))) {
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

  /** Total weight of the blocks welded together with the block at `cell` (what the rigid body weighs); 0 if none. */
  connectedWeight(cell: Vec3): number {
    return this.connectedBlockParts(cell).reduce((sum, p) => sum + weightOf(p), 0);
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
    return this.all().filter((p) => isWheelType(p.type) && p.face && cellKey(subVec(p.cell, p.face)) === cellKey(cell));
  }

  neighbors(cell: Vec3): Part[] {
    const dirs: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    return dirs.map((d) => this.get(addVec(cell, d))).filter((p): p is Part => !!p);
  }
}

/** Drops what a save may carry that its part type does not allow (a bad or forbidden paint / suspension / tire / weight). */
function sanitize(part: Part): Part {
  const { color, suspension, tire: savedTire, weight, ...rest } = part;
  const tire = legacyTireValue(savedTire); // saves from when the tire was one of three named types
  const info = PART_INFO[part.type];
  const out: Part = { ...rest };
  if (color !== undefined && isHexColor(color) && info.paintable) out.color = color;
  if (suspension !== undefined && typeof suspension === 'number' && info.hasSuspension) out.suspension = clampSuspension(suspension);
  if (typeof tire === 'number' && info.hasTire) out.tire = clampTire(tire);
  if (weight !== undefined && typeof weight === 'number' && info.hasWeight) out.weight = clampWeight(weight);
  return out;
}
