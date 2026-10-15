import * as THREE from 'three';
import { BRAKE_VISUAL, COLORS, ROUGHNESS, hexToNumber } from '../constants';

/**
 * The brake model, in its own frame with the disc's axis along x (like a wheel's) and the caliper on top: a drilled steel disc
 * (it turns with the wheel) and a caliper clamped on its top edge (it stays with the suspension). Tuned through `BRAKE_VISUAL`;
 * `createPartObject` fits it inside a wheel, scaled with the wheel, and turned like the wheel.
 */
const V = BRAKE_VISUAL;
const standard = (hex: string) => new THREE.MeshStandardMaterial({ color: hexToNumber(hex), roughness: ROUGHNESS.block });
const discMat = standard(COLORS.part.brakeDisc);
const holeMat = standard(COLORS.part.brakeHole);
const caliperMat = standard(COLORS.part.brakeCaliper);

// The disc and its hub lie along x (cylinders are built along y and turned), the holes are short dark cylinders through the disc.
const disc = new THREE.CylinderGeometry(V.discRadius, V.discRadius, V.discThickness, V.segments).rotateZ(Math.PI / 2);
const hub = new THREE.CylinderGeometry(V.hubRadius, V.hubRadius, V.hubLength, V.segments).rotateZ(Math.PI / 2);
const holes = Array.from({ length: V.holes }, (_, i) => {
  const angle = (i / V.holes) * Math.PI * 2;
  return new THREE.CylinderGeometry(V.holeRadius, V.holeRadius, V.discThickness * 1.08, 12)
    .rotateZ(Math.PI / 2)
    .translate(0, Math.cos(angle) * V.holeCircle, Math.sin(angle) * V.holeCircle);
});
const caliper = new THREE.BoxGeometry(V.caliperThickness, V.caliperHeight, V.caliperLength).translate(0, V.discRadius - V.caliperHeight / 2 + 0.01, 0);

function build(parts: Array<[THREE.BufferGeometry, THREE.Material]>): THREE.Group {
  const group = new THREE.Group();
  for (const [geometry, material] of parts) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

/** The drilled disc with its hub (it turns with the wheel). */
export const createBrakeDisc = (): THREE.Group =>
  build([[disc, discMat], [hub, discMat], ...holes.map((hole): [THREE.BufferGeometry, THREE.Material] => [hole, holeMat])]);

/** The caliper on the disc's top edge (it does not turn with the wheel). */
export const createBrakeCaliper = (): THREE.Group => build([[caliper, caliperMat]]);

/** The whole brake, centred on the disc: what the catalog and the placement preview show. */
export function createBrakeModel(): THREE.Group {
  const model = new THREE.Group();
  model.add(createBrakeDisc(), createBrakeCaliper());
  return model;
}
