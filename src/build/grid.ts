import { DEFAULT_GRID_CELLS, DEFAULT_TIRE, PART_INFO, SUSPENSION, buildRange, clampSuspension, isTireId } from '../constants';
import { Part, Vec3, addVec, cellKey, isHexColor, subVec } from '../types';

export class Grid {
  private parts = new Map<string, Part>();
  private listeners: Array<() => void> = [];

  subscribe(fn: () => void): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  get(cell: Vec3): Part | undefined {
    return this.parts.get(cellKey(cell));
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
    if (part.cell[1] < 0 || part.cell[1] > maxY || part.cell[0] < min || part.cell[0] > max || part.cell[2] < min || part.cell[2] > max) return false;
    if (this.get(part.cell)) return false;
    if (part.type === 'wheel') {
      if (!part.face || part.face[1] !== 0) return false;
      return this.get(subVec(part.cell, part.face))?.type === 'block';
    }
    return true;
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
    this.parts.set(cellKey(cell), color === null ? rest : { ...rest, color: color.toLowerCase() });
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
    this.parts.set(cellKey(cell), value === SUSPENSION.defaultStrength ? rest : { ...rest, suspension: value });
    this.emit();
    return true;
  }

  /**
   * Sets the tire type (an id of `TIRES`) of the wheel at `cell`; the default tire is stored as "not set". Returns false,
   * changing nothing, when there is no such part, it has no tires, the id is unknown or it does not change it.
   */
  setTire(cell: Vec3, tire: string): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasTire || !isTireId(tire)) return false;
    if ((part.tire ?? DEFAULT_TIRE) === tire) return false;
    const { tire: _old, ...rest } = part;
    this.parts.set(cellKey(cell), tire === DEFAULT_TIRE ? rest : { ...rest, tire });
    this.emit();
    return true;
  }

  /** Removes the part at `cell`; removing a block also removes the wheels mounted on it. */
  remove(cell: Vec3): void {
    const part = this.get(cell);
    if (!part) return;
    this.parts.delete(cellKey(cell));
    if (part.type === 'block') {
      for (const other of this.all()) {
        if (other.type === 'wheel' && other.face && cellKey(subVec(other.cell, other.face)) === cellKey(cell)) {
          this.parts.delete(cellKey(other.cell));
        }
      }
    }
    this.emit();
  }

  clear(): void {
    this.parts.clear();
    this.emit();
  }

  load(parts: Part[]): void {
    this.parts.clear();
    for (const p of parts) this.parts.set(cellKey(p.cell), sanitize(p));
    this.emit();
  }

  /** Number of blocks welded together with the block at `cell` (touching blocks form one rigid body); 0 if none. */
  connectedBlocks(cell: Vec3): number {
    if (this.get(cell)?.type !== 'block') return 0;
    const seen = new Set([cellKey(cell)]);
    const queue: Vec3[] = [cell];
    while (queue.length) {
      for (const n of this.neighbors(queue.pop()!)) {
        if (n.type === 'block' && !seen.has(cellKey(n.cell))) {
          seen.add(cellKey(n.cell));
          queue.push(n.cell);
        }
      }
    }
    return seen.size;
  }

  /** Wheels mounted on the block at `cell`. */
  wheelsOn(cell: Vec3): Part[] {
    return this.all().filter((p) => p.type === 'wheel' && p.face && cellKey(subVec(p.cell, p.face)) === cellKey(cell));
  }

  neighbors(cell: Vec3): Part[] {
    const dirs: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    return dirs.map((d) => this.get(addVec(cell, d))).filter((p): p is Part => !!p);
  }
}

/** Drops what a save may carry that its part type does not allow (a bad or forbidden paint / suspension / tire). */
function sanitize(part: Part): Part {
  const { color, suspension, tire, ...rest } = part;
  const info = PART_INFO[part.type];
  const out: Part = { ...rest };
  if (color !== undefined && isHexColor(color) && info.paintable) out.color = color;
  if (suspension !== undefined && typeof suspension === 'number' && info.hasSuspension) out.suspension = clampSuspension(suspension);
  if (tire !== undefined && isTireId(tire) && info.hasTire) out.tire = tire;
  return out;
}
