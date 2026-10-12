import * as THREE from 'three';
import { ALPHA, PAINT_EDGE_FACTOR, PLATE, STUD, BLOCK_VISUAL_SIZE, BLOCK_EDGE_SCALE, COLORS, GHOST_BLOCK_SCALE, HIGHLIGHT, METALNESS, ROUGHNESS, WHEEL, hexToNumber, wheelSizeOf } from '../constants';
import { Part, Vec3, isHexColor, partCentre, studsOf, wheelAxle } from '../types';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { wheelGeometry } from './wheel-model';

const color = (hex: string): number => hexToNumber(hex);
const ghostMaterial = (hex: string) =>
  new THREE.MeshBasicMaterial({ color: color(hex), transparent: true, opacity: ALPHA.ghost, depthWrite: false });

const blockGeo = new THREE.BoxGeometry(BLOCK_VISUAL_SIZE, BLOCK_VISUAL_SIZE, BLOCK_VISUAL_SIZE);
const edgeGeo = new THREE.EdgesGeometry(blockGeo);
// The connectors: 2 x 2 round studs on the top face, `STUD.pitch` apart, merged into one mesh (one draw call per part). They
// are built for the top of a unit block; `studsMesh` moves them to the top of a plate.
const studsGeo = mergeGeometries(
  [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) =>
      new THREE.CylinderGeometry(STUD.radius, STUD.radius, STUD.height, STUD.segments)
        .translate((sx * STUD.pitch) / 2, STUD.height / 2, (sz * STUD.pitch) / 2)
        .toNonIndexed(),
    ),
  ),
)!;
// The faces are pushed back a little in depth (and the outline is drawn slightly larger than the cube, see
// BLOCK_EDGE_SCALE) so the dark outline of each block is not eaten by the faces.
const blockMat = new THREE.MeshStandardMaterial({
  color: color(COLORS.part.block),
  roughness: ROUGHNESS.block,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});
/** Materials of painted blocks, one pair per colour (shared by every block with that colour). */
const paintCache = new Map<string, { face: THREE.MeshStandardMaterial; edge: THREE.LineBasicMaterial }>();
function blockMaterials(paint?: string) {
  if (!isHexColor(paint)) return { face: blockMat, edge: edgeMat };
  const key = paint.toLowerCase();
  let pair = paintCache.get(key);
  if (!pair) {
    pair = {
      face: blockMat.clone(),
      edge: new THREE.LineBasicMaterial({ color: new THREE.Color(color(key)).multiplyScalar(PAINT_EDGE_FACTOR) }),
    };
    pair.face.color.setHex(color(key));
    paintCache.set(key, pair);
  }
  return pair;
}
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
export function partBounds(part: Pick<Part, 'type' | 'cell' | 'face' | 'rotation' | 'studs' | 'pitch'>): THREE.Box3 {
  const half = new THREE.Vector3();
  if (part.type === 'block') {
    half.setScalar(BLOCK_VISUAL_SIZE / 2);
  } else if (part.type === 'plate') {
    half.setScalar(BLOCK_VISUAL_SIZE / 2);
    half.setComponent(studsOf(part).findIndex((v) => v !== 0), PLATE.thickness / 2);
  } else {
    const { scale } = wheelSizeOf(part.type);
    half.setScalar(WHEEL.radius * scale);
    const axle = wheelAxle(part).findIndex((v) => v !== 0);
    half.setComponent(axle, (WHEEL.width * scale) / 2);
  }
  half.addScalar(HIGHLIGHT.margin);
  const centre = new THREE.Vector3(...partCentre(part));
  return new THREE.Box3(centre.clone().sub(half), centre.clone().add(half));
}

/** Rotation that maps the cylinder's Y axis onto the wheel axle. */
export function faceQuaternion(face: Vec3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...face));
}

/** The studs of a block or plate whose top face is `top` above its centre: one mesh, no picking (they sit on the top face). */
function studsMesh(material: THREE.Material, top: number): THREE.Mesh {
  const mesh = new THREE.Mesh(studsGeo, material);
  mesh.position.y = top;
  mesh.castShadow = true;
  mesh.raycast = () => {};
  return mesh;
}

/** Builds the visual for a part, centred on its own origin (cell centre). */
export function createPartObject(part: Pick<Part, 'type' | 'face' | 'rotation' | 'color' | 'studs' | 'pitch'>, ghost?: 'ok' | 'bad'): THREE.Group {
  const root = new THREE.Group();
  const ghostMat = ghost === 'ok' ? ghostOk : ghost === 'bad' ? ghostBad : undefined;
  const noRaycast = { raycast: () => {} };

  if (part.type === 'block') {
    const mats = blockMaterials(part.color);
    const mesh = new THREE.Mesh(blockGeo, ghostMat ?? mats.face);
    mesh.castShadow = mesh.receiveShadow = !ghost;
    if (ghost) mesh.scale.setScalar(GHOST_BLOCK_SCALE);
    root.add(mesh);
    if (!ghost) {
      const edges = new THREE.LineSegments(edgeGeo, mats.edge);
      Object.assign(edges, noRaycast);
      edges.scale.setScalar(BLOCK_EDGE_SCALE);
      root.add(edges);
      root.add(studsMesh(mats.face, BLOCK_VISUAL_SIZE / 2));
    }
    // The studs point where `studs` says (up by default); a block is symmetric around them, so this is its whole orientation.
    root.quaternion.copy(faceQuaternion(studsOf(part)));
  } else if (part.type === 'plate') {
    // A thin square slab, centred on the part (its studs are on top, like a block's).
    const mats = blockMaterials(part.color);
    const mesh = new THREE.Mesh(blockGeo, ghostMat ?? mats.face);
    mesh.castShadow = mesh.receiveShadow = !ghost;
    mesh.scale.set(1, PLATE.thickness, 1);
    if (ghost) mesh.scale.multiplyScalar(GHOST_BLOCK_SCALE);
    root.add(mesh);
    if (!ghost) {
      const edges = new THREE.LineSegments(edgeGeo, mats.edge);
      Object.assign(edges, noRaycast);
      edges.scale.set(1, PLATE.thickness, 1).multiplyScalar(BLOCK_EDGE_SCALE);
      root.add(edges);
      root.add(studsMesh(mats.face, PLATE.thickness / 2));
    }
    root.quaternion.copy(faceQuaternion(studsOf(part))); // flat when the studs point up, a wall when they point sideways
  } else {
    const pivot = new THREE.Group();
    pivot.quaternion.copy(faceQuaternion(wheelAxle(part)));
    pivot.scale.setScalar(wheelSizeOf(part.type).scale); // a large wheel is the same model, scaled
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
