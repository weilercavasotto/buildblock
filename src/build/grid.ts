import { DEFAULT_GRID_CELLS, GROUND_Y, PART_INFO, SHAPES, SUSPENSION, TIRE, WEIGHT, buildRange, clampSuspension, clampTire, clampBrake, clampPower, clampRotorSpeed, clampStroke, clampWeight, legacyTireValue, tireValueOf, brakeOf, partVolume, powerOf, rotorSpeedOf, strokeOf, weightOf, ENGINE, PISTON, PARACHUTE, LAMP, SKI, PROPELLER, ROTOR, THRUSTER, TURBO, BRAKE, HINGE, SPRING, clampSpringStiffness, springStiffnessOf, clampHingeAngle, clampHingeStrength, hingeAngleOf, hingeStrengthOf, MAX_KEYS_PER_ACTION, actionsOf, isKeyed, isValidKey, keysOf } from '../constants';
import { canonicalOrientation, isSpin, legacyOrientation, orientationFields } from '../parts/orientation';
import { EPS, boxesOverlap, partBox, partBoxes, partsOverlap, studsEngaged, wheelBox } from '../parts/part-geometry';
import { Part, Vec3, addVec, cellKey, isAxisDirection, isHexColor, isStructural, isWheelType, isMountedType, isHeaded, isHostType, isMountHost, canHost, frontOf, studsOf, subVec, StructuralType } from '../types';

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
      } else if (part.type === 'ski') {
        // A ski lies flat (studs up) on a side face with its length along the face, so its arm reaches the block.
        if (part.face[1] !== 0 || studsOf(part)[1] !== 1) return false;
        if (frontOf(part).some((v, i) => v !== 0 && part.face![i] !== 0)) return false;
      } else if (part.type === 'propeller' || part.type === 'parachute' || part.type === 'lamp') {
        if (frontOf(part).every((v, i) => v === -part.face![i])) return false; // its blades (canopy, lens) would be inside the block
      } else if (isHeaded(part.type)) {
        if (studsOf(part).some((v, i) => v !== part.face![i])) return false; // the head (its studs, local up) must point away from the block: the part is never turned for the player
      } else if (part.type !== 'turbo' && part.type !== 'thruster' && part.face[1] !== 0) {
        return false; // a turbo, a thruster, a propeller, a rotor and a piston go on any face, like the engine; the wheels only on the sides
      }
      if (isWheelType(part.type)) {
        // Two wheels may not overlap each other (they are bigger than a cell, so neighbours can).
        const tire = wheelBox(part);
        if (this.all().some((other) => isWheelType(other.type) && boxesOverlap(tire, wheelBox(other)))) return false;
      }
      return this.hostOf(part) !== null;
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
      if (isMountHost(current.type)) for (const mounted of this.mountedOn(current.cell)) moving.set(cellKey(mounted.cell), mounted);
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

  /**
   * Changes the keys of an action (see `Part.keys`) of the parts at `cells`: `edit` gets the keys the part has for it and returns the
   * new list (cleaned: valid, no repeats, at most `MAX_KEYS_PER_ACTION`). Only parts that have that action change. Returns false,
   * changing nothing, when no part changes.
   */
  editKeys(cells: ReadonlyArray<Vec3>, action: string, edit: (keys: readonly string[]) => readonly string[]): boolean {
    let changed = false;
    for (const cell of cells) {
      const part = this.get(cell);
      if (!part || !actionsOf(part).some((a) => a.id === action)) continue;
      const before = keysOf(part, action);
      const after = cleanKeys(edit(before));
      if (after.length === before.length && after.every((k, i) => k === before[i])) continue;
      this.parts.set(cellKey(part.cell), withKeys(part, { ...part.keys, [action]: after }));
      changed = true;
    }
    if (changed) this.emit();
    return changed;
  }

  /** Gives `keys` (all the actions of a part at once, see `Part.keys`) to the parts at `cells`: only the actions each part has are kept. */
  assignKeys(cells: ReadonlyArray<Vec3>, keys: Part['keys']): boolean {
    let changed = false;
    for (const cell of cells) {
      const part = this.get(cell);
      if (!part || !isKeyed(part)) continue;
      const next: Record<string, string[]> = {};
      for (const action of actionsOf(part)) next[action.id] = cleanKeys(keys?.[action.id] ?? []);
      const updated = withKeys(part, next);
      if (JSON.stringify(updated.keys ?? null) === JSON.stringify(part.keys ?? null)) continue;
      this.parts.set(cellKey(part.cell), updated);
      changed = true;
    }
    if (changed) this.emit();
    return changed;
  }

  /**
   * Sets how far the hinge at `cell` opens (`HINGE.min` to `HINGE.max` steps of `HINGE.angleStep` degrees); the default is stored as
   * "not set". Returns false, changing nothing, when there is no such part or nothing changes.
   */
  setAngle(cell: Vec3, angle: number): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasAngle || !Number.isFinite(angle)) return false;
    const value = clampHingeAngle(angle);
    if (hingeAngleOf(part) === value) return false;
    const { angle: _old, ...rest } = part;
    this.parts.set(cellKey(part.cell), value === HINGE.default ? rest : { ...rest, angle: value });
    this.emit();
    return true;
  }

  /** Sets the servo strength (`HINGE.strengthMin` to `HINGE.strengthMax`) of the hinge at `cell`; the default is stored as "not set". Returns false, changing nothing, when there is no such part or nothing changes. */
  setStrength(cell: Vec3, strength: number): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasAngle || !Number.isFinite(strength)) return false;
    const value = clampHingeStrength(strength);
    if (hingeStrengthOf(part) === value) return false;
    const { strength: _old, ...rest } = part;
    this.parts.set(cellKey(part.cell), value === HINGE.strengthDefault ? rest : { ...rest, strength: value });
    this.emit();
    return true;
  }

  /** Sets the stiffness (`SPRING.stiffnessMin` to `SPRING.stiffnessMax`) of the spring at `cell`; the default is stored as "not set". Returns false, changing nothing, when there is no such part or nothing changes. */
  setStiffness(cell: Vec3, stiffness: number): boolean {
    const part = this.get(cell);
    if (!part || !PART_INFO[part.type].hasStiffness || !Number.isFinite(stiffness)) return false;
    const value = clampSpringStiffness(stiffness);
    if (springStiffnessOf(part) === value) return false;
    const { stiffness: _old, ...rest } = part;
    this.parts.set(cellKey(part.cell), value === SPRING.stiffnessDefault ? rest : { ...rest, stiffness: value });
    this.emit();
    return true;
  }

  /** The parts of `type` mounted on the same rigid body as the block or mounted part at `cell` (itself included); [] when there is none. */
  mountedOfTypeOnBody(cell: Vec3, type: Part['type']): Part[] {
    const part = this.get(cell);
    if (!part) return [];
    const host = isMountedType(part.type) && part.face ? this.hostOf(part)?.cell : part.cell;
    if (!host) return [];
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

  /** The propellers mounted on the same rigid body as the block or propeller at `cell` (the propeller itself included); [] when there is none. */
  propellersOnBody(cell: Vec3): Part[] {
    return this.mountedOfTypeOnBody(cell, 'propeller');
  }

  /** The parachutes mounted on the same rigid body as the block or parachute at `cell` (the parachute itself included); [] when there is none. */
  parachutesOnBody(cell: Vec3): Part[] {
    return this.mountedOfTypeOnBody(cell, 'parachute');
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
   * Sets the brake strength (1-10) of the wheel at `cell`, or of every wheel on the same body with `wholeBody` (see `wheelsOnBody`);
   * the default strength is stored as "not set". Returns false, changing nothing, when there is no such wheel or no wheel changes.
   */
  setBrake(cell: Vec3, strength: number, wholeBody = false): boolean {
    const part = this.get(cell);
    if (!part || !isWheelType(part.type) || !Number.isFinite(strength)) return false;
    const value = clampBrake(strength);
    let changed = false;
    for (const target of wholeBody ? this.wheelsOnBody(part.cell) : [part]) {
      if (brakeOf(target) === value) continue;
      const { brake: _old, ...rest } = target;
      this.parts.set(cellKey(target.cell), value === BRAKE.default ? rest : { ...rest, brake: value });
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
    // What is mounted on it is found through the block, so it is listed before the block goes.
    const mounted = isMountHost(part.type) ? this.mountedOn(part.cell) : [];
    this.parts.delete(cellKey(part.cell));
    for (const m of mounted) this.parts.delete(cellKey(m.cell));
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
    const mountedMass = blocks.flatMap((p) => this.mountedOn(p.cell)).reduce((total, m) => total + (m.type === 'engine' ? ENGINE.mass : m.type === 'turbo' ? TURBO.mass : m.type === 'thruster' ? THRUSTER.mass : m.type === 'propeller' ? PROPELLER.mass : m.type === 'parachute' ? PARACHUTE.mass : m.type === 'lamp' ? LAMP.mass : m.type === 'ski' ? SKI.mass : 0), 0);
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
    const host = this.hostOf(wheel);
    if (!host) return [];
    return this.connectedBlockParts(host.cell).flatMap((block) => this.wheelsOn(block.cell));
  }

  /** Wheels (of any size) mounted on the block at `cell`. */
  wheelsOn(cell: Vec3): Part[] {
    return this.mountedOn(cell).filter((p) => isWheelType(p.type));
  }

  /** The parts mounted on a face of the block at `cell`: its wheels, engines and the rest (see `hostOf`). */
  mountedOn(cell: Vec3): Part[] {
    const key = cellKey(cell);
    return this.all().filter((p) => isMountedType(p.type) && p.face && p.face && cellKey(this.hostOf(p)?.cell ?? [NaN, NaN, NaN]) === key);
  }

  /**
   * The block a mounted part sits on: the one (of `HOST_TYPES`, or a plate for a spring) whose face, the one the part's `face` points away from, contains the
   * middle of the part's back, the point half a cell behind its `cell`. For a plain block that is the block next to it, as it always
   * was; a bigger block has many places on each face. Null for a part that is not mounted or has no host.
   */
  hostOf(part: Pick<Part, 'type' | 'cell' | 'face'>): Part | null {
    if (!isMountedType(part.type) || !part.face) return null;
    const face = part.face;
    const axis = face.findIndex((v) => v !== 0);
    const point = [0, 1, 2].map((i) => part.cell[i] - face[i] / 2);
    for (const host of this.parts.values()) {
      if (!canHost(host.type, part.type)) continue;
      // A block is one box; another flat part (a bracket does not fill its bounding box) is checked box by box.
      for (const box of isHostType(host.type) ? [partBox(host)] : partBoxes(host)) {
        if (Math.abs((face[axis] > 0 ? box.max[axis] : box.min[axis]) - point[axis]) > EPS) continue;
        if ([0, 1, 2].every((i) => i === axis || (point[i] >= box.min[i] - EPS && point[i] <= box.max[i] + EPS))) return host;
      }
    }
    return null;
  }

}

/**
 * Cleans a part from a save: drops what its type does not allow (a bad or forbidden paint / suspension / tire / weight) and
 * converts older shapes. Returns null for a part that cannot be kept.
 */
/** The keys of an action, cleaned: only valid keys, each once, at most `MAX_KEYS_PER_ACTION`. */
function cleanKeys(keys: ReadonlyArray<unknown>): string[] {
  return [...new Set(keys.filter(isValidKey))].slice(0, MAX_KEYS_PER_ACTION);
}

/** The part with `keys` (empty actions dropped; no `keys` at all when none is left). */
function withKeys(part: Part, keys: Record<string, string[] | undefined>): Part {
  const { keys: _old, ...rest } = part;
  const kept = Object.fromEntries(Object.entries(keys).filter(([, list]) => list && list.length > 0));
  return Object.keys(kept).length > 0 ? { ...rest, keys: kept as Part['keys'] } : rest;
}

function sanitize(part: Part, legacyFormat: boolean): Part | null {
  const { color, suspension, tire: savedTire, weight, power, speed, stroke, angle, brake, key, keys, strength, stiffness, studs, spin, pitch, front, rotation, ...rest } = part as Part & {
    layers?: number;
    rotation?: number;
    pitch?: number;
    front?: Vec3;
    key?: string;
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
  if (angle !== undefined && typeof angle === 'number' && info.hasAngle && clampHingeAngle(angle) !== HINGE.default) out.angle = clampHingeAngle(angle);
  if (strength !== undefined && typeof strength === 'number' && info.hasAngle && clampHingeStrength(strength) !== HINGE.strengthDefault) out.strength = clampHingeStrength(strength);
  if (stiffness !== undefined && typeof stiffness === 'number' && info.hasStiffness && clampSpringStiffness(stiffness) !== SPRING.stiffnessDefault) out.stiffness = clampSpringStiffness(stiffness);
  if (brake !== undefined && typeof brake === 'number' && isWheelType(part.type) && clampBrake(brake) !== BRAKE.default) out.brake = clampBrake(brake);
  if (weight !== undefined && typeof weight === 'number' && info.hasWeight) out.weight = clampWeight(weight);
  // Keys: saved per action. A game saved with one `key` per part (before actions) gets it on the part's first action (a wheel's brake).
  if (isKeyed(part)) {
    const saved: Record<string, unknown> = typeof keys === 'object' && keys !== null ? (keys as Record<string, unknown>) : {};
    if (isValidKey(key) && Object.keys(saved).length === 0) saved[isWheelType(part.type) ? 'brake' : actionsOf(part)[0].id] = [key];
    const clean: Record<string, string[]> = {};
    for (const action of actionsOf(part)) {
      const list = cleanKeys(Array.isArray(saved[action.id]) ? (saved[action.id] as unknown[]) : []);
      if (list.length > 0) clean[action.id] = list;
    }
    if (Object.keys(clean).length > 0) out.keys = clean;
  }
  if (isMountedType(part.type) && !part.face) return null; // wheels and engines are always mounted on a block
  // Orientation: the same fields for every part. Wheels and engines saved before that had `rotation` / `pitch` / `front`.
  const fromLegacy = isMountedType(part.type) && (rotation !== undefined || pitch !== undefined || front !== undefined || (legacyFormat && studs === undefined && spin === undefined));
  const orientation = fromLegacy
    ? legacyOrientation({ type: part.type, face: part.face, rotation, pitch, front }, legacyFormat)
    : canonicalOrientation(part.type, { studs: isAxisDirection(studs) ? studs : [0, 1, 0], spin: isSpin(spin) ? spin : 0 });
  return { ...out, ...orientationFields(orientation) };
}
