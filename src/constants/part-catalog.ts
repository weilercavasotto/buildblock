import { CHASSIS, WHEEL } from './physics';
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
    previewAngle: 0.6,
    tagline: 'The basic building cube.',
    description:
      'A solid 1×1×1 cube. Blocks that touch each other are welded into a single rigid body, so they are what you use to make the frame of a vehicle or any structure.',
    properties: [
      { label: 'Size', value: '1 × 1 × 1 cell' },
      { label: 'Placement', value: 'On the ground or against any face of another block' },
      { label: 'Physics', value: 'Touching blocks merge into one rigid body' },
      { label: 'Friction', value: String(CHASSIS.friction) },
      { label: 'Density', value: String(CHASSIS.density) },
    ],
    tips: ['Hold the left button and drag to paint a row, a layer or a wall of blocks.'],
  },
  wheel: {
    type: 'wheel',
    name: 'Wheel',
    category: 'mobility',
    // The axle points along X; turn it so the wheel face is seen at a three-quarter angle.
    previewAngle: -0.45,
    tagline: 'Makes your creation roll.',
    description:
      'A motorised wheel mounted on the side of a block. It spins on the axle of the face you click and is driven with W/S, while A/D steer by slowing down one side.',
    properties: [
      { label: 'Radius', value: `${WHEEL.radius} cells` },
      { label: 'Width', value: `${WHEEL.width} cells` },
      { label: 'Placement', value: 'Side faces of a block only' },
      { label: 'Grip', value: String(WHEEL.friction) },
      { label: 'Collides with', value: 'The ground (not with blocks or other wheels)' },
    ],
    tips: [
      'Four wheels and a body of blocks make a car.',
      'Wheels are larger than a cell, which lifts the body off the ground.',
    ],
  },
};

/** Parts in catalog order. */
export const PART_ORDER: ReadonlyArray<PartType> = ['block', 'wheel'];
