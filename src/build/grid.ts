import { Part, Vec3, addVec, cellKey, subVec } from '../types';

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

  canPlace(part: Part): boolean {
    if (part.cell[1] < 0 || this.get(part.cell)) return false;
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
    for (const p of parts) this.parts.set(cellKey(p.cell), p);
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
