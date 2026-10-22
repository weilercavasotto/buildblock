import * as THREE from 'three';
import { BRAKE_VISUAL, COLORS, ROUGHNESS, hexToNumber } from '../constants';

/**
 * The brake model, in its own frame with the disc's axis along x (like a wheel's): a drilled steel disc that turns with the
 * wheel (there is no caliper). Tuned through `BRAKE_VISUAL`;
 * `createPartObject` fits it inside a wheel, scaled with the wheel, and turned like the wheel.
 */
const V = BRAKE_VISUAL;
const standard = (hex: string) => new THREE.MeshStandardMaterial({ color: hexToNumber(hex), roughness: ROUGHNESS.block });
const discMat = standard(COLORS.part.brakeDisc);
const holeMat = standard(COLORS.part.brakeHole);

// The disc and its hub lie along x (cylinders are built along y and turned), the holes are short dark cylinders through the disc.
const disc = new THREE.CylinderGeometry(V.discRadius, V.discRadius, V.discThickness, V.segments).rotateZ(Math.PI / 2);
const hub = new THREE.CylinderGeometry(V.hubRadius, V.hubRadius, V.hubLength, V.segments).rotateZ(Math.PI / 2);
const holes = Array.from({ length: V.holes }, (_, i) => {
  const angle = (i / V.holes) * Math.PI * 2;
  return new THREE.CylinderGeometry(V.holeRadius, V.holeRadius, V.discThickness * 1.08, 12)
    .rotateZ(Math.PI / 2)
    .translate(0, Math.cos(angle) * V.holeCircle, Math.sin(angle) * V.holeCircle);
});

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

