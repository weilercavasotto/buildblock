import { MOVE_ICONS, HINGE, PISTON, ROTOR, SPRING, springStiffnessOf, BRAKE, PAINT_COLORS, PART_CATEGORIES, PART_INFO, ENGINE, PREVIEW, SIZE, SUSPENSION, TEXT, TIRE, WEIGHT, brakeOf, hingeAngleOf, hingeDegrees, hingeStrengthOf, actionsOf, isKeyed, keyLabel, keysOf, powerOf, rotorSpeedOf, strokeOf, suspensionOf, tireValueOf, weightOf } from '../constants';
import { MoveDirection } from '../build/build-mode';
import { Grid } from '../build/grid';
import { Part, Vec3, axleOf, frontOf, isWheelType, isStructural, partCells, studsOf, subVec } from '../types';
import { captureKey } from './key-capture';
import { createPreviewCanvas, renderPartPreview, startSpin } from './part-preview';

export interface InspectorHandlers {
  onRemove(part: Part): void;
  /** Removes every part of a multiple selection in one undo step. */
  onRemoveMany(parts: ReadonlyArray<Part>): void;
  /** Moves the whole selection one step in a direction seen from the camera. */
  onMove(direction: MoveDirection): void;
  /** Moves the whole selection down until it rests on the ground. */
  onMoveToGround(): void;
  /** Sets the suspension strength (0-100) of a wheel. */
  onSuspension(part: Part, strength: number): void;
  /** Sets the tire (0 speed tires … 100 traction tires, see `TIRE`) of a wheel, or of all the wheels on its body with `wholeBody`. */
  onTire(part: Part, tire: number, wholeBody: boolean): void;
  /** Sets the weight (an integer, see `WEIGHT`) of a block, or of all the blocks welded to it with `connected`. */
  onWeight(part: Part, weight: number, connected: boolean): void;
  /** Sets the speed (an integer, the sign is the direction, see `ROTOR`) of a rotor. */
  onSpeed(part: Part, speed: number): void;
  /** Sets how far a piston goes out (steps of half a cell, see `PISTON`). */
  onStroke(part: Part, stroke: number): void;
  /** Sets the stiffness (1-10) of a spring (see `SPRING`). */
  onStiffness(part: Part, stiffness: number): void;
  /** Sets how far a hinge opens (steps of `HINGE.angleStep` degrees, see `HINGE`). */
  onAngle(part: Part, angle: number): void;
  /** Sets the strength (1-10) of a hinge's servo (see `HINGE`). */
  onStrength(part: Part, strength: number): void;
  /** Sets the power (an integer, see `ENGINE`) of an engine, or of all the engines on its body with `connected`. */
  onPower(part: Part, power: number, connected: boolean): void;
  /** Sets the brake strength (1-10) of a wheel, or of every wheel on its body with `wholeBody`. */
  onBrake(part: Part, strength: number, wholeBody: boolean): void;
  /** Changes the keys of an action of these parts (see `Grid.editKeys`): `edit` gets the keys a part has and returns the new list. One undo step. */
  onKeys(parts: ReadonlyArray<Part>, action: string, edit: (keys: readonly string[]) => readonly string[]): void;
  /** Gives all the keys of a part to other parts of its kind (see `Grid.assignKeys`): one undo step. */
  onCopyKeys(from: Part, to: ReadonlyArray<Part>): void;
  onClose(): void;
}

const AXES = ['X', 'Y', 'Z'];
const coords = (cell: Vec3): string => cell.join(', ');

/**
 * Panel on the right of the screen that shows the part selected in inspect mode: a spinning preview, what it is, where
 * it is and how it is connected (rigid body size, mounted wheels / host block), and a button to remove
 * it. It is refreshed by `show()` whenever the selection or the grid changes. All text is set with `textContent`.
 */
export class PartInspector {
  private root = document.getElementById('part-inspector')!;
  private stopSpin: (() => void) | null = null;
  /** Stops the wait for a key press of the key button, if one is waiting (the panel is rebuilt, or the selection changes). */
  private stopCapture: (() => void) | null = null;

  constructor(
    private grid: Grid,
    private handlers: InspectorHandlers,
  ) {}

  /** Shows the panel for the selection: the details of a single part, a summary of several, or hides it when empty. */
  show(parts: ReadonlyArray<Part>): void {
    this.stopSpin?.();
    this.stopSpin = null;
    this.stopCapture?.();
    this.stopCapture = null;
    this.root.hidden = parts.length === 0;
    if (parts.length === 0) return;
    if (parts.length > 1) return this.showMany(parts);
    const part = parts[0];

    const info = PART_INFO[part.type];
    const header = el('div', 'help-header');
    const title = text('h2', 'dialog-title', TEXT.inspector.title);
    const close = text('button', 'help-close', '×') as HTMLButtonElement;
    close.type = 'button';
    close.title = TEXT.inspector.close;
    close.setAttribute('aria-label', TEXT.inspector.close);
    close.onclick = () => this.handlers.onClose();
    const trash = this.trashButton(TEXT.inspector.remove, () => this.handlers.onRemove(part));
    const actions = el('div', 'header-actions');
    actions.append(trash, close);
    header.append(title, actions);

    const canvas = createPreviewCanvas(SIZE.partInspectorPreview);
    renderPartPreview(part.type, canvas, undefined, { color: part.color });
    this.stopSpin = startSpin(part.type, canvas, PREVIEW.inspectSpinSpeed, false, { color: part.color });

    // Preview beside the name: saves height, so the position / connection rows are visible without scrolling.
    const summary = el('div', 'inspector-summary');
    const identity = el('div', 'inspector-identity');
    identity.append(
      text('h3', 'inspector-name', info.name),
      text('span', 'inspector-chip', PART_CATEGORIES.find((c) => c.id === info.category)?.title ?? info.category),
    );
    summary.append(canvas, identity);

    // The header (title + close button) stays put; only the body below it scrolls.
    const body = el('div', 'inspector-body');
    body.append(
      summary,
      ...this.moveSection(),
      ...this.keySection(part),
      ...this.tireSection(part),
      ...this.brakeSection(part),
      ...this.powerSection(part),
      ...this.speedSection(part),
      ...this.strokeSection(part),
      ...this.stiffnessSection(part),
      ...this.angleSection(part),
      ...this.strengthSection(part),
      ...this.weightSection(part),
      ...this.suspensionSection(part),
      text('h4', 'inspector-heading', TEXT.inspector.thisPart),
      this.rows(this.placedRows(part)),
    );
    this.root.replaceChildren(header, body);
  }

  /** A multiple selection: how many parts of each kind, and one button that removes them all. */
  private showMany(parts: ReadonlyArray<Part>): void {
    const header = el('div', 'help-header');
    const close = text('button', 'help-close', '×') as HTMLButtonElement;
    close.type = 'button';
    close.title = TEXT.inspector.close;
    close.setAttribute('aria-label', TEXT.inspector.close);
    close.onclick = () => this.handlers.onClose();
    const trash = this.trashButton(TEXT.inspector.removeMany(parts.length), () => this.handlers.onRemoveMany(parts));
    const actions = el('div', 'header-actions');
    actions.append(trash, close);
    header.append(text('h2', 'dialog-title', TEXT.inspector.title), actions);

    const counts = new Map<string, number>();
    for (const part of parts) counts.set(part.type, (counts.get(part.type) ?? 0) + 1);
    const body = el('div', 'inspector-body');
    body.append(
      text('h3', 'inspector-name', TEXT.inspector.selectedCount(parts.length)),
      ...this.keySectionMany(parts),
      ...this.moveSection(),
      this.rows([...counts].map(([type, n]) => [PART_INFO[type as keyof typeof PART_INFO].name, String(n)] as [string, string])),
      text('p', 'inspector-status', TEXT.inspector.multiHint),
    );
    this.root.replaceChildren(header, body);
  }

  /** A square trash-can button for the header, next to the close button; `label` is its tooltip. */
  private trashButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = el('button', 'help-close danger') as HTMLButtonElement;
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.append(trashIcon());
    button.onclick = onClick;
    return button;
  }

  /** How to move the selection with the mouse, as a highlighted box of key caps (Shift = up and down must be hard to miss). */
  private mouseMoves(): HTMLElement {
    const box = el('div', 'move-mouse');
    box.append(text('h4', 'inspector-heading', TEXT.inspector.moveMouseHeading));
    for (const row of TEXT.inspector.moveMouse) {
      const line = el('div', 'move-mouse-row');
      const keys = el('span', 'move-mouse-keys');
      row.keys.forEach((key, i) => {
        if (i > 0) keys.append(text('span', 'help-or', '+'));
        keys.append(text('kbd', '', key));
      });
      line.append(keys, text('span', 'move-mouse-text', row.text));
      box.append(line);
    }
    return box;
  }

  /** The position controls of a selection of one part or more: the arrows, the button that puts it on the ground, and how to move it with the mouse. */
  private moveSection(): HTMLElement[] {
    const ground = el('button', 'catalog-action move-ground') as HTMLButtonElement;
    ground.type = 'button';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) icon.setAttribute(name, value);
    icon.innerHTML = MOVE_ICONS.ground; // trusted constant (src/constants/cursor-modes.ts)
    ground.append(icon, text('span', '', TEXT.inspector.moveGround));
    ground.title = TEXT.inspector.moveGroundLabel;
    ground.onclick = () => this.handlers.onMoveToGround();
    return [text('h4', 'inspector-heading', TEXT.inspector.move), this.movePad(), ground, this.mouseMoves()];
  }

  /** The buttons that move the selection: up / forward / down above left / back / right. */
  private movePad(): HTMLElement {
    const pad = el('div', 'move-pad');
    for (const direction of ['up', 'forward', 'down', 'left', 'back', 'right'] as const) {
      const button = el('button', 'catalog-action') as HTMLButtonElement;
      button.type = 'button';
      // An arrow instead of the name; the tooltip and aria-label still say it.
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) icon.setAttribute(name, value);
      icon.innerHTML = MOVE_ICONS[direction]; // trusted constant (src/constants/cursor-modes.ts)
      button.append(icon);
      button.title = TEXT.inspector.moveLabels[direction];
      button.setAttribute('aria-label', TEXT.inspector.moveLabels[direction]);
      button.onclick = () => this.handlers.onMove(direction);
      pad.append(button);
    }
    return pad;
  }

  /** Tire slider (wheels only): from speed tires to traction tires; also only changed here, the catalog lists the property. */
  private tireSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasTire) return [];
    const wheels = this.grid.wheelsOnBody(part.cell).length;
    return this.sliderSection({
      heading: TEXT.inspector.tire,
      min: TIRE.min,
      max: TIRE.max,
      step: TIRE.step,
      value: tireValueOf(part),
      defaultValue: TIRE.default,
      low: TEXT.inspector.tireSpeed,
      high: TEXT.inspector.tireTraction,
      hint: TEXT.inspector.tireHint,
      onCommit: (value) => this.handlers.onTire(part, value, false),
      applyAll: wheels > 1 ? { label: TEXT.inspector.tireApplyAll(wheels), run: () => this.handlers.onTire(part, tireValueOf(part), true) } : undefined,
    });
  }

  /** Brake strength slider of a wheel (every wheel has a brake; its key is the key section's), with "apply to the wheels on this body". */
  private brakeSection(part: Part): HTMLElement[] {
    if (!isWheelType(part.type)) return [];
    const wheels = this.grid.wheelsOnBody(part.cell).length;
    const t = TEXT.inspector;
    return this.sliderSection({
      heading: t.brake,
      min: BRAKE.min,
      max: BRAKE.max,
      step: BRAKE.step,
      value: brakeOf(part),
      defaultValue: BRAKE.default,
      low: t.brakeLow,
      high: t.brakeHigh,
      hint: t.brakeHint,
      onCommit: (value) => this.handlers.onBrake(part, value, false),
      applyAll: wheels > 1 ? { label: t.brakeApplyAll(wheels), run: () => this.handlers.onBrake(part, brakeOf(part), true) } : undefined,
    });
  }

  /**
   * The keys of a keyed part (an engine, a wheel, a rotor, a piston, a thruster or a turbo): one block per action with the keys it has
   * (each key is a chip that removes itself when clicked), an *Add a key* button that waits for the next key press and a trash that
   * clears the action; a shortcut copies all the keys to the other parts of its kind.
   */
  private keySection(part: Part): HTMLElement[] {
    if (!isKeyed(part)) return [];
    const t = TEXT.keys;
    const actions = actionsOf(part);
    const out: HTMLElement[] = [text('h4', 'inspector-heading', actions.length > 1 ? t.headingMany : t.heading)];
    for (const action of actions) {
      const note = [action.mode === 'toggle' ? t.toggle : t.hold, ...(action.required ? [] : [t.optional])].join(', ');
      out.push(
        text('div', 'key-action-label', action.label),
        ...this.keyPicker({
          keys: keysOf(part, action.id),
          required: action.required,
          note,
          onAdd: (code) => this.handlers.onKeys([part], action.id, (keys) => [...keys, code]),
          onRemove: (code) => this.handlers.onKeys([part], action.id, (keys) => keys.filter((k) => k !== code)),
          onClear: () => this.handlers.onKeys([part], action.id, () => []),
        }),
      );
    }
    const same = this.grid.all().filter((p) => p.type === part.type);
    if (part.keys && same.some((p) => JSON.stringify(p.keys ?? null) !== JSON.stringify(part.keys))) {
      const copy = text('button', 'catalog-action primary', t.copyAll(same.length, `${PART_INFO[part.type].name}s`)) as HTMLButtonElement;
      copy.type = 'button';
      copy.onclick = () => this.handlers.onCopyKeys(part, same);
      out.push(copy);
    }
    out.push(text('p', 'inspector-status', t.modesHint));
    return out;
  }

  /** The keys of several parts at once: one block per kind of action in the selection; a key added goes to every part that has the action. */
  private keySectionMany(parts: ReadonlyArray<Part>): HTMLElement[] {
    const groups = new Map<string, { name: string; action: ReturnType<typeof actionsOf>[number]; parts: Part[] }>();
    for (const part of parts) {
      for (const action of actionsOf(part)) {
        const id = `${part.type}:${action.id}`;
        const group = groups.get(id) ?? { name: PART_INFO[part.type].name, action, parts: [] };
        group.parts.push(part);
        groups.set(id, group);
      }
    }
    if (groups.size === 0) return [];
    const t = TEXT.keys;
    const out: HTMLElement[] = [text('h4', 'inspector-heading', t.setMany(new Set([...groups.values()].flatMap((g) => g.parts)).size))];
    for (const { name, action, parts: members } of groups.values()) {
      const lists = members.map((p) => keysOf(p, action.id));
      const same = lists.every((list) => list.join() === lists[0].join());
      out.push(
        text('div', 'key-action-label', t.manyLabel(name, members.length, action.label)),
        ...this.keyPicker({
          keys: same ? lists[0] : [],
          mixed: !same,
          required: action.required,
          onAdd: (code) => this.handlers.onKeys(members, action.id, (keys) => [...keys, code]),
          onRemove: same ? (code) => this.handlers.onKeys(members, action.id, (keys) => keys.filter((k) => k !== code)) : undefined,
          onClear: () => this.handlers.onKeys(members, action.id, () => []),
        }),
      );
    }
    out.push(text('p', 'inspector-status', t.setManyHint));
    return out;
  }

  /**
   * One action's key row: the keys it has as chips (click one to remove it; none shows *No key*, in red when the action is required),
   * a yellow button that waits for the next key press and adds it, and a trash button that clears the action once it has keys. The
   * line under the row says what it is waiting for.
   */
  private keyPicker(o: {
    keys: readonly string[];
    mixed?: boolean;
    required: boolean;
    note?: string;
    onAdd(code: string): void;
    onRemove?(code: string): void;
    onClear(): void;
  }): HTMLElement[] {
    const t = TEXT.keys;
    const hasKeys = o.keys.length > 0 || Boolean(o.mixed);
    const chips = el('div', 'key-chips');
    if (o.mixed) chips.append(text('span', 'key-label', t.mixedKeys));
    else if (o.keys.length === 0) {
      const none = text('span', 'key-label unbound', t.notSet);
      none.classList.toggle('optional', !o.required);
      chips.append(none);
    }
    for (const code of o.keys) {
      const chip = text(o.onRemove ? 'button' : 'span', 'key-chip', keyLabel(code));
      if (o.onRemove && chip instanceof HTMLButtonElement) {
        chip.type = 'button';
        chip.title = t.removeKey(keyLabel(code));
        chip.setAttribute('aria-label', chip.title);
        chip.onclick = () => o.onRemove!(code);
      }
      chips.append(chip);
    }
    if (o.note) chips.append(text('span', 'key-note', o.note));

    const label = o.keys.length > 0 || o.mixed ? t.add : t.assign;
    const assign = text('button', 'catalog-action primary key-assign', label) as HTMLButtonElement;
    assign.type = 'button';
    const message = text('p', 'inspector-status key-message', '');
    message.hidden = true;
    const row = el('div', 'key-row');
    row.append(assign);
    if (hasKeys) {
      const clear = el('button', 'catalog-action danger key-clear') as HTMLButtonElement;
      clear.type = 'button';
      clear.title = t.clear;
      clear.setAttribute('aria-label', t.clear);
      clear.append(trashIcon());
      clear.onclick = o.onClear;
      row.append(clear);
    }
    assign.onclick = () => {
      this.stopCapture?.();
      assign.classList.add('waiting');
      assign.textContent = t.press;
      message.hidden = false;
      message.classList.remove('error');
      message.textContent = t.pressHint;
      this.stopCapture = captureKey(
        (code) => {
          this.stopCapture = null;
          if (code === null) o.onClear();
          else o.onAdd(code);
        },
        (problem) => {
          message.classList.add('error');
          message.textContent = problem;
        },
        () => {
          this.stopCapture = null;
          assign.classList.remove('waiting');
          assign.textContent = label;
          message.hidden = true;
        },
      );
    };
    return [chips, row, message];
  }

  /** Suspension slider (wheels only; it is the only place to change it, the catalog just lists the property). */
  private suspensionSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasSuspension) return [];
    return this.sliderSection({
      heading: TEXT.inspector.suspension,
      min: SUSPENSION.min,
      max: SUSPENSION.max,
      step: SUSPENSION.step,
      value: suspensionOf(part),
      defaultValue: SUSPENSION.defaultStrength,
      low: TEXT.inspector.suspensionSoft,
      high: TEXT.inspector.suspensionFirm,
      hint: TEXT.inspector.suspensionHint,
      onCommit: (value) => this.handlers.onSuspension(part, value),
    });
  }

  /** Power slider (engines) or boost slider (turbos), with a shortcut to give the same value to every part of its kind on this body. */
  private powerSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasPower) return [];
    const turbo = part.type === 'turbo';
    const propeller = part.type === 'propeller';
    const chute = part.type === 'parachute';
    const thruster = part.type === 'thruster' || propeller;
    const engines = this.grid.mountedOfTypeOnBody(part.cell, part.type).length;
    const t = TEXT.inspector;
    return this.sliderSection({
      heading: chute ? t.chute : thruster ? t.thrust : turbo ? t.boost : t.power,
      min: ENGINE.min,
      max: ENGINE.max,
      step: ENGINE.step,
      value: powerOf(part),
      defaultValue: ENGINE.default,
      low: chute ? t.chuteLow : thruster ? t.thrustLow : turbo ? t.boostLow : t.powerLow,
      high: chute ? t.chuteHigh : thruster ? t.thrustHigh : turbo ? t.boostHigh : t.powerHigh,
      hint: chute ? t.chuteHint : propeller ? t.propellerHint : thruster ? t.thrustHint : turbo ? t.boostHint : t.powerHint,
      onCommit: (value) => this.handlers.onPower(part, value, false),
      applyAll: engines > 1 ? { label: chute ? t.chuteApplyAll(engines) : propeller ? t.propellerApplyAll(engines) : thruster ? t.thrustApplyAll(engines) : turbo ? t.boostApplyAll(engines) : t.powerApplyAll(engines), run: () => this.handlers.onPower(part, powerOf(part), true) } : undefined,
    });
  }

  /** Speed slider of a rotor: from counter-clockwise to clockwise, 0 holding the head still. */
  private speedSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasSpeed) return [];
    const t = TEXT.inspector;
    return this.sliderSection({
      heading: t.speed,
      min: -ROTOR.max,
      max: ROTOR.max,
      step: ROTOR.step,
      value: rotorSpeedOf(part),
      defaultValue: ROTOR.default,
      low: t.speedLow,
      high: t.speedHigh,
      hint: t.speedHint,
      onCommit: (value) => this.handlers.onSpeed(part, value),
    });
  }

  /** Stiffness slider of a spring: how little it gives under a load. */
  private stiffnessSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasStiffness) return [];
    const t = TEXT.inspector;
    return this.sliderSection({
      heading: t.stiffness,
      min: SPRING.stiffnessMin,
      max: SPRING.stiffnessMax,
      step: 1,
      value: springStiffnessOf(part),
      defaultValue: SPRING.stiffnessDefault,
      low: t.stiffnessSoft,
      high: t.stiffnessStiff,
      hint: t.stiffnessHint,
      onCommit: (value) => this.handlers.onStiffness(part, value),
    });
  }

  /** Stroke slider of a piston: how far its head goes out, in half cells (a spring's length). */
  private strokeSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasStroke) return [];
    const t = TEXT.inspector;
    const spring = part.type === 'spring';
    return this.sliderSection({
      heading: spring ? t.springLength : t.stroke,
      min: PISTON.min,
      max: PISTON.max,
      step: PISTON.step,
      value: strokeOf(part),
      defaultValue: PISTON.default,
      low: t.strokeLow,
      high: t.strokeHigh,
      hint: spring ? t.springLengthHint : t.strokeHint,
      onCommit: (value) => this.handlers.onStroke(part, value),
    });
  }

  /** Strength slider of a hinge's servo: how stiffly it holds the angle (a weak one sags under a heavy lid). */
  private strengthSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasAngle) return [];
    const t = TEXT.inspector;
    return this.sliderSection({
      heading: t.servoStrength,
      min: HINGE.strengthMin,
      max: HINGE.strengthMax,
      step: 1,
      value: hingeStrengthOf(part),
      defaultValue: HINGE.strengthDefault,
      low: t.servoWeak,
      high: t.servoStrong,
      hint: t.servoHint,
      onCommit: (value) => this.handlers.onStrength(part, value),
    });
  }

  /** Angle slider of a hinge: how far the head swings open, in degrees. */
  private angleSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasAngle) return [];
    const t = TEXT.inspector;
    return this.sliderSection({
      heading: t.angle,
      min: HINGE.min,
      max: HINGE.max,
      step: HINGE.step,
      value: hingeAngleOf(part),
      defaultValue: HINGE.default,
      low: t.angleLow,
      high: t.angleHigh,
      hint: t.angleHint,
      format: (steps) => t.angleValue(steps * HINGE.angleStep),
      onCommit: (value) => this.handlers.onAngle(part, value),
    });
  }

  /** Weight slider (blocks only), with a shortcut to give the same weight to every block welded to this one. */
  private weightSection(part: Part): HTMLElement[] {
    if (!PART_INFO[part.type].hasWeight) return [];
    const connected = this.grid.connectedBlocks(part.cell);
    return this.sliderSection({
      heading: TEXT.inspector.weight,
      min: WEIGHT.min,
      max: WEIGHT.max,
      step: WEIGHT.step,
      value: weightOf(part),
      defaultValue: WEIGHT.default,
      low: TEXT.inspector.weightLight,
      high: TEXT.inspector.weightHeavy,
      hint: TEXT.inspector.weightHint,
      onCommit: (value) => this.handlers.onWeight(part, value, false),
      applyAll: connected > 1 ? { label: TEXT.inspector.weightApplyAll(connected), run: () => this.handlers.onWeight(part, weightOf(part), true) } : undefined,
    });
  }

  /**
   * A heading, a slider with its value, the labels of its ends (with a button that restores the default value in
   * between) and a hint. The value follows the slider while it moves; the change (one undo step) is made on release.
   */
  private sliderSection(o: {
    heading: string;
    min: number;
    max: number;
    step: number;
    value: number;
    defaultValue: number;
    low: string;
    high: string;
    hint: string;
    onCommit(value: number): void;
    /** How the value is written beside the slider (default: the number). */
    format?(value: number): string;
    /** Optional button below the slider that applies the current value to the related parts (see `Grid.setWeight` / `setTire`). */
    applyAll?: { label: string; run(): void };
  }): HTMLElement[] {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'slider-input';
    slider.min = String(o.min);
    slider.max = String(o.max);
    slider.step = String(o.step);
    slider.value = String(o.value);
    slider.setAttribute('aria-label', o.heading);
    const show = (value: number) => (o.format ? o.format(value) : String(value));
    const readout = text('span', 'slider-value', show(o.value));
    // The yellow part of the track (see the sliders in main.css).
    const fill = () => slider.style.setProperty('--fill', String((Number(slider.value) - o.min) / (o.max - o.min)));
    fill();
    slider.oninput = () => {
      readout.textContent = show(Number(slider.value));
      fill();
    };
    slider.onchange = () => o.onCommit(Number(slider.value));

    const reset = text('button', 'slider-reset', TEXT.inspector.defaultValue) as HTMLButtonElement;
    reset.type = 'button';
    reset.hidden = o.value === o.defaultValue;
    reset.onclick = () => o.onCommit(o.defaultValue);

    const row = el('div', 'slider-row');
    row.append(slider, readout);
    const ends = el('div', 'slider-ends');
    ends.append(text('span', '', o.low), reset, text('span', '', o.high));
    const all: HTMLElement[] = [];
    if (o.applyAll) {
      const apply = text('button', 'catalog-action primary', o.applyAll.label) as HTMLButtonElement;
      apply.type = 'button';
      apply.onclick = o.applyAll.run;
      all.push(apply);
    }
    return [text('h4', 'inspector-heading', o.heading), row, ends, ...all, text('p', 'inspector-status', o.hint)];
  }

  /** Label / value rows that depend on where this particular part is. */
  private placedRows(part: Part): Array<[string, string]> {
    const rows: Array<[string, string]> = [[TEXT.inspector.position, coords(part.cell)]];
    if (part.type === 'bigWheel') rows.push([TEXT.inspector.occupies, TEXT.inspector.cells(partCells(part).length)]);
    else if (isStructural(part.type)) rows.push([TEXT.inspector.studs, TEXT.inspector.studsDirection(studsOf(part))]);
    if (isStructural(part.type)) {
      rows.push([TEXT.inspector.color, PAINT_COLORS.find((c) => c.hex.toLowerCase() === part.color)?.name ?? TEXT.inspector.defaultColor]);
      rows.push([TEXT.inspector.weight, String(weightOf(part))]);
      rows.push([TEXT.inspector.rigidBody, TEXT.inspector.blocks(this.grid.connectedBlocks(part.cell))]);
      rows.push([TEXT.inspector.bodyWeight, String(this.grid.connectedWeight(part.cell))]);
    } else if (part.face) {
      const host = this.grid.hostOf(part);
      rows.push([TEXT.inspector.mountedOn, host ? `${PART_INFO[host.type].name} at ${coords(host.cell)}` : '-']);
      if (part.type === 'hinge') {
        rows.push([TEXT.inspector.angle, TEXT.inspector.angleValue(hingeDegrees(part))]);
        rows.push([TEXT.inspector.servoStrength, String(hingeStrengthOf(part))]);
      } else if (part.type === 'piston') {
        rows.push([TEXT.inspector.stroke, TEXT.inspector.strokeValue(strokeOf(part))]);
      } else if (part.type === 'spring') {
        rows.push([TEXT.inspector.springLength, TEXT.inspector.strokeValue(strokeOf(part))]);
        rows.push([TEXT.inspector.stiffness, String(springStiffnessOf(part))]);
      } else if (part.type === 'rotor') {
        rows.push([TEXT.inspector.speed, TEXT.inspector.speedValue(rotorSpeedOf(part))]);
      } else if (part.type === 'engine') {
        rows.push([TEXT.inspector.front, TEXT.inspector.frontValue(frontOf(part))]);
        rows.push([TEXT.inspector.power, String(powerOf(part))]);
        rows.push([TEXT.inspector.bodyPower, TEXT.inspector.engines(this.grid.enginesOnBody(part.cell).length)]);
      } else if (part.type === 'thruster') {
        rows.push([TEXT.inspector.front, TEXT.inspector.frontValue(frontOf(part))]);
        rows.push([TEXT.inspector.thrust, String(powerOf(part))]);
        rows.push([TEXT.inspector.bodyThrusters, String(this.grid.thrustersOnBody(part.cell).length)]);
      } else if (part.type === 'propeller') {
        rows.push([TEXT.inspector.front, TEXT.inspector.frontAnyValue(frontOf(part))]);
        rows.push([TEXT.inspector.thrust, String(powerOf(part))]);
        rows.push([TEXT.inspector.bodyPropellers, String(this.grid.propellersOnBody(part.cell).length)]);
      } else if (part.type === 'parachute') {
        rows.push([TEXT.inspector.front, TEXT.inspector.frontAnyValue(frontOf(part))]);
        rows.push([TEXT.inspector.chute, String(powerOf(part))]);
        rows.push([TEXT.inspector.bodyParachutes, String(this.grid.parachutesOnBody(part.cell).length)]);
      } else if (part.type === 'lamp' || part.type === 'siren') {
        rows.push([TEXT.inspector.front, TEXT.inspector.frontAnyValue(frontOf(part))]);
      } else if (part.type === 'turbo') {
        rows.push([TEXT.inspector.boost, String(powerOf(part))]);
        rows.push([TEXT.inspector.bodyTurbos, String(this.grid.turbosOnBody(part.cell).length)]);
      } else {
        rows.push([TEXT.inspector.tire, String(tireValueOf(part))]);
        rows.push([TEXT.inspector.brake, String(brakeOf(part))]);
        rows.push([TEXT.inspector.suspension, TEXT.inspector.suspensionValue(suspensionOf(part))]);
        rows.push([TEXT.inspector.axle, TEXT.inspector.axis(AXES[axleOf(part).findIndex((v) => v !== 0)])]);
      }
    }
    return rows;
  }

  private rows(rows: Array<[string, string]>): HTMLElement {
    const list = el('dl', 'inspector-props');
    for (const [label, value] of rows) list.append(text('dt', '', label), text('dd', '', value));
    return list;
  }
}

/** The trash can drawn in the buttons that delete (the key button's, the header's). */
function trashIcon(): SVGElement {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) icon.setAttribute(name, value);
  icon.innerHTML = '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>'; // trusted constant
  return icon;
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function text(tag: string, className: string, content: string): HTMLElement {
  const node = el(tag, className);
  node.textContent = content;
  return node;
}
