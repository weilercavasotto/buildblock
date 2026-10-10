import * as THREE from 'three';
import { Part, Vec3 } from '../types';

export const WHEEL_RADIUS = 0.65;
export const WHEEL_WIDTH = 0.4;

const blockGeo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.98, 0.98, 0.98));
const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 28);
const spokeGeo = new THREE.BoxGeometry(WHEEL_RADIUS * 1.5, WHEEL_WIDTH + 0.04, 0.14);

const blockMat = new THREE.MeshStandardMaterial({ color: 0xd9453b, roughness: 0.55 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.9 });
const spokeMat = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.4 });
const edgeMat = new THREE.LineBasicMaterial({ color: 0x5a1a16 });
const ghostOk = new THREE.MeshBasicMaterial({ color: 0x4cd964, transparent: true, opacity: 0.5, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.5, depthWrite: false });

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
