import * as THREE from 'three';
import { ALPHA, BRAKE_VISUAL, PAINT_EDGE_FACTOR, SHAPES, STUD, BLOCK_VISUAL_SIZE, BLOCK_EDGE_SCALE, COLORS, GHOST_BLOCK_SCALE, HIGHLIGHT, METALNESS, ROUGHNESS, WHEEL, brakeOf, hexToNumber, wheelSizeOf } from '../constants';
import { Part, Vec3, axleOf, isHexColor, isStructural, isWheelType, orientationOfPart, partCentre } from '../types';
import { Orientation, matrixOf } from './orientation';
import { createBrakeCaliper, createBrakeDisc, createBrakeModel } from './brake-model';
import { createEngineModel, engineMetal } from './engine-model';
import { partBox } from './part-geometry';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { wheelGeometry } from './wheel-model';

const color = (hex: string): number => hexToNumber(hex);

const blockGeo = new THREE.BoxGeometry(BLOCK_VISUAL_SIZE, BLOCK_VISUAL_SIZE, BLOCK_VISUAL_SIZE);
const edgeGeo = new THREE.EdgesGeometry(blockGeo);
// The connectors: round studs on a face, `STUD.pitch` apart, merged into one mesh per box (one draw call). They are built for
// the top of a box (a grid of `across` x `along` studs around its centre, pointing up) and cached by that size.
const studsCache = new Map<string, THREE.BufferGeometry>();
function studsGeometry(across: number, along: number): THREE.BufferGeometry {
  const key = `${across}x${along}`;
  let geometry = studsCache.get(key);
  if (!geometry) {
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < across; i++) {
      for (let j = 0; j < along; j++) {
        pieces.push(
          new THREE.CylinderGeometry(STUD.radius, STUD.radius, STUD.height, STUD.segments)
            .translate((i - (across - 1) / 2) * STUD.pitch, STUD.height / 2, (j - (along - 1) / 2) * STUD.pitch)
            .toNonIndexed(),
        );
      }
    }
    geometry = mergeGeometries(pieces)!;
    studsCache.set(key, geometry);
  }
  return geometry;
}
// The sockets: one dark disc per stud position, facing up (`socketsMesh` turns them to the underside), cached by grid size.
const socketsCache = new Map<string, THREE.BufferGeometry>();
function socketsGeometry(across: number, along: number): THREE.BufferGeometry {
  const key = `${across}x${along}`;
  let geometry = socketsCache.get(key);
  if (!geometry) {
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < across; i++) {
      for (let j = 0; j < along; j++) {
        pieces.push(
          new THREE.CircleGeometry(STUD.socketRadius, STUD.segments)
            .rotateX(-Math.PI / 2)
            .translate((i - (across - 1) / 2) * STUD.pitch, 0, (j - (along - 1) / 2) * STUD.pitch)
            .toNonIndexed(),
        );
      }
    }
    geometry = mergeGeometries(pieces)!;
    socketsCache.set(key, geometry);
  }
  return geometry;
}
const socketMat = new THREE.MeshBasicMaterial({ color: hexToNumber(COLORS.part.socket) });
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
function blockMaterials(paint?: string, type?: string) {
  if (!isHexColor(paint)) return type === 'engine' ? { face: engineMetal, edge: edgeMat } : { face: blockMat, edge: edgeMat };
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
const edgeMat = new THREE.LineBasicMaterial({ color: color(COLORS.part.blockEdge) });

/** Translucent copies of the part materials used by the placement ghost, one per material and state (shared). */
const ghostCache = new Map<THREE.Material, { ok: THREE.Material; bad: THREE.Material }>();
function ghostMaterials(material: THREE.Material) {
  let pair = ghostCache.get(material);
  if (!pair) {
    const make = (red: boolean) => {
      const copy = material.clone() as THREE.Material & { color: THREE.Color; polygonOffset: boolean };
      if (red) copy.color.setHex(color(COLORS.part.ghostInvalid));
      copy.transparent = true;
      copy.opacity = ALPHA.ghost;
      return copy;
    };
    pair = { ok: make(false), bad: make(true) };
    ghostCache.set(material, pair);
  }
  return pair;
}

/** Turns a built part into its placement ghost: the same part, translucent, red when it cannot be placed. */
function makeGhost(root: THREE.Object3D, bad: boolean): void {
  root.traverse((object) => {
    const item = object as THREE.Mesh;
    if (!item.isMesh && !(object as THREE.LineSegments).isLineSegments) return;
    item.material = ghostMaterials(item.material as THREE.Material)[bad ? 'bad' : 'ok'];
    item.castShadow = item.receiveShadow = false;
  });
}

/** Axis-aligned box around a placed part (slightly larger than the part), used for selection / hover outlines. */
export function partBounds(part: Pick<Part, 'type' | 'cell' | 'face' | 'studs' | 'spin'>): THREE.Box3 {
  const margin = new THREE.Vector3().setScalar(HIGHLIGHT.margin);
  if (isStructural(part.type) || part.type === 'engine') {
    const box = partBox(part);
    return new THREE.Box3(new THREE.Vector3(...box.min).sub(margin), new THREE.Vector3(...box.max).add(margin));
  }
  const { scale } = wheelSizeOf(part.type);
  const half = new THREE.Vector3().setScalar(WHEEL.radius * scale);
  const axle = axleOf(part).findIndex((v) => v !== 0);
  half.setComponent(axle, (WHEEL.width * scale) / 2);
  half.add(margin);
  const centre = new THREE.Vector3(...partCentre(part));
  return new THREE.Box3(centre.clone().sub(half), centre.clone().add(half));
}

/** Rotation that maps the cylinder's Y axis onto the wheel axle. */
export function faceQuaternion(face: Vec3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...face));
}

/** The turn of a part: its local frame to the world (see `Part.studs`). Any integer spin works. */
export function orientationQuaternion(o: Orientation): THREE.Quaternion {
  const [x, y, z] = matrixOf(o);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z)));
}

/** How many studs fit along each in-plane axis of the `studs` face of a box of the given size, and the turn that points a stud grid along it. */
function studLayout(size: Vec3, studs: Vec3) {
  const facing = faceQuaternion(studs);
  const axis = studs.findIndex((v) => v !== 0);
  // `faceQuaternion` takes the geometry's x and z axes onto the face's in-plane axes; count the studs along each.
  const count = (v: THREE.Vector3) => Math.round(Math.abs(v.x * size[0] + v.y * size[1] + v.z * size[2]) / STUD.pitch);
  const across = count(new THREE.Vector3(1, 0, 0).applyQuaternion(facing));
  const along = count(new THREE.Vector3(0, 0, 1).applyQuaternion(facing));
  return { facing, across, along, reach: (size[axis] * BLOCK_VISUAL_SIZE) / 2 };
}

/** The studs on the `studs` face of a box of the given size: one mesh, no picking. `studs` is a local axis vector. */
function studsMesh(material: THREE.Material, size: Vec3, studs: Vec3): THREE.Mesh {
  const { facing, across, along, reach } = studLayout(size, studs);
  const mesh = new THREE.Mesh(studsGeometry(across, along), material);
  mesh.quaternion.copy(facing);
  mesh.position.set(...studs).multiplyScalar(reach);
  mesh.castShadow = true;
  mesh.raycast = () => {};
  return mesh;
}

/** The dark sockets on the underside of a box (the face opposite its studs), where the studs of another part go in. */
function socketsMesh(size: Vec3, studs: Vec3): THREE.Mesh {
  const under = studs.map((v) => (v === 0 ? 0 : -v)) as Vec3;
  const { facing, across, along, reach } = studLayout(size, under);
  const mesh = new THREE.Mesh(socketsGeometry(across, along), socketMat);
  mesh.quaternion.copy(facing);
  mesh.position.set(...under).multiplyScalar(reach + STUD.socketLift);
  mesh.raycast = () => {};
  return mesh;
}

/**
 * Where a wheel's brake sits: centred on the wheel, scaled with it, turned like it (the disc's axis along the wheel's axle) and
 * moved a little toward the block the wheel is mounted on, so the disc is behind the rim.
 */
export function brakePose(wheel: Pick<Part, 'type' | 'studs' | 'spin' | 'face'>): { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: number } {
  const scale = wheelSizeOf(wheel.type).scale;
  const axle = axleOf(wheel);
  const inward = wheel.face ? -Math.sign(axle[0] * wheel.face[0] + axle[1] * wheel.face[1] + axle[2] * wheel.face[2]) : 0;
  return {
    position: new THREE.Vector3(...axle).multiplyScalar(inward * BRAKE_VISUAL.inset * scale),
    quaternion: orientationQuaternion(orientationOfPart(wheel)),
    scale,
  };
}

function brakeFitting(wheel: Pick<Part, 'type' | 'studs' | 'spin' | 'face'>): THREE.Group {
  const fitting = new THREE.Group();
  const pose = brakePose(wheel);
  fitting.scale.setScalar(pose.scale);
  fitting.quaternion.copy(pose.quaternion);
  fitting.position.copy(pose.position);
  return fitting;
}

/** The caliper of a braked wheel as a separate object (in Play it follows the suspension, not the spinning wheel). */
export function createCaliperObject(wheel: Pick<Part, 'type' | 'studs' | 'spin' | 'face'>): THREE.Group {
  const fitting = brakeFitting(wheel);
  fitting.add(createBrakeCaliper());
  const holder = new THREE.Group();
  holder.add(fitting);
  return holder;
}

/** Builds the visual for a part, centred on its own origin (cell centre). */
export function createPartObject(
  part: Pick<Part, 'type' | 'color' | 'studs' | 'spin' | 'face' | 'brake'>,
  ghost?: 'ok' | 'bad',
  /** `caliper: false` leaves the caliper of a braked wheel out (in Play it is a separate object that stays with the suspension). */
  { caliper = true }: { caliper?: boolean } = {},
): THREE.Group {
  const root = new THREE.Group();
  const noRaycast = { raycast: () => {} };

  if (isStructural(part.type)) {
    // Each box of the shape, with its studs, in the part's own frame (studs up); the root turns it to the part's orientation.
    const mats = blockMaterials(part.color, part.type);
    for (const box of SHAPES[part.type].boxes) {
      const group = new THREE.Group();
      group.position.set(...box.offset);
      const mesh = new THREE.Mesh(blockGeo, mats.face);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.scale.set(...box.size);
      group.add(mesh);
      const edges = new THREE.LineSegments(edgeGeo, mats.edge);
      Object.assign(edges, noRaycast);
      edges.scale.set(...box.size).multiplyScalar(BLOCK_EDGE_SCALE);
      group.add(edges);
      group.add(studsMesh(mats.face, box.size, box.studs));
      group.add(socketsMesh(box.size, box.studs));
      root.add(group);
    }
  } else if (part.type === 'brake') {
    // The brake part itself (what the catalog and the placement preview show): the whole brake, in its own frame.
    root.add(createBrakeModel());
  } else if (part.type === 'engine') {
    // The engine in its own frame: front +z, cylinder heads up.
    root.add(createEngineModel(blockMaterials(part.color, 'engine').face));
  } else {
    // A wheel in its own frame: the axle along +x (a large wheel is the same model, scaled).
    const pivot = new THREE.Group();
    // The wheel's body stays unturned in Play (Rapier's joint axis; see AGENTS.md) and moves the whole object, so a wheel
    // carries its orientation inside, in the pivot, instead of on the root like the other parts.
    pivot.quaternion.copy(orientationQuaternion(orientationOfPart(part))).multiply(faceQuaternion([1, 0, 0]));
    pivot.scale.setScalar(wheelSizeOf(part.type).scale);
    // Tire (rubber) and rim (metal, open between the spokes: a braked wheel shows its brake disc there); see wheel-model.ts.
    const tire = new THREE.Mesh(wheelGeometry.tire, tireMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(wheelGeometry.rim, rimMat);
    rim.castShadow = true;
    pivot.add(tire, rim);
    root.add(pivot);
    // A braked wheel has its disc behind the rim; the disc turns with the wheel, so it is part of this object.
    if (brakeOf(part) > 0) {
      const brake = brakeFitting(part);
      brake.add(createBrakeDisc());
      if (caliper) brake.add(createBrakeCaliper());
      root.add(brake);
    }
  }
  // Every other part is turned the same way: its own frame to the world by its orientation.
  if (!isWheelType(part.type)) root.quaternion.copy(orientationQuaternion(orientationOfPart(part)));
  if (ghost) {
    makeGhost(root, ghost === 'bad');
    root.scale.setScalar(GHOST_BLOCK_SCALE); // a hair smaller: no z-fighting with the faces of its neighbours
  }
  return root;
}
