import { DEFAULT_GRID_CELLS, GROUND_Y, PART_INFO, SHAPES, SUSPENSION, TIRE, WEIGHT, buildRange, clampSuspension, clampTire, clampBrake, clampPower, clampRotorSpeed, clampStroke, clampWeight, legacyTireValue, tireValueOf, brakeOf, partVolume, powerOf, rotorSpeedOf, strokeOf, weightOf, ENGINE, PISTON, ROTOR, THRUSTER, TURBO } from '../constants';
import { canonicalOrientation, isSpin, legacyOrientation, orientationFields } from '../parts/orientation';
import { EPS, partBox, partsOverlap, studsEngaged } from '../parts/part-geometry';
import { Part, Vec3, addVec, cellKey, isAxisDirection, isHexColor, isStructural, isWheelType, isMountedType, isHeaded, frontOf, studsOf, subVec, StructuralType } from '../types';

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
   * (a wheel needs the block it is mounted on instead). With `needsSupport` false that support is not required (moving a selection
   * may leave it hanging, like removing a part leaves what rested on it).
   */
  canPlace(part: Part, needsSupport = true): boolean {
    // Only the area of the floor grid that is drawn on the ground (see `setSize`).
    const { min, max, maxY } = this.range;
    const box = partBox(part);
    if (box.min[0] < min - 0.5 - EPS || box.max[0] > max + 0.5 + EPS || box.min[2] < min - 0.5 - EPS || box.max[2] > max + 0.5 + EPS) return false;
    if (box.min[1] < GROUND_Y - EPS || box.max[1] > maxY + 0.5 + EPS) return false;
    if (this.get(part.cell) || this.overlapping(part).length > 0) return false;
    if (isMountedType(part.type)) {
      // Wheels go on the side faces of a block, an engine and a turbo on any face, but its front may not point into the block it is on and it
      // may not be upside down (its cylinder heads, its local up, pointing down).
      if (!part.face) return false;
      if (part.type === 'engine') {
        if (frontOf(part).every((v, i) => v === -part.face![i])) return false;
        if (studsOf(part)[1] === -1) return false;
      } else if (isHeaded(part.type)) {
        if (studsOf(part).some((v, i) => v !== part.face![i])) return false; // the head (its studs, local up) must point away from the block: the part is never turned for the player
      } else if (part.type !== 'turbo' && part.type !== 'thruster' && part.face[1] !== 0) {
        return false; // a turbo, a thruster, a rotor and a piston go on any face, like the engine; the wheels only on the sides
      }
      return this.get(subVec(part.cell, part.face))?.type === 'block';
    }
    // Blocks and plates: on the ground, or at least one stud engaged with a part above or below.
    return !needsSupport || box.min[1] <= GROUND_Y + EPS || this.engagedStuds(part) > 0;
  }

  /** How many studs `part` would engage with the blocks and plates touching it above and below. */
  engagedStuds(part: Part): number {
    return this.all().reduce((sum, other) => sum + studsEngaged(part, other), 0);
  }

  /** The blocks and plates connected to `part` by studs (one rests on the other with at least one stud engaged); the head of a rotor or a piston is not one: what it holds moves on it. */
  linkedParts(part: Part): Part[] {
    return this.all().filter((other) => isStructural(other.type) && cellKey(other.cell) !== cellKey(part.cell) && studsEngaged(part, other) > 0);
  }

  add(part: Part): boolean {
    if (!this.canPlace(part)) return false;
    this.parts.set(cellKey(part.cell), part);
    this.emit();
    return true;
  }

  /**
   * Moves `parts` (and what is mounted on the blocks among them) by `delta` cells as one group, only if every part can be placed
   * where it lands, checked like a normal placement (build area, no overlap, a host block for what is mounted) but without needing
   * support: a lifted selection may hang in the air. The group is put back from the bottom up. Returns the moved versions of `parts` (in order), or
   * null, changing nothing, when any part cannot go. Listeners are told once.
   */
  moveParts(parts: ReadonlyArray<Part>, delta: Vec3): Part[] | null {
    const moving = new Map<string, Part>();
    for (const part of parts) {
      const current = this.get(part.cell);
      if (!current) return null;
      moving.set(cellKey(current.cell), current);
      if (current.type === 'block') for (const mounted of this.mountedOn(current.cell)) moving.set(cellKey(mounted.cell), mounted);
    }
    const before = new Map(this.parts);
    for (const key of moving.keys()) this.parts.delete(key);
    const order = [...moving.values()].sort((a, b) => Number(isMountedType(a.type)) - Number(isMountedType(b.type)) || partBox(a).min[1] - partBox(b).min[1]);
    const moved = new Map<string, Part>();
    for (const part of order) {
      const next: Part = { ...part, cell: addVec(part.cell, delta) };
      if (!this.canPlace(next, false)) {
        this.parts = before;
        return null;
      }
      this.parts.set(cellKey(next.cell), next);
      moved.set(cellKey(part.cell), next);
    }
    this.emit();
    return parts.flatMap((p) => {
      const next = moved.get(cellKey(p.cell));
      return next ? [next] : [];
    });
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
   * Sets the power (an integer from `ENGINE.min` to `ENGINE.max`; the boost of a turbo) of the engine or turbo at `cell`, or of
   * every part of the same kind on its body with `connected`; the default power is stored as "not set". Returns false, changing
   * nothing, when there is no such part or nothing changes.
   */
  setPower(cell: Vec3, power: number, connected = false): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasPower || !Number.isFinite(power)) return false;
    const value = clampPower(power);
    let changed = false;
    for (const target of connected ? this.mountedOfTypeOnBody(part.cell, part.type) : [part]) {
      if (powerOf(target) === value) continue;
      const { power: _old, ...rest } = target;
      this.parts.set(cellKey(target.cell), value === ENGINE.default ? rest : { ...rest, power: value });
      changed = true;
    }
    if (changed) this.emit();
    return changed;
  }

  /**
   * Sets the speed (an integer from `-ROTOR.max` to `ROTOR.max`, the sign is the direction) of the rotor at `cell`; the default
   * speed is stored as "not set". Returns false, changing nothing, when there is no such part or nothing changes.
   */
  setSpeed(cell: Vec3, speed: number): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasSpeed || !Number.isFinite(speed)) return false;
    const value = clampRotorSpeed(speed);
    if (rotorSpeedOf(part) === value) return false;
    const { speed: _old, ...rest } = part;
    this.parts.set(cellKey(part.cell), value === ROTOR.default ? rest : { ...rest, speed: value });
    this.emit();
    return true;
  }

  /**
   * Sets how far the piston at `cell` goes out (`PISTON.min` to `PISTON.max` steps of `PISTON.strokeStep` cells); the default is
   * stored as "not set". Returns false, changing nothing, when there is no such part or nothing changes.
   */
  setStroke(cell: Vec3, stroke: number): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasStroke || !Number.isFinite(stroke)) return false;
    const value = clampStroke(stroke);
    if (strokeOf(part) === value) return false;
    const { stroke: _old, ...rest } = part;
    this.parts.set(cellKey(part.cell), value === PISTON.default ? rest : { ...rest, stroke: value });
    this.emit();
    return true;
  }

  /** The parts of `type` mounted on the same rigid body as the block or mounted part at `cell` (itself included); [] when there is none. */
  mountedOfTypeOnBody(cell: Vec3, type: Part['type']): Part[] {
    const part = this.get(cell);
    if (!part) return [];
    const host = isMountedType(part.type) && part.face ? subVec(part.cell, part.face) : part.cell;
    return this.connectedBlockParts(host).flatMap((block) => this.mountedOn(block.cell).filter((p) => p.type === type));
  }

  /** The engines mounted on the same rigid body as the block or engine at `cell` (the engine itself included); [] when there is none. */
  enginesOnBody(cell: Vec3): Part[] {
    return this.mountedOfTypeOnBody(cell, 'engine');
  }

  /** The thrusters mounted on the same rigid body as the block or thruster at `cell` (the thruster itself included); [] when there is none. */
  thrustersOnBody(cell: Vec3): Part[] {
    return this.mountedOfTypeOnBody(cell, 'thruster');
  }

  /** The turbos mounted on the same rigid body as the block or turbo at `cell` (the turbo itself included); [] when there is none. */
  turbosOnBody(cell: Vec3): Part[] {
    return this.mountedOfTypeOnBody(cell, 'turbo');
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
   * Fits a brake of `strength` (1-10) to the wheel at `cell`, or takes its brake off with `null`; with `wholeBody` the same goes
   * for every wheel that already has a brake on the same body (see `wheelsOnBody`). Returns false, changing nothing, when there
   * is no such wheel or no wheel changes.
   */
  setBrake(cell: Vec3, strength: number | null, wholeBody = false): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasBrake || (strength !== null && !Number.isFinite(strength))) return false;
    const value = strength === null ? null : clampBrake(strength);
    let changed = false;
    for (const target of wholeBody ? this.wheelsOnBody(part.cell).filter((w) => cellKey(w.cell) === cellKey(part.cell) || brakeOf(w) > 0) : [part]) {
      if ((value === null ? 0 : value) === brakeOf(target)) continue;
      const { brake: _old, ...rest } = target;
      this.parts.set(cellKey(target.cell), value === null ? rest : { ...rest, brake: value });
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

  /**
   * Replaces everything with `parts` (cleaned: see `sanitize`). `legacyFormat` says the parts were saved before every part was
   * oriented the same way (wheels had `rotation` / `pitch`, engines `front`), so they are converted.
   */
  load(parts: Part[], legacyFormat = false): void {
    this.parts.clear();
    for (const p of parts) {
      const clean = sanitize(p, legacyFormat);
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
    const mountedMass = blocks.flatMap((p) => this.mountedOn(p.cell)).reduce((total, m) => total + (m.type === 'engine' ? ENGINE.mass : m.type === 'turbo' ? TURBO.mass : m.type === 'thruster' ? THRUSTER.mass : 0), 0);
    const sum = blocks.reduce((total, p) => total + weightOf(p) * partVolume(p as Part & { type: StructuralType }), 0) + mountedMass * WEIGHT.default;
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
function sanitize(part: Part, legacyFormat: boolean): Part | null {
  const { color, suspension, tire: savedTire, weight, power, speed, stroke, brake, studs, spin, pitch, front, rotation, ...rest } = part as Part & {
    layers?: number;
    rotation?: number;
    pitch?: number;
    front?: Vec3;
  };
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
  if (speed !== undefined && typeof speed === 'number' && info.hasSpeed) out.speed = clampRotorSpeed(speed);
  if (stroke !== undefined && typeof stroke === 'number' && info.hasStroke) out.stroke = clampStroke(stroke);
  if (brake !== undefined && typeof brake === 'number' && info.hasBrake) out.brake = clampBrake(brake);
  if (weight !== undefined && typeof weight === 'number' && info.hasWeight) out.weight = clampWeight(weight);
  if (isMountedType(part.type) && !part.face) return null; // wheels and engines are always mounted on a block
  // Orientation: the same fields for every part. Wheels and engines saved before that had `rotation` / `pitch` / `front`.
  const fromLegacy = isMountedType(part.type) && (rotation !== undefined || pitch !== undefined || front !== undefined || (legacyFormat && studs === undefined && spin === undefined));
  const orientation = fromLegacy
    ? legacyOrientation({ type: part.type, face: part.face, rotation, pitch, front }, legacyFormat)
    : canonicalOrientation(part.type, { studs: isAxisDirection(studs) ? studs : [0, 1, 0], spin: isSpin(spin) ? spin : 0 });
  return { ...out, ...orientationFields(orientation) };
}
