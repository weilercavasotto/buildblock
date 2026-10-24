import * as THREE from 'three';
import { COLORS, ROUGHNESS, SIREN, SIREN_BODY, SIREN_VISUAL, hexToNumber } from '../constants';

/**
 * The siren model: a round base against the block (-z) and, on it, a dome of two halves, red and blue, facing +z, in its own frame, centred
 * on the origin. Each half has a material of its own per siren, so `PhysicsWorld` can make them flash in turn (`setSirenLevel`); the halo
 * round each half is added the first time the siren is lit, so it never counts in the size of the part (see `createLampModel`). Tuned
 * through `SIREN_VISUAL`.
 */
const V = SIREN_VISUAL;
export const SIREN_RED = 'siren-red';
export const SIREN_BLUE = 'siren-blue';
const standard = (hex: string) => new THREE.MeshStandardMaterial({ color: hexToNumber(hex), roughness: ROUGHNESS.block });
/** The default (dark) base, when it is not painted. */
export const sirenBase = standard(COLORS.part.sirenBase);
const front = SIREN_BODY.depth / 2;
const alongZ = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => geometry.rotateX(Math.PI / 2);
const base = alongZ(new THREE.CylinderGeometry(V.baseRadius * 0.85, V.baseRadius, V.baseHeight, V.segments)).translate(0, 0, -front + V.baseHeight / 2);
/** Half a dome (`half` 0 or 1), its axis along +z, its flat side on the base. */
const half = (radius: number, which: 0 | 1): THREE.BufferGeometry =>
  alongZ(new THREE.SphereGeometry(radius, V.segments, V.segments / 2, which * Math.PI, Math.PI, 0, Math.PI / 2)).translate(0, 0, -front + V.baseHeight);
const domes = [half(V.domeRadius, 0), half(V.domeRadius, 1)];
const halos = [half(V.domeRadius * V.haloScale, 0), half(V.domeRadius * V.haloScale, 1)];
const colours = [COLORS.part.sirenRed, COLORS.part.sirenBlue];
const names = [SIREN_RED, SIREN_BLUE];

/** Builds the siren; `material` is the base's (the default one, or the paint). */
export function createSirenModel(material: THREE.Material = sirenBase): THREE.Group {
  const model = new THREE.Group();
  const baseMesh = new THREE.Mesh(base, material);
  baseMesh.castShadow = baseMesh.receiveShadow = true;
  model.add(baseMesh);
  domes.forEach((geometry, i) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: hexToNumber(colours[i]), roughness: ROUGHNESS.glass, emissive: hexToNumber(colours[i]), emissiveIntensity: 0 }));
    mesh.name = names[i];
    model.add(mesh);
  });
  return model;
}

/** Sets how a siren built by `createSirenModel` flashes: `level` 0 (off) to 1 (on), `phase` -1..1, red when it is positive and blue when it is negative. */
export function setSirenLevel(model: THREE.Object3D, level: number, phase: number): void {
  const amounts = [level * Math.min(1, Math.max(0, phase * 3)), level * Math.min(1, Math.max(0, -phase * 3))];
  names.forEach((name, i) => {
    const dome = model.getObjectByName(name) as THREE.Mesh | undefined;
    if (!dome) return;
    (dome.material as THREE.MeshStandardMaterial).emissiveIntensity = SIREN.glow * amounts[i];
    const haloName = `${name}-halo`;
    let halo = model.getObjectByName(haloName) as THREE.Mesh | undefined;
    if (!halo && amounts[i] > 0.01) {
      halo = new THREE.Mesh(halos[i], new THREE.MeshBasicMaterial({ color: hexToNumber(colours[i]), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      halo.name = haloName;
      halo.raycast = () => {};
      model.add(halo);
    }
    if (halo) {
      halo.visible = amounts[i] > 0.01;
      (halo.material as THREE.MeshBasicMaterial).opacity = SIREN.haloOpacity * amounts[i];
    }
  });
}
