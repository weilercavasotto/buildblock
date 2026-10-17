import * as THREE from 'three';
import { COLORS, ROUGHNESS, THRUSTER_VISUAL, hexToNumber } from '../constants';

/**
 * The thruster model: a jet along z (the way it pushes, +z): a steel tube with an intake ring on the front and a flared dark bell
 * nozzle at the back (-z), with a glowing orange ring round its mouth, in its own frame, centred on the origin. The flame of a
 * firing thruster leaves the bell (see `PlayEffects`). Tuned through `THRUSTER_VISUAL`; `createPartObject` turns it like any part.
 */
const V = THRUSTER_VISUAL;
const standard = (hex: string, roughness: number = ROUGHNESS.block) => new THREE.MeshStandardMaterial({ color: hexToNumber(hex), roughness });
const bellMat = standard(COLORS.part.thrusterBell);
const glowMat = new THREE.MeshStandardMaterial({ color: hexToNumber(COLORS.part.thrusterGlow), emissive: hexToNumber(COLORS.part.thrusterGlow), emissiveIntensity: 0.6, roughness: ROUGHNESS.block });
/** The default (steel) tube, when it is not painted. */
export const thrusterTube = standard(COLORS.part.thruster);

// The tube is centred a little forward so the whole jet (intake, tube, bell) is centred on the origin.
const total = V.intakeLength + V.tubeLength + V.bellLength;
const frontZ = total / 2; // the front end
const alongZ = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => geometry.rotateX(Math.PI / 2);
const intake = alongZ(new THREE.CylinderGeometry(V.intakeRadius, V.intakeRadius, V.intakeLength, V.segments)).translate(0, 0, frontZ - V.intakeLength / 2);
const tube = alongZ(new THREE.CylinderGeometry(V.tubeRadius, V.tubeRadius, V.tubeLength, V.segments)).translate(0, 0, frontZ - V.intakeLength - V.tubeLength / 2);
// A bell: a cone frustum whose narrow end (the throat) joins the tube and whose wide end (the mouth) is the very back (-z; a
// cylinder's top, the first radius, ends up at +z once it is turned to lie along z).
const bell = alongZ(new THREE.CylinderGeometry(V.tubeRadius, V.bellMouthRadius, V.bellLength, V.segments, 1, true)).translate(0, 0, frontZ - V.intakeLength - V.tubeLength - V.bellLength / 2);
const ring = new THREE.TorusGeometry(V.ringRadius, V.ringTube, 10, V.segments * 2).translate(0, 0, -frontZ);

/** Where the flame leaves the thruster, in its own frame: the middle of the bell's mouth. */
export const thrusterTip: [number, number, number] = [0, 0, -frontZ];

/** Builds the thruster; `tubeMaterial` is the material of the tube (the default one, or the paint). */
export function createThrusterModel(tubeMaterial: THREE.Material = thrusterTube): THREE.Group {
  const model = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, side?: THREE.Side) => {
    const m = side === undefined ? material : (material.clone() as THREE.Material);
    if (side !== undefined) m.side = side;
    const mesh = new THREE.Mesh(geometry, m);
    mesh.castShadow = mesh.receiveShadow = true;
    model.add(mesh);
  };
  add(intake, tubeMaterial);
  add(tube, tubeMaterial);
  add(bell, bellMat, THREE.DoubleSide);
  add(ring, glowMat);
  return model;
}
