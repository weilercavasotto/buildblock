import * as THREE from 'three';
import { ALPHA, BLOCK_VISUAL_SIZE, COLORS, ROUGHNESS, WHEEL, WHEEL_VISUAL, hexToNumber } from '../constants';
import { Part, Vec3 } from '../types';

const color = (hex: string): number => hexToNumber(hex);
const ghostMaterial = (hex: string) =>
  new THREE.MeshBasicMaterial({ color: color(hex), transparent: true, opacity: ALPHA.ghost, depthWrite: false });

const blockGeo = new THREE.BoxGeometry(BLOCK_VISUAL_SIZE, BLOCK_VISUAL_SIZE, BLOCK_VISUAL_SIZE);
const edgeGeo = new THREE.EdgesGeometry(blockGeo);
const tireGeo = new THREE.CylinderGeometry(WHEEL.radius, WHEEL.radius, WHEEL.width, WHEEL_VISUAL.tireSegments);
const spokeGeo = new THREE.BoxGeometry(
  WHEEL.radius * WHEEL_VISUAL.spokeLength,
  WHEEL.width + WHEEL_VISUAL.spokeOverhang,
  WHEEL_VISUAL.spokeThickness,
);

const blockMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.block), roughness: ROUGHNESS.block });
const tireMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.tire), roughness: ROUGHNESS.tire });
const spokeMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.spoke), roughness: ROUGHNESS.spoke });
const edgeMat = new THREE.LineBasicMaterial({ color: color(COLORS.part.blockEdge) });
const ghostOk = ghostMaterial(COLORS.part.ghostValid);
const ghostBad = ghostMaterial(COLORS.part.ghostInvalid);

/** Rotation that maps the cylinder's Y axis onto the wheel axle (`face`). */
export function faceQuaternion(face: Vec3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...face));
}

/** Builds the visual for a part, centred on its own origin (cell centre). */
export function createPartObject(part: Pick<Part, 'type' | 'face'>, ghost?: 'ok' | 'bad'): THREE.Group {
  const root = new THREE.Group();
  const ghostMat = ghost === 'ok' ? ghostOk : ghost === 'bad' ? ghostBad : undefined;
  const noRaycast = { raycast: () => {} };

  if (part.type === 'block') {
    const mesh = new THREE.Mesh(blockGeo, ghostMat ?? blockMat);
    mesh.castShadow = mesh.receiveShadow = !ghost;
    root.add(mesh);
    if (!ghost) {
      const edges = new THREE.LineSegments(edgeGeo, edgeMat);
      Object.assign(edges, noRaycast);
      root.add(edges);
    }
  } else {
    const pivot = new THREE.Group();
    pivot.quaternion.copy(faceQuaternion(part.face ?? [1, 0, 0]));
    const tire = new THREE.Mesh(tireGeo, ghostMat ?? tireMat);
    tire.castShadow = !ghost;
    pivot.add(tire);
    if (!ghost) pivot.add(new THREE.Mesh(spokeGeo, spokeMat));
    root.add(pivot);
  }
  return root;
}
