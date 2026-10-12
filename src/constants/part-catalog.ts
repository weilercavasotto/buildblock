import { CHASSIS, WHEEL, WHEEL_SIZES } from './physics';
import { PartType } from '../types';

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
  /** Resting angle (rad) of the 3D preview around the vertical axis, chosen to show the part nicely. */
  previewAngle: number;
  /** One line shown under the name. */
  tagline: string;
  description: string;
  /** Label / value rows of the inspector. */
  properties: ReadonlyArray<{ label: string; value: string }>;
  tips: ReadonlyArray<string>;
}

export const PART_INFO: Record<PartType, PartInfo> = {
  block: {
    type: 'block',
    name: 'Block',
    category: 'structure',
    rotatable: true,
    paintable: true,
    hasSuspension: false,
    hasTire: false,
    hasWeight: true,
    previewAngle: 0.6,
    tagline: 'The basic building cube.',
    description:
      'A solid 1×1×1 cube. Blocks that touch each other are welded into a single rigid body, so they are what you use to make the frame of a vehicle or any structure.',
    properties: [
      { label: 'Size', value: '1 × 1 × 1 cell' },
      { label: 'Placement', value: 'On the ground or against any face of another block' },
      { label: 'Physics', value: 'Touching blocks merge into one rigid body' },
      { label: 'Rotation', value: 'Free, in 90° steps (A / D)' },
      { label: 'Paint', value: 'Yes, in paint mode (E)' },
      { label: 'Friction', value: String(CHASSIS.friction) },
      { label: 'Weight', value: 'Adjustable in the inspector (1-16, default 4)' },
    ],
    tips: ['Hold the left button and drag to paint a row, a layer or a wall of blocks.'],
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
    previewAngle: -0.45,
    tagline: 'Makes your creation roll.',
    description:
      'A motorised wheel mounted on a side face of a block. Its axle is perpendicular to the face you mount it on; rotate it (A / D) a quarter turn before placing to make it lie along the face instead. In Play it is driven with W/S, and A/D steer by slowing down one side.',
    properties: [
      { label: 'Radius', value: `${WHEEL.radius} cells` },
      { label: 'Width', value: `${WHEEL.width} cells` },
      { label: 'Placement', value: 'Side faces of a block only' },
      { label: 'Rotation', value: 'A / D turn the axle a quarter turn from the face normal' },
      { label: 'Paint', value: 'No: wheels keep their tire and rim' },
      { label: 'Suspension', value: 'Adjustable in the inspector (0-100, default 50)' },
      { label: 'Tire', value: 'Adjustable in the inspector, from speed to traction (0-100, default 50)' },
      { label: 'Collides with', value: 'The ground (not with blocks or other wheels)' },
    ],
    tips: [
      'Four wheels and a body of blocks make a car.',
      'By default the axle is perpendicular to the face (a normal wheel). A quarter turn (A / D) makes a wheel that lies along the face, like a caster.',
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
    previewAngle: -0.45,
    tagline: 'A wheel twice the size, for big machines.',
    description:
      'A wheel twice the size of the normal one: it covers 2 x 2 cells beside a block. Mount it on a side face; it fills the cell you point at, the one above it and the two beside them (A / D choose which side it extends toward). It turns more slowly but covers more ground and clears bigger bumps.',
    properties: [
      { label: 'Radius', value: `${WHEEL.radius * WHEEL_SIZES.bigWheel.scale} cells` },
      { label: 'Width', value: `${WHEEL.width * WHEEL_SIZES.bigWheel.scale} cells` },
      { label: 'Occupies', value: '2 x 2 cells beside the block' },
      { label: 'Placement', value: 'Side faces of a block only' },
      { label: 'Rotation', value: 'A / D choose the side it extends toward' },
      { label: 'Paint', value: 'No: wheels keep their tire and rim' },
      { label: 'Suspension', value: 'Adjustable in the inspector (0-100, default 50)' },
      { label: 'Tire', value: 'Adjustable in the inspector, from speed to traction (0-100, default 50)' },
      { label: 'Collides with', value: 'The ground (not with blocks or other wheels)' },
    ],
    tips: [
      'The free cells it needs (the one above and the two beside) must be empty.',
      'Mount two of them at the same height on opposite sides for a monster truck.',
    ],
  },
};

/** Parts in catalog order. */
export const PART_ORDER: ReadonlyArray<PartType> = ['block', 'wheel', 'bigWheel'];
