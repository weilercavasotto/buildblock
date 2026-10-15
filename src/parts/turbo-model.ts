import * as THREE from 'three';
import { COLORS, ROUGHNESS, TURBO_VISUAL, hexToNumber } from '../constants';

/**
 * The turbo model: a nitrous bottle lying along z (rounded ends, a white band round its middle, a brass valve on the front)
 * with a short dark nozzle out of the back (-z), in its own frame, centred on the origin. The flame of a firing turbo leaves
 * the nozzle (see `PlayEffects`). Tuned through `TURBO_VISUAL`; `createPartObject` turns it like any part.
 */
const V = TURBO_VISUAL;
const standard = (hex: string, roughness: number = ROUGHNESS.block) => new THREE.MeshStandardMaterial({ color: hexToNumber(hex), roughness });
const bandMat = standard(COLORS.part.turboBand);
const valveMat = standard(COLORS.part.turboValve);
const nozzleMat = standard(COLORS.part.turboNozzle);
/** The default (blue) bottle, when it is not painted. */
export const turboBottle = standard(COLORS.part.turbo);

const half = V.bottleLength / 2;
// Cylinders are built along y: turn them to lie along z.
const alongZ = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => geometry.rotateX(Math.PI / 2);
const bottle = alongZ(new THREE.CylinderGeometry(V.bottleRadius, V.bottleRadius, V.bottleLength, V.segments));
const dome = (side: 1 | -1): THREE.BufferGeometry =>
  new THREE.SphereGeometry(V.bottleRadius, V.segments, 12).scale(1, 1, V.domeLength / V.bottleRadius).translate(0, 0, side * half);
const band = alongZ(new THREE.CylinderGeometry(V.bottleRadius + V.bandOverhang, V.bottleRadius + V.bandOverhang, V.bandLength, V.segments));
const valve = alongZ(new THREE.CylinderGeometry(V.valveRadius, V.valveRadius, V.valveLength, 16)).translate(0, 0, half + V.domeLength + V.valveLength / 2 - 0.02);
const nozzle = alongZ(new THREE.CylinderGeometry(V.nozzleRadius, V.nozzleRadius * 1.25, V.nozzleLength, 16)).translate(0, 0, -(half + V.domeLength + V.nozzleLength / 2 - 0.02));

/** Where the flame leaves the turbo, in its own frame: the end of the nozzle. */
export const turboNozzleTip: [number, number, number] = [0, 0, -(half + V.domeLength + V.nozzleLength - 0.02)];

/** Builds the turbo; `bottleMaterial` is the material of the bottle (the default one, or the paint). */
export function createTurboModel(bottleMaterial: THREE.Material = turboBottle): THREE.Group {
  const model = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    model.add(mesh);
  };
  add(bottle, bottleMaterial);
  add(dome(1), bottleMaterial);
  add(dome(-1), bottleMaterial);
  add(band, bandMat);
  add(valve, valveMat);
  add(nozzle, nozzleMat);
  return model;
}
