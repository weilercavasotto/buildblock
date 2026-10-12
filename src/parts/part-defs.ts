import * as THREE from 'three';
import { ALPHA, BLOCK_VISUAL_SIZE, BLOCK_EDGE_SCALE, COLORS, GHOST_BLOCK_SCALE, HIGHLIGHT, METALNESS, ROUGHNESS, WHEEL, hexToNumber } from '../constants';
import { Part, Vec3, partRotation, wheelAxle, yawOfTurns } from '../types';
import { wheelGeometry } from './wheel-model';

const color = (hex: string): number => hexToNumber(hex);
const ghostMaterial = (hex: string) =>
  new THREE.MeshBasicMaterial({ color: color(hex), transparent: true, opacity: ALPHA.ghost, depthWrite: false });

const blockGeo = new THREE.BoxGeometry(BLOCK_VISUAL_SIZE, BLOCK_VISUAL_SIZE, BLOCK_VISUAL_SIZE);
const edgeGeo = new THREE.EdgesGeometry(blockGeo);
// The faces are pushed back a little in depth (and the outline is drawn slightly larger than the cube, see
// BLOCK_EDGE_SCALE) so the dark outline of each block is not eaten by the faces.
const blockMat = new THREE.MeshStandardMaterial({
  color: color(COLORS.part.block),
  roughness: ROUGHNESS.block,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
const tireMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.tire), roughness: ROUGHNESS.tire });
const rimMat = new THREE.MeshStandardMaterial({
  color: color(COLORS.part.rim),
  roughness: ROUGHNESS.rim,
  metalness: METALNESS.rim,
});
const rimRecessMat = new THREE.MeshStandardMaterial({
  color: color(COLORS.part.rimRecess),
  roughness: ROUGHNESS.rim,
  metalness: METALNESS.rim,
});
const edgeMat = new THREE.LineBasicMaterial({ color: color(COLORS.part.blockEdge) });
const ghostOk = ghostMaterial(COLORS.part.ghostValid);
const ghostBad = ghostMaterial(COLORS.part.ghostInvalid);

/** Axis-aligned box around a placed part (slightly larger than the part), used for selection / hover outlines. */
export function partBounds(part: Pick<Part, 'type' | 'cell' | 'face'>): THREE.Box3 {
  const half = new THREE.Vector3();
  if (part.type === 'block') {
    half.setScalar(BLOCK_VISUAL_SIZE / 2);
  } else {
    half.setScalar(WHEEL.radius);
    const axle = wheelAxle(part).findIndex((v) => v !== 0);
    half.setComponent(axle, WHEEL.width / 2);
  }
  half.addScalar(HIGHLIGHT.margin);
  const centre = new THREE.Vector3(...part.cell);
  return new THREE.Box3(centre.clone().sub(half), centre.clone().add(half));
}

/** Rotation that maps the cylinder's Y axis onto the wheel axle. */
export function faceQuaternion(face: Vec3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...face));
}

/** Builds the visual for a part, centred on its own origin (cell centre). */
export function createPartObject(part: Pick<Part, 'type' | 'face' | 'rotation'>, ghost?: 'ok' | 'bad'): THREE.Group {
  const root = new THREE.Group();
  const ghostMat = ghost === 'ok' ? ghostOk : ghost === 'bad' ? ghostBad : undefined;
  const noRaycast = { raycast: () => {} };

  if (part.type === 'block') {
    const mesh = new THREE.Mesh(blockGeo, ghostMat ?? blockMat);
    mesh.castShadow = mesh.receiveShadow = !ghost;
    if (ghost) mesh.scale.setScalar(GHOST_BLOCK_SCALE);
    root.add(mesh);
    if (!ghost) {
      const edges = new THREE.LineSegments(edgeGeo, edgeMat);
      Object.assign(edges, noRaycast);
      edges.scale.setScalar(BLOCK_EDGE_SCALE);
      root.add(edges);
    }
    // Everything but wheels turns around the vertical axis; a wheel's rotation chooses its axle (see below).
    root.rotation.y = yawOfTurns(partRotation(part));
  } else {
    const pivot = new THREE.Group();
    pivot.quaternion.copy(faceQuaternion(wheelAxle(part)));
    if (ghostMat) {
      pivot.add(new THREE.Mesh(wheelGeometry.silhouette, ghostMat));
    } else {
      // Tire (rubber), rim (metal) and the darker recessed disc of the rim; see wheel-model.ts.
      const tire = new THREE.Mesh(wheelGeometry.tire, tireMat);
      tire.castShadow = true;
      const rim = new THREE.Mesh(wheelGeometry.rim, rimMat);
      rim.castShadow = true;
      pivot.add(tire, rim, new THREE.Mesh(wheelGeometry.rimDisc, rimRecessMat));
    }
    root.add(pivot);
  }
  return root;
}
