import * as THREE from 'three';
import { COLORS, LAMP, LAMP_BODY, LAMP_VISUAL, ROUGHNESS, hexToNumber } from '../constants';

/**
 * The lamp model: a round housing at the back (-z, against the block) with the lens in front (+z, the way the light shines), in its own
 * frame, centred on the origin. The lens (`LAMP_LENS`) has a material of its own per lamp, so `PhysicsWorld` can make it glow; the beam
 * (`LAMP_BEAM`, a translucent cone in front of the lens) is added by `setLampLevel` the first time the lamp is lit in Play, so the beam never counts in the size of the part. Tuned through `LAMP_VISUAL`.
 */
const V = LAMP_VISUAL;
export const LAMP_LENS = 'lamp-lens';
export const LAMP_BEAM = 'lamp-beam';
const standard = (hex: string) => new THREE.MeshStandardMaterial({ color: hexToNumber(hex), roughness: ROUGHNESS.block });
/** The default (steel) housing, when it is not painted. */
export const lampHousing = standard(COLORS.part.lamp);
const rimMat = standard(COLORS.part.lampRim);
const beamMat = new THREE.MeshBasicMaterial({ color: hexToNumber(COLORS.part.lampBeam), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

const alongZ = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => geometry.rotateX(Math.PI / 2);
const front = LAMP_BODY.depth / 2;
const housing = alongZ(new THREE.CylinderGeometry(V.housingRadius * 0.8, V.housingRadius, V.housingLength, V.segments)).translate(0, 0, -front + V.housingLength / 2);
const rim = alongZ(new THREE.CylinderGeometry(V.rimRadius, V.rimRadius, V.rimLength, V.segments)).translate(0, 0, front - V.lensLength - V.rimLength / 2);
const lens = alongZ(new THREE.CylinderGeometry(V.lensRadius, V.lensRadius, V.lensLength, V.segments)).translate(0, 0, front - V.lensLength / 2);
/** The beam: a cone whose tip is at the lens and whose open end is `beamLength` in front of it. */
const beam = alongZ(new THREE.ConeGeometry(V.beamRadius, V.beamLength, V.segments, 1, true)).rotateX(Math.PI).translate(0, 0, front + V.beamLength / 2);

/** Builds the lamp; `material` is the housing's (the default one, or the paint). */
export function createLampModel(material: THREE.Material = lampHousing): THREE.Group {
  const model = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    model.add(mesh);
    return mesh;
  };
  add(housing, material);
  add(rim, rimMat);
  const glass = add(lens, new THREE.MeshStandardMaterial({ color: hexToNumber(COLORS.part.lampLens), roughness: ROUGHNESS.glass, emissive: hexToNumber(COLORS.part.lampGlow), emissiveIntensity: 0 }));
  glass.name = LAMP_LENS;
  glass.castShadow = false;
  return model;
}

/** Sets how lit a lamp built by `createLampModel` is, 0 (off) to 1 (on): the lens glows and the beam fades in. */
export function setLampLevel(model: THREE.Object3D, level: number): void {
  const glass = model.getObjectByName(LAMP_LENS) as THREE.Mesh | undefined;
  if (glass) (glass.material as THREE.MeshStandardMaterial).emissiveIntensity = LAMP.glow * level;
  let cone = model.getObjectByName(LAMP_BEAM) as THREE.Mesh | undefined;
  if (!cone && level > 0.01) {
    // Made the first time the lamp lights, not with the model: a beam in it would count in the bounds the previews frame the part by.
    cone = new THREE.Mesh(beam, beamMat.clone());
    cone.name = LAMP_BEAM;
    cone.raycast = () => {};
    model.add(cone);
  }
  if (cone) {
    cone.visible = level > 0.01;
    (cone.material as THREE.MeshBasicMaterial).opacity = LAMP.beamOpacity * level;
  }
}
