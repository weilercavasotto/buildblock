import * as THREE from 'three';
import { COLORS, PROPELLER_VISUAL, ROUGHNESS, hexToNumber } from '../constants';

/**
 * The propeller model: a steel motor housing at the back (-z, against the block), a light spinner in front of it and the blades
 * (+z, the way it pushes), in its own frame, centred on the origin. The blades and the spinner are one group named
 * `PROPELLER_BLADES`, which `PhysicsWorld` turns about z while the propeller runs. Tuned through `PROPELLER_VISUAL`; `createPartObject`
 * turns it like any part.
 */
const V = PROPELLER_VISUAL;
export const PROPELLER_BLADES = 'propeller-blades';
const standard = (hex: string) => new THREE.MeshStandardMaterial({ color: hexToNumber(hex), roughness: ROUGHNESS.block });
const spinnerMat = standard(COLORS.part.propellerSpinner);
/** The default (steel) housing, when it is not painted. */
export const propellerHousing = standard(COLORS.part.propeller);
/** The default (wood) blades. */
export const propellerBlade = standard(COLORS.part.propellerBlade);

const total = V.housingLength + V.spinnerLength;
const alongZ = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => geometry.rotateX(Math.PI / 2);
const housing = alongZ(new THREE.CylinderGeometry(V.housingRadius, V.housingRadius, V.housingLength, V.segments)).translate(0, 0, -total / 2 + V.housingLength / 2);
const spinner = alongZ(new THREE.ConeGeometry(V.spinnerRadius, V.spinnerLength, V.segments)).translate(0, 0, total / 2 - V.spinnerLength / 2);
const bladeGeometry = new THREE.BoxGeometry(V.bladeWidth, V.bladeRadius, V.bladeThickness).translate(0, V.bladeRadius / 2, 0);

/** Builds the propeller; `material` is the housing's (the default one, or the paint), which also colours the blades when painted. */
export function createPropellerModel(material: THREE.Material = propellerHousing): THREE.Group {
  const model = new THREE.Group();
  const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  add(model, housing, material);
  const blades = new THREE.Group();
  blades.name = PROPELLER_BLADES;
  blades.position.z = total / 2 - V.spinnerLength;
  add(blades, spinner.clone().translate(0, 0, -(total / 2 - V.spinnerLength)), spinnerMat);
  const bladeMat = material === propellerHousing ? propellerBlade : material;
  for (let i = 0; i < V.bladeCount; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (i * Math.PI * 2) / V.bladeCount;
    const blade = add(pivot, bladeGeometry, bladeMat);
    blade.rotation.y = V.bladeTwist; // pitched, like a real blade
    blades.add(pivot);
  }
  model.add(blades);
  return model;
}
