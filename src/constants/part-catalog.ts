import { ENGINE_BODY, PLATE, THRUSTER_BODY, TURBO_BODY } from './game';
import { CHASSIS, ENGINE, THRUSTER, TURBO, WHEEL, WHEEL_SIZES } from './physics';
import { PartType, StructuralType } from '../types';

/** Data behind the hotbar and the parts catalog. To add a part: extend `PartType`, then add its entry here. */

export type PartCategory = 'structure' | 'mobility';

export const PART_CATEGORIES: ReadonlyArray<{ id: PartCategory; title: string }> = [
  { id: 'structure', title: 'Structure' },
  { id: 'mobility', title: 'Mobility' },
];

export interface PartInfo {
  type: PartType;
  name: string;
  category: PartCategory;
  /** Can the player rotate it before placing it (A / D)? */
  rotatable: boolean;
  /** Can it be painted? Painting is done in the part inspector (inspect mode), never in the catalog. */
  paintable: boolean;
  /** Does it have an adjustable suspension (set in the part inspector)? */
  hasSuspension: boolean;
  /** Can it have a tire type chosen in the part inspector? */
  hasTire: boolean;
  /** Does it have an adjustable weight (set in the part inspector)? */
  hasWeight: boolean;
  /** Can a brake be fitted to it (the wheels)? The brake strength is then set in the part inspector. */
  hasBrake: boolean;
  /** Does it have an adjustable power (an engine; set in the part inspector)? */
  hasPower: boolean;
  /** Resting angle (rad) of the 3D preview around the vertical axis, chosen to show the part nicely. */
  previewAngle: number;
  /** One line shown under the name. */
  tagline: string;
  description: string;
  /** Label / value rows of the inspector. */
  properties: ReadonlyArray<{ label: string; value: string }>;
  tips: ReadonlyArray<string>;
}

/** What the catalog says about each structural part; the rest of its entry is the same for all of them. */
interface StructuralText {
  name: string;
  tagline: string;
  description: string;
  /** "Size" row (cells). */
  size: string;
  /** "Studs" row. */
  studs: string;
  tips: ReadonlyArray<string>;
  extraProperties?: ReadonlyArray<{ label: string; value: string }>;
}

function structural(type: StructuralType, t: StructuralText): PartInfo {
  return {
    type,
    name: t.name,
    category: 'structure',
    rotatable: true,
    paintable: true,
    hasSuspension: false,
    hasTire: false,
    hasWeight: true,
    hasBrake: false,
    hasPower: false,
    previewAngle: 0.6,
    tagline: t.tagline,
    description: t.description,
    properties: [
      { label: 'Size', value: t.size },
      { label: 'Studs', value: t.studs },
      ...(t.extraProperties ?? []),
      { label: 'Placement', value: 'On the ground, or on / under another block, plate or bracket with at least 1 stud engaged; half-cell steps in x and z' },
      { label: 'Physics', value: 'Parts joined by studs merge into one rigid body; parts side by side are not welded' },
      { label: 'Rotation', value: 'Any face up: A / D turn, W / S tilt (90° steps), in every direction; the studs go with it' },
      { label: 'Paint', value: 'Yes, in paint mode (E)' },
      { label: 'Weight', value: 'Adjustable in the inspector (1-16, default 4); a thin part weighs less at the same setting' },
    ],
    tips: t.tips,
  };
}

const STRUCTURE_TIP = 'Move the pointer over the part below to choose how much of it rests there (all the studs, half, or just one).';

export const PART_INFO: Record<PartType, PartInfo> = {
  block: {
    ...structural('block', {
      name: 'Block',
      tagline: 'The basic building cube.',
      description:
        'A solid 1×1×1 cube with 4 studs on top, like a toy brick. A block is welded to the blocks, plates and brackets it is stacked with (at least one stud engaged), so they make the frame of a vehicle or any structure. It can rest on half of another block (2 studs) or on a corner (1 stud). Wheels are mounted on its sides.',
      size: '1 × 1 × 1 cell',
      studs: '4 on top (2 × 2, half a cell apart)',
      tips: [STRUCTURE_TIP, 'Blocks side by side are not welded: tie them together with a plate or a layer of blocks on top.', 'Hold the left button and drag to place a row or a layer of blocks.'],
      extraProperties: [{ label: 'Friction', value: String(CHASSIS.friction) }],
    }),
  },
  blockHalf: structural('blockHalf', {
    name: 'Half block',
    tagline: 'A block cut in half.',
    description: 'Half a block: a 0.5 × 1 footprint and a full block tall, with 2 studs on top. Use it to fill narrow gaps and to build in half-cell steps. Wheels cannot be mounted on it.',
    size: '0.5 × 1 × 1 cell',
    studs: '2 on top (in a row)',
    tips: [STRUCTURE_TIP, 'A / D turn it so the narrow side faces the other way.'],
  }),
  blockLarge: structural('blockLarge', {
    name: 'Large block',
    tagline: 'Four blocks in one.',
    description: 'A solid 2×1×2 block with 16 studs on top: the same as four blocks side by side, but welded in one piece. Good for the base of a heavy vehicle. Wheels cannot be mounted on it.',
    size: '2 × 1 × 2 cells',
    studs: '16 on top (4 × 4)',
    tips: [STRUCTURE_TIP, 'It is one part: a single click places the whole thing.'],
  }),
  plate: structural('plate', {
    name: 'Plate',
    tagline: 'A thin square panel with studs.',
    description:
      'A flat square plate, a fifth of a block thick, with 4 studs on top like a block. Use it for floors, roofs and body panels, and to tie blocks together: a plate resting on two blocks side by side welds them into one body. Place it on the ground or on top of (or under) another part; it must engage at least one stud.',
    size: `1 x 1 x ${PLATE.thickness} cell`,
    studs: '4 on its top face (2 × 2)',
    tips: [STRUCTURE_TIP, 'Two plates, offset by half a cell, make a strong deck for blocks side by side.', 'Stood on its edge (W / S) it is a wall.'],
  }),
  plateHalf: structural('plateHalf', {
    name: 'Half plate',
    tagline: 'A narrow plate, half as wide.',
    description: 'A plate half as wide as the normal one: 0.5 × 1 with 2 studs. Use it for trim, rails and to tie parts together in a small space.',
    size: `0.5 x 1 x ${PLATE.thickness} cell`,
    studs: '2 on its top face',
    tips: [STRUCTURE_TIP, 'A / D turn it a quarter turn.'],
  }),
  plateLarge: structural('plateLarge', {
    name: 'Large plate',
    tagline: 'Four plates in one.',
    description: 'A flat plate 2 × 2 cells with 16 studs: the same as four plates side by side, in one piece. Use it for wide decks that tie a whole layer of blocks together.',
    size: `2 x 2 x ${PLATE.thickness} cells`,
    studs: '16 on its top face (4 × 4)',
    tips: [STRUCTURE_TIP, 'A single large plate across a row of blocks welds the whole row.'],
  }),
  plateLargeHalf: structural('plateLargeHalf', {
    name: 'Large half plate',
    tagline: 'A long, narrow plate.',
    description: 'A large plate half as wide: 1 × 2 cells with 8 studs. A long strip for chassis rails and side panels.',
    size: `1 x 2 x ${PLATE.thickness} cells`,
    studs: '8 on its top face (2 × 4)',
    tips: [STRUCTURE_TIP, 'A / D turn it a quarter turn.'],
  }),
  bracket: structural('bracket', {
    name: 'L bracket',
    tagline: 'Two plates at a right angle.',
    description:
      'A flat plate with a wall plate standing on its back edge, like a Lego angle: 4 studs on top of the flat plate and 4 on the outside of the wall, 8 in all. It joins a floor to a wall in one piece. The wall is as tall as a block.',
    size: `1 x 1 x ${PLATE.thickness} flat plate + 1 x 1 x ${PLATE.thickness} wall`,
    studs: '4 on the flat plate (top) + 4 on the outside of the wall',
    tips: [STRUCTURE_TIP, 'Parts engage the studs of the wall by lying with their own studs pointing the same way (tilt them with W / S).', 'A / D turn the wall to the side you need.'],
  }),
  bracketSmall: structural('bracketSmall', {
    name: 'Small L bracket',
    tagline: 'A narrow L bracket.',
    description: 'The L bracket half as wide: a 0.5 wide flat plate (2 studs) with a wall (2 studs), 4 in all. For corners and braces where the full bracket does not fit.',
    size: `0.5 x 1 x ${PLATE.thickness} flat plate + 0.5 x 1 x ${PLATE.thickness} wall`,
    studs: '2 on the flat plate (top) + 2 on the outside of the wall',
    tips: [STRUCTURE_TIP, 'A / D turn the wall to the side you need.'],
  }),
  engine: {
    type: 'engine',
    name: 'Engine',
    category: 'mobility',
    rotatable: true,
    paintable: true,
    hasSuspension: false,
    hasTire: false,
    hasWeight: false,
    hasBrake: false,
    hasPower: true,
    previewAngle: 0.6,
    tagline: 'Drives the wheels of its body.',
    description:
      'The engine of a vehicle, a separate unit you mount on a face of a block (like a wheel). Wheels only get acceleration when an engine is mounted on their body. The engine pushes the vehicle towards its front, the side with the fan: turn it around and W / S are reversed. A body\'s engines add their power, and it is shared among the wheels of that body: one engine of the default power drives up to 4 wheels at full torque. Wheels on a body with no engine roll freely.',
    properties: [
      { label: 'Size', value: `${ENGINE_BODY.width} × ${ENGINE_BODY.width} × ${ENGINE_BODY.depth} cells, against the block` },
      { label: 'Placement', value: 'On any face of a block (top, bottom or sides); it does not take the place of a block' },
      { label: 'Front', value: 'The side with the fan: W drives the vehicle towards it. A / D turn it around, W / S tilt it up or down, in every direction; it cannot point into its block nor be upside down' },
      { label: 'Power', value: 'Adjustable in the inspector (1-10, default 5)' },
      { label: 'Mass', value: `${ENGINE.mass} blocks of the default weight` },
      { label: 'Paint', value: 'Yes, in paint mode (E)' },
    ],
    tips: [
      'Mount it on the same body as the wheels (the block it is on must be welded to the blocks the wheels are on).',
      'Point the fan where the vehicle should go. An engine facing sideways does nothing, and one facing backwards reverses the throttle.',
      'More wheels than the engine can drive get less torque each: add a second engine to a heavy or many-wheeled vehicle.',
    ],
  },
  thruster: {
    type: 'thruster',
    name: 'Thruster',
    category: 'mobility',
    rotatable: true,
    paintable: true,
    hasSuspension: false,
    hasTire: false,
    hasWeight: false,
    hasBrake: false,
    hasPower: true,
    previewAngle: 0.6,
    tagline: 'Pushes its body, no wheels needed.',
    description:
      'A small jet that you mount on a face of a block, like the engine. Hold Space while playing and it pushes the body it is mounted on towards its front, from where it sits, with an orange flame out of the bell at the back, on the ground or in the air, with or without an engine. A thruster far from the centre of the body also turns it. The thrusts of a body\'s thrusters add up.',
    properties: [
      { label: 'Size', value: `${THRUSTER_BODY.width} × ${THRUSTER_BODY.width} × ${THRUSTER_BODY.depth} cells, against the block` },
      { label: 'Placement', value: 'On any face of a block (top, bottom or sides); it does not take the place of a block' },
      { label: 'Front', value: 'The jet\'s front (the bell and the flame are at the back): Space pushes the body towards it. A / D turn it, W / S tilt it, in every direction' },
      { label: 'Thrust', value: 'Adjustable in the inspector (1-10, default 5)' },
      { label: 'Control', value: 'Hold Space while playing' },
      { label: 'Mass', value: `${THRUSTER.mass} block of the default weight` },
      { label: 'Paint', value: 'Yes, in paint mode (E): the tube takes the colour' },
    ],
    tips: [
      'Point the bell backwards: the thruster pushes the body towards the other end.',
      'Mount one on the top of a body pointing down to hop, or two at the back to dash forward.',
      'A thruster at the edge of the body spins it: put pairs on both sides to push straight.',
    ],
  },
  turbo: {
    type: 'turbo',
    name: 'Turbo',
    category: 'mobility',
    rotatable: true,
    paintable: true,
    hasSuspension: false,
    hasTire: false,
    hasWeight: false,
    hasBrake: false,
    hasPower: true,
    previewAngle: 0.6,
    tagline: 'A nitro boost for the driven wheels.',
    description:
      'A nitrous bottle that you mount on a face of a block, like the engine. Hold Shift while playing and the wheels that an engine drives, on the same body, turn faster and push harder, with a blue flame out of the nozzle. It only boosts: without an engine on the body it does nothing. The boosts of a body\'s turbos add up.',
    properties: [
      { label: 'Size', value: `${TURBO_BODY.width} × ${TURBO_BODY.width} × ${TURBO_BODY.depth} cells, against the block` },
      { label: 'Placement', value: 'On any face of a block (top, bottom or sides); it does not take the place of a block' },
      { label: 'Rotation', value: 'A / D turn, W / S tilt (90° steps), in every direction; the nozzle (the flame) goes with it' },
      { label: 'Boost', value: 'Adjustable in the inspector (1-10, default 5)' },
      { label: 'Control', value: 'Hold Shift while playing' },
      { label: 'Mass', value: `${TURBO.mass} block of the default weight` },
      { label: 'Paint', value: 'Yes, in paint mode (E): the bottle takes the colour' },
    ],
    tips: [
      'Mount it on the same body as the engine and the wheels it should boost.',
      'Point the nozzle backwards (the flame leaves the back of the bottle) so it looks right.',
      'Two turbos add their boost: up to three times the push of one default turbo.',
    ],
  },
  brake: {
    type: 'brake',
    name: 'Brake',
    category: 'mobility',
    // It is fitted to a wheel and takes the wheel's turn, so there is nothing to rotate.
    rotatable: false,
    paintable: false,
    hasSuspension: false,
    hasTire: false,
    hasWeight: false,
    hasBrake: false,
    hasPower: false,
    previewAngle: 0.6,
    tagline: 'Fits to a wheel to stop it.',
    description:
      'A drilled steel disc with a caliper that you fit to a wheel: pick the brake and click a wheel, and the disc appears behind its rim. Hold Space while playing and every wheel with a brake is held back, whether it is driven or not; a wheel without one rolls on. Each wheel has its own brake, with a strength you set in the part inspector.',
    properties: [
      { label: 'Fits to', value: 'A wheel (small or large), one brake per wheel' },
      { label: 'Strength', value: 'Adjustable in the inspector (1-10, default 5)' },
      { label: 'Control', value: 'Hold Space while playing' },
      { label: 'Remove', value: 'The Remove brake button in the wheel\'s inspector (the wheel stays)' },
    ],
    tips: [
      'Brake only the wheels you want: the back ones make the car slide in a turn, the front ones stop it hardest.',
      'Select the wheel in inspect mode (I) to change the strength of its brake or take the brake off.',
      'Brake hard while turning: the wheels lock, the car slides and throws up earth.',
    ],
  },
  wheel: {
    type: 'wheel',
    name: 'Wheel',
    category: 'mobility',
    // The axle points along X; turn it so the wheel face is seen at a three-quarter angle.
    rotatable: true,
    paintable: false,
    hasSuspension: true,
    hasTire: true,
    hasWeight: false,
    hasBrake: true,
    hasPower: false,
    previewAngle: -0.45,
    tagline: 'Makes your creation roll.',
    description:
      'A motorised wheel mounted on a side face of a block. Its axle starts along X; turn it (A / D, W / S) in any direction before placing, e.g. a quarter turn to make it lie along the face instead. In Play it is driven with W/S, and A/D steer by slowing down one side.',
    properties: [
      { label: 'Radius', value: `${WHEEL.radius} cells` },
      { label: 'Width', value: `${WHEEL.width} cells` },
      { label: 'Placement', value: 'Side faces of a block only' },
      { label: 'Rotation', value: 'A / D turn, W / S tilt (90° steps), in every direction; the axle goes with it' },
      { label: 'Paint', value: 'No: wheels keep their tire and rim' },
      { label: 'Suspension', value: 'Adjustable in the inspector (0-100, default 50)' },
      { label: 'Tire', value: 'Adjustable in the inspector, from speed to traction (0-100, default 50)' },
      { label: 'Collides with', value: 'The ground (not with blocks or other wheels)' },
    ],
    tips: [
      'Four wheels and a body of blocks make a car.',
      'The axle starts along X: on a side face along X it is a normal wheel, and a quarter turn (A / D) makes a wheel that lies along the face, like a caster.',
      'Wheels are larger than a cell, which lifts the body off the ground.',
    ],
  },
  bigWheel: {
    type: 'bigWheel',
    name: 'Large wheel',
    category: 'mobility',
    // The axle points along X; turn it so the wheel face is seen at a three-quarter angle.
    rotatable: true,
    paintable: false,
    hasSuspension: true,
    hasTire: true,
    hasWeight: false,
    hasBrake: true,
    hasPower: false,
    previewAngle: -0.45,
    tagline: 'A wheel twice the size, for big machines.',
    description:
      'A wheel twice the size of the normal one: it covers 2 x 2 cells beside a block. Mount it on a side face; it fills 2 x 2 cells starting at the cell you point at, extending toward where it is turned (A / D, W / S). It turns more slowly but covers more ground and clears bigger bumps.',
    properties: [
      { label: 'Radius', value: `${WHEEL.radius * WHEEL_SIZES.bigWheel.scale} cells` },
      { label: 'Width', value: `${WHEEL.width * WHEEL_SIZES.bigWheel.scale} cells` },
      { label: 'Occupies', value: '2 x 2 cells beside the block' },
      { label: 'Placement', value: 'Side faces of a block only' },
      { label: 'Rotation', value: 'A / D turn, W / S tilt (90° steps), in every direction; its axle and the way it extends go with it' },
      { label: 'Paint', value: 'No: wheels keep their tire and rim' },
      { label: 'Suspension', value: 'Adjustable in the inspector (0-100, default 50)' },
      { label: 'Tire', value: 'Adjustable in the inspector, from speed to traction (0-100, default 50)' },
      { label: 'Collides with', value: 'The ground (not with blocks or other wheels)' },
    ],
    tips: [
      'The free cells it needs (a 2 x 2 square starting at the cell you point at) must be empty.',
      'Mount two of them at the same height on opposite sides for a monster truck.',
    ],
  },
};

/** Parts in catalog order. */
export const PART_ORDER: ReadonlyArray<PartType> = [
  'blockHalf',
  'block',
  'blockLarge',
  'plateHalf',
  'plate',
  'plateLargeHalf',
  'plateLarge',
  'bracketSmall',
  'bracket',
  'engine',
  'thruster',
  'turbo',
  'brake',
  'wheel',
  'bigWheel',
];
