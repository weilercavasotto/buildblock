import * as THREE from 'three';
import { COLORS, ROUGHNESS, SKI_BODY, hexToNumber } from '../constants';

/**
 * The ski model, in its own frame (studs up, the runner along z with its tip curled up at the front, +z, and `SKI_BODY.width` across x),
 * centred on the middle of the cell. An arm goes from the runner along x to the face of the block; which side that is (`armSign`: +1 for
 * +x) depends on how the ski is turned against the face, so `createPartObject` passes it. Tuned through `SKI_BODY`.
 */
const V = SKI_BODY;
/** The name of the runner in the model: `PhysicsWorld` turns it about the vertical axis to show the steering. */
export const SKI_RUNNER = 'ski-runner';
const standard = (hex: string) => new THREE.MeshStandardMaterial({ color: hexToNumber(hex), roughness: ROUGHNESS.block });
const runnerMat = standard(COLORS.part.ski);
const armMat = standard(COLORS.part.skiArm);

/** The side profile of the runner as (z, y) points, counter-clockwise: flat underside, the sloping tip, the top. Also the collider's hull. */
export function skiProfile(): Array<[number, number]> {
  const front = V.length / 2;
  const bottom = -V.bottom;
  const top = bottom + V.thickness;
  return [
    [-front, bottom],
    [front - V.tipLength, bottom],
    [front, bottom + V.tipRise],
    [front, bottom + V.tipRise + V.thickness],
    [front - V.tipLength, top],
    [-front, top],
  ];
}

const runner = (() => {
  const shape = new THREE.Shape(skiProfile().map(([z, y]) => new THREE.Vector2(z, y)));
  // Extruded along the shape's z, then turned so the shape's x is the ski's z and the extrusion is across x.
  return new THREE.ExtrudeGeometry(shape, { depth: V.width, bevelEnabled: false }).translate(0, 0, -V.width / 2).rotateY(-Math.PI / 2);
})();
const armLength = 0.5;
const arm = new THREE.BoxGeometry(armLength, V.armHeight, V.armWidth).translate(armLength / 2, -V.bottom + V.thickness + V.armHeight / 2, 0);

/** Builds the ski; the arm leans towards `armSign` (+1: +x, -1: -x). */
export function createSkiModel(armSign: 1 | -1 = -1): THREE.Group {
  const model = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    model.add(mesh);
    return mesh;
  };
  add(runner, runnerMat).name = SKI_RUNNER;
  add(arm, armMat).scale.x = armSign;
  return model;
}
