import * as THREE from 'three';
import { ALPHA, BRAKE_VISUAL, PAINT_EDGE_FACTOR, HEADED_PARTS, HINGE_BODY, HINGE_VISUAL, PISTON_BODY, PISTON_VISUAL, ROTOR_BODY, ROTOR_VISUAL, SHAPES, STUD, BLOCK_VISUAL_SIZE, BLOCK_EDGE_SCALE, COLORS, GHOST_BLOCK_SCALE, HIGHLIGHT, METALNESS, ROUGHNESS, WHEEL, brakeOf, hexToNumber, wheelSizeOf } from '../constants';
import { Part, PartType, Vec3, axleOf, frontOf, isCompactMounted, isHexColor, isStructural, isWheelType, isWing, orientationOfPart, partCentre } from '../types';
import { Orientation, matrixOf } from './orientation';
import { createBrakeCaliper, createBrakeDisc } from './brake-model';
import { createThrusterModel, thrusterTube } from './thruster-model';
import { createPropellerModel, propellerHousing } from './propeller-model';
import { createTurboModel, turboBottle } from './turbo-model';
import { createEngineModel, engineMetal } from './engine-model';
import { partBox } from './part-geometry';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { wheelGeometry } from './wheel-model';

const color = (hex: string): number => hexToNumber(hex);

const blockGeo = new THREE.BoxGeometry(BLOCK_VISUAL_SIZE, BLOCK_VISUAL_SIZE, BLOCK_VISUAL_SIZE);
const edgeGeo = new THREE.EdgesGeometry(blockGeo);
/**
 * The wedge: a triangular prism that fits the unit cube like `blockGeo` (scaled to the box of the shape), its slope rising towards -z:
 * the front foot (+z, bottom), the back foot (-z, bottom) and the back top. Flat shaded.
 */
const wedgeGeo = (() => {
  const h = BLOCK_VISUAL_SIZE / 2;
  const front: [number, number] = [h, -h]; // z, y
  const back: [number, number] = [-h, -h];
  const top: [number, number] = [-h, h];
  const at = (x: number, [z, y]: [number, number]): number[] => [x, y, z];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => [...a, ...b, ...c, ...a, ...c, ...d];
  const l = at(-h, front), l2 = at(-h, back), l3 = at(-h, top);
  const r = at(h, front), r2 = at(h, back), r3 = at(h, top);
  const positions = [
    ...l, ...l3, ...l2, // the left triangle (outside: -x)
    ...r, ...r2, ...r3, // the right triangle (outside: +x)
    ...quad(l2, r2, r, l), // the bottom
    ...quad(l2, l3, r3, r2), // the back
    ...quad(l, r, r3, l3), // the slope
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
})();
const wedgeEdgeGeo = new THREE.EdgesGeometry(wedgeGeo, 20);
/**
 * A flat shape with a convex outline (`ShapeBox.polygon`, x and z in cells) of the given thickness, centred on the origin: the top and the
 * bottom are fans, the sides quads. In real size (not scaled), cached by outline.
 */
const polygonCache = new Map<string, { geometry: THREE.BufferGeometry; edges: THREE.BufferGeometry }>();
function polygonGeometry(polygon: ReadonlyArray<readonly [number, number]>, thickness: number): { geometry: THREE.BufferGeometry; edges: THREE.BufferGeometry } {
  const key = `${polygon.join(';')}|${thickness}`;
  let made = polygonCache.get(key);
  if (!made) {
    const h = thickness / 2;
    const centre = polygon.reduce(([cx, cz], [x, z]) => [cx + x / polygon.length, cz + z / polygon.length], [0, 0]);
    const positions: number[] = [];
    const at = ([x, z]: readonly [number, number], y: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    // A triangle whose front (counter-clockwise) side faces `outward`, whichever way the outline runs.
    const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, outward: THREE.Vector3) => {
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      positions.push(...a.toArray(), ...(normal.dot(outward) < 0 ? [...c.toArray(), ...b.toArray()] : [...b.toArray(), ...c.toArray()]));
    };
    const up = new THREE.Vector3(0, 1, 0);
    const down = new THREE.Vector3(0, -1, 0);
    for (let i = 1; i < polygon.length - 1; i++) {
      tri(at(polygon[0], h), at(polygon[i], h), at(polygon[i + 1], h), up);
      tri(at(polygon[0], -h), at(polygon[i], -h), at(polygon[i + 1], -h), down);
    }
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const outward = new THREE.Vector3((a[0] + b[0]) / 2 - centre[0], 0, (a[1] + b[1]) / 2 - centre[1]);
      tri(at(a, -h), at(b, -h), at(b, h), outward);
      tri(at(a, -h), at(b, h), at(a, h), outward);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    made = { geometry, edges: new THREE.EdgesGeometry(geometry, 20) };
    polygonCache.set(key, made);
  }
  return made;
}
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
/** The default material of a wing. */
const wingMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.wing), roughness: ROUGHNESS.block, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
/** Materials of painted blocks, one pair per colour (shared by every block with that colour). */
const paintCache = new Map<string, { face: THREE.MeshStandardMaterial; edge: THREE.LineBasicMaterial }>();
function blockMaterials(paint?: string, type?: string) {
  if (!isHexColor(paint)) return type === 'engine' ? { face: engineMetal, edge: edgeMat } : type === 'turbo' ? { face: turboBottle, edge: edgeMat } : type === 'thruster' ? { face: thrusterTube, edge: edgeMat } : type === 'propeller' ? { face: propellerHousing, edge: edgeMat } : isWing(type as PartType) ? { face: wingMat, edge: edgeMat } : { face: blockMat, edge: edgeMat };
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
  if (isStructural(part.type) || isCompactMounted(part.type)) {
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

/** The caliper of a wheel as a separate object (in Play it follows the suspension, not the spinning wheel). */
export function createCaliperObject(wheel: Pick<Part, 'type' | 'studs' | 'spin' | 'face'>): THREE.Group {
  const fitting = brakeFitting(wheel);
  fitting.add(createBrakeCaliper());
  const holder = new THREE.Group();
  holder.add(fitting);
  return holder;
}

const rotorBaseMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.rotor), roughness: ROUGHNESS.rim, metalness: METALNESS.rim });
const rotorRingMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.rotorRing), roughness: ROUGHNESS.rim, metalness: METALNESS.rim });

const rotorHeadMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.rotorHead), roughness: ROUGHNESS.block, metalness: METALNESS.rim * 0.5 });

/** A cylinder along +Y whose bottom is at `y` (the rotor is built along its axis, from the block outwards). */
function disc(radius: number, height: number, y: number, material: THREE.Material, segments: number = ROTOR_VISUAL.segments): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
  mesh.position.y = y + height / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/**
 * The base of a rotor in its own frame (axis +Y, centred on the base, the block at the bottom): a wide dark flange with a ring of bolts,
 * the body and a light bearing ring on top, where the head turns.
 */
function rotorBaseGroup(): THREE.Group {
  const V = ROTOR_VISUAL;
  const group = new THREE.Group();
  const bottom = -V.baseDepth / 2;
  const bodyHeight = V.baseDepth - V.flangeHeight - V.bearingHeight;
  group.add(
    disc(V.flangeRadius, V.flangeHeight, bottom, rotorBaseMat),
    disc(V.bodyRadius, bodyHeight, bottom + V.flangeHeight, rotorBaseMat),
    disc(V.bearingRadius, V.bearingHeight, bottom + V.flangeHeight + bodyHeight, rotorRingMat),
  );
  for (let i = 0; i < V.bolts; i++) {
    const angle = (i / V.bolts) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(V.boltRadius, V.boltRadius, V.boltHeight, 10), rotorRingMat);
    bolt.position.set(Math.cos(angle) * V.boltDistance, bottom + V.flangeHeight + V.boltHeight / 2, Math.sin(angle) * V.boltDistance);
    bolt.raycast = () => {};
    group.add(bolt);
  }
  return group;
}

/**
 * The head of a rotor in its own frame (axis +Y, centred on the head): a round orange disc with a ring of studs on top (the same 2 x 2
 * studs of a plate: they are what the parts built on it engage), or painted in a colour.
 */
function rotorHeadGroup(paint?: string): THREE.Group {
  const material = isHexColor(paint) ? blockMaterials(paint).face : rotorHeadMat;
  const group = new THREE.Group();
  group.add(disc(ROTOR_VISUAL.headRadius, ROTOR_VISUAL.headDepth, -ROTOR_VISUAL.headDepth / 2, material));
  group.add(studsMesh(material, [ROTOR_BODY.width, ROTOR_VISUAL.headDepth, ROTOR_BODY.width], [0, 1, 0]));
  return group;
}

const pistonBaseMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.piston), roughness: ROUGHNESS.rim, metalness: METALNESS.rim });
const pistonCollarMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.pistonCollar), roughness: ROUGHNESS.rim, metalness: METALNESS.rim });
const pistonRodMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.pistonRod), roughness: ROUGHNESS.rim * 0.6, metalness: METALNESS.rim });
const pistonHeadMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.pistonHead), roughness: ROUGHNESS.block, metalness: METALNESS.rim * 0.5 });

/** The base of a piston in its own frame (axis +Y, centred on the base, the block at the bottom): a wide flange, the barrel and a light collar round its mouth. */
function pistonBaseGroup(): THREE.Group {
  const V = PISTON_VISUAL;
  const group = new THREE.Group();
  const bottom = -V.baseDepth / 2;
  const barrelHeight = V.baseDepth - V.flangeHeight;
  group.add(
    disc(V.flangeRadius, V.flangeHeight, bottom, pistonBaseMat, V.segments),
    disc(V.barrelRadius, barrelHeight, bottom + V.flangeHeight, pistonBaseMat, V.segments),
    disc(V.collarRadius + 0.04, V.collarHeight, bottom + V.baseDepth - V.collarHeight, pistonCollarMat, V.segments),
  );
  return group;
}

/** The head of a piston in its own frame (axis +Y, centred on the head): a silver disc with the 2 x 2 studs on top, or painted. */
function pistonHeadGroup(paint?: string): THREE.Group {
  const material = isHexColor(paint) ? blockMaterials(paint).face : pistonHeadMat;
  const group = new THREE.Group();
  group.add(disc(PISTON_VISUAL.headRadius, PISTON_VISUAL.headDepth, -PISTON_VISUAL.headDepth / 2, material, PISTON_VISUAL.segments));
  group.add(studsMesh(material, [PISTON_BODY.width, PISTON_VISUAL.headDepth, PISTON_BODY.width], [0, 1, 0]));
  return group;
}

/** The rod of a piston: a unit-long cylinder along +Y with its base at the origin, to be scaled to the length that is out (see `PhysicsWorld`). */
export function createPistonRod(): THREE.Mesh {
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(PISTON_VISUAL.rodRadius, PISTON_VISUAL.rodRadius, 1, PISTON_VISUAL.segments).translate(0, 0.5, 0), pistonRodMat);
  rod.castShadow = true;
  rod.raycast = () => {};
  return rod;
}

const hingeBaseMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.hinge), roughness: ROUGHNESS.rim, metalness: METALNESS.rim });
const hingePinMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.hingePin), roughness: ROUGHNESS.rim * 0.6, metalness: METALNESS.rim });
const hingeHeadMat = new THREE.MeshStandardMaterial({ color: color(COLORS.part.hingeHead), roughness: ROUGHNESS.block, metalness: METALNESS.rim * 0.5 });

/**
 * The base of a hinge in its own frame (axis +Y, centred on the base, the block at the bottom, the pin along x at the back edge, -z):
 * a flat plate and the pin, tangent to its top, that the head swings round.
 */
function hingeBaseGroup(): THREE.Group {
  const V = HINGE_VISUAL;
  const group = new THREE.Group();
  const width = HINGE_BODY.width - 2 * V.baseInset;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(width, V.baseDepth, width), hingeBaseMat);
  plate.castShadow = plate.receiveShadow = true;
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(V.pinRadius, V.pinRadius, HINGE_BODY.width - 2 * V.pinInset, V.segments).rotateZ(Math.PI / 2), hingePinMat);
  pin.position.set(0, V.baseDepth / 2 - V.pinRadius, -HINGE_BODY.width / 2 + V.pinRadius);
  pin.castShadow = true;
  group.add(plate, pin);
  return group;
}

/** The head of a hinge in its own frame (axis +Y, centred on the head): a thin teal plate with the 2 x 2 studs on top, or painted. */
function hingeHeadGroup(paint?: string): THREE.Group {
  const material = isHexColor(paint) ? blockMaterials(paint).face : hingeHeadMat;
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(HINGE_BODY.width, HINGE_VISUAL.headDepth, HINGE_BODY.width), material);
  plate.castShadow = plate.receiveShadow = true;
  group.add(plate, studsMesh(material, [HINGE_BODY.width, HINGE_VISUAL.headDepth, HINGE_BODY.width], [0, 1, 0]));
  return group;
}

/**
 * Where the head of a placed hinge turns: the point on its pin (at the back edge, `-front`, tangent to the top of the base) and the axis
 * (along the pin, signed so that a positive angle lifts the head's front away from the block), both in the world. The pin is along the
 * part's local x and the front is its local z, whatever way it is turned.
 */
export function hingePivot(part: Pick<Part, 'type' | 'cell' | 'face' | 'studs' | 'spin'>): { point: Vec3; axis: Vec3 } {
  const centre = partCentre(part);
  const face = part.face ?? [0, 1, 0];
  const { baseDepth, headDepth } = HEADED_PARTS.hinge;
  const interface_ = (baseDepth - headDepth) / 2; // where the base meets the head, from the centre of the part, along the face
  const lift = interface_ - HINGE_VISUAL.pinRadius;
  const back = HINGE_BODY.width / 2 - HINGE_VISUAL.pinRadius;
  const front = frontOf(part);
  const axle = axleOf(part);
  return {
    point: [0, 1, 2].map((i) => centre[i] + face[i] * lift - front[i] * back) as Vec3,
    axis: axle.map((v) => (v === 0 ? 0 : -v)) as Vec3,
  };
}

/** Where, along its axis, the centres of the base and of the head are from the centre of a rotor or a piston (cells; the head is on the +Y side). */
const headedOffsets = (type: 'rotor' | 'piston' | 'hinge'): { base: number; head: number } => {
  const { baseDepth, headDepth } = HEADED_PARTS[type];
  const depth = baseDepth + headDepth;
  return { base: -(depth - baseDepth) / 2, head: (depth - headDepth) / 2 };
};

/** The world centres of the base and of the head of a placed rotor or piston (folded; the head is the side the part's face points to). */
export function headedCentres(part: Pick<Part, 'type' | 'cell' | 'face' | 'studs' | 'spin'>): { base: Vec3; head: Vec3 } {
  const centre = partCentre(part);
  const face = part.face ?? [0, 1, 0];
  const offsets = headedOffsets(part.type as 'rotor' | 'piston' | 'hinge');
  const at = (offset: number): Vec3 => [centre[0] + face[0] * offset, centre[1] + face[1] * offset, centre[2] + face[2] * offset];
  return { base: at(offsets.base), head: at(offsets.head) };
}

/** The base of a placed rotor or piston as an object of its own, centred on the base (in Play it stays with the block). */
export function createHeadedBaseObject(part: Pick<Part, 'type' | 'studs' | 'spin'>): THREE.Group {
  const holder = new THREE.Group();
  holder.quaternion.copy(orientationQuaternion(orientationOfPart(part)));
  holder.add(part.type === 'piston' ? pistonBaseGroup() : part.type === 'hinge' ? hingeBaseGroup() : rotorBaseGroup());
  return holder;
}

/** The head of a placed rotor or piston as an object of its own, centred on the head (in Play it moves with the body that holds it). */
export function createHeadedHeadObject(part: Pick<Part, 'type' | 'studs' | 'spin' | 'color'>): THREE.Group {
  const holder = new THREE.Group();
  holder.quaternion.copy(orientationQuaternion(orientationOfPart(part)));
  holder.add(part.type === 'piston' ? pistonHeadGroup(part.color) : part.type === 'hinge' ? hingeHeadGroup(part.color) : rotorHeadGroup(part.color));
  return holder;
}

/** Builds the visual for a part, centred on its own origin (cell centre). */
export function createPartObject(
  part: Pick<Part, 'type' | 'color' | 'studs' | 'spin' | 'face'>,
  ghost?: 'ok' | 'bad',
  /** `caliper: false` leaves the caliper of a wheel out (in Play it is a separate object that stays with the suspension). */
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
      const flatShape = box.polygon ? polygonGeometry(box.polygon, box.size[1]) : null;
      const mesh = new THREE.Mesh(flatShape ? flatShape.geometry : box.wedge ? wedgeGeo : blockGeo, mats.face);
      mesh.castShadow = mesh.receiveShadow = true;
      if (!flatShape) mesh.scale.set(...box.size);
      group.add(mesh);
      const edges = new THREE.LineSegments(flatShape ? flatShape.edges : box.wedge ? wedgeEdgeGeo : edgeGeo, mats.edge);
      Object.assign(edges, noRaycast);
      if (!flatShape) edges.scale.set(...box.size).multiplyScalar(BLOCK_EDGE_SCALE);
      group.add(edges);
      if (!box.wedge) group.add(studsMesh(mats.face, box.size, box.studs)); // a slope has no studs on it, only sockets underneath
      if (!box.polygon) group.add(socketsMesh(box.size, box.studs)); // the sockets of a swept wing would stick out of its outline: not drawn
      root.add(group);
    }
  } else if (part.type === 'rotor' || part.type === 'piston' || part.type === 'hinge') {
    // The rotor / piston / hinge in its own frame: the base against the block (-y) and the head with its studs on the outside (+y).
    const offsets = headedOffsets(part.type);
    const base = part.type === 'piston' ? pistonBaseGroup() : part.type === 'hinge' ? hingeBaseGroup() : rotorBaseGroup();
    base.position.y = offsets.base;
    const head = part.type === 'piston' ? pistonHeadGroup(part.color) : part.type === 'hinge' ? hingeHeadGroup(part.color) : rotorHeadGroup(part.color);
    head.position.y = offsets.head;
    root.add(base, head);
  } else if (part.type === 'thruster') {
    // The thruster in its own frame: the jet along z, the bell at the back.
    root.add(createThrusterModel(blockMaterials(part.color, 'thruster').face));
  } else if (part.type === 'propeller') {
    // The propeller in its own frame: the motor at the back, the blades in front (+z, the way it pushes).
    root.add(createPropellerModel(blockMaterials(part.color, 'propeller').face));
  } else if (part.type === 'turbo') {
    // The turbo in its own frame: the bottle along z, the nozzle at the back.
    root.add(createTurboModel(blockMaterials(part.color, 'turbo').face));
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
    // Tire (rubber) and rim (metal, open between the spokes: the brake disc shows there); see wheel-model.ts.
    const tire = new THREE.Mesh(wheelGeometry.tire, tireMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(wheelGeometry.rim, rimMat);
    rim.castShadow = true;
    pivot.add(tire, rim);
    root.add(pivot);
    // Every wheel has its brake disc behind the rim; the disc turns with the wheel, so it is part of this object.
    const brake = brakeFitting(part);
    brake.add(createBrakeDisc());
    if (caliper) brake.add(createBrakeCaliper());
    root.add(brake);
  }
  // Every other part is turned the same way: its own frame to the world by its orientation.
  if (!isWheelType(part.type)) root.quaternion.copy(orientationQuaternion(orientationOfPart(part)));
  if (ghost) {
    makeGhost(root, ghost === 'bad');
    root.scale.setScalar(GHOST_BLOCK_SCALE); // a hair smaller: no z-fighting with the faces of its neighbours
  }
  return root;
}
