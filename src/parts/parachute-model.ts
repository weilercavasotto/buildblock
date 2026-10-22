import * as THREE from 'three';
import { COLORS, PARACHUTE_VISUAL, ROUGHNESS, hexToNumber } from '../constants';

/**
 * The parachute model: a pack at the back (-z, against the block) and, in front of it (+z, where it opens), the lines and a dome canopy,
 * in its own frame, centred on the origin. The canopy and its lines are one group named `PARACHUTE_CANOPY`, scaled about the front of
 * the pack: `PhysicsWorld` sets its scale to how far the parachute is open (and hides it when folded). Tuned through `PARACHUTE_VISUAL`;
 * `createPartObject` turns it like any part.
 */
const V = PARACHUTE_VISUAL;
export const PARACHUTE_CANOPY = 'parachute-canopy';
const total = V.packLength + 0.1;
const standard = (hex: string, side: THREE.Side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ color: hexToNumber(hex), roughness: ROUGHNESS.block, side });
const capMat = standard(COLORS.part.parachuteCap);
const lineMat = new THREE.LineBasicMaterial({ color: hexToNumber(COLORS.part.parachuteLine) });
/** The default (steel) pack, when it is not painted. */
export const parachutePack = standard(COLORS.part.parachute);
/** The default (red) canopy. */
export const parachuteCanopy = standard(COLORS.part.parachuteCanopy, THREE.DoubleSide);

const alongZ = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => geometry.rotateX(Math.PI / 2);
const pack = alongZ(new THREE.CylinderGeometry(V.packRadius, V.packRadius, V.packLength, V.segments)).translate(0, 0, -total / 2 + V.packLength / 2);
const cap = alongZ(new THREE.CylinderGeometry(V.capRadius, V.capRadius, 0.1, V.segments)).translate(0, 0, total / 2 - 0.05);
/** The dome: a hemisphere whose rim is at z = 0 and whose top is at +z. */
const dome = alongZ(new THREE.SphereGeometry(V.canopyRadius, V.segments, V.segments / 2, 0, Math.PI * 2, 0, Math.PI / 2));

/** Builds the parachute; `material` is the pack's (the default one, or the paint), which also colours the canopy when painted. */
export function createParachuteModel(material: THREE.Material = parachutePack): THREE.Group {
  const model = new THREE.Group();
  const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  add(model, pack, material);
  add(model, cap, capMat);
  const canopy = new THREE.Group();
  canopy.name = PARACHUTE_CANOPY;
  canopy.position.z = total / 2;
  canopy.scale.setScalar(V.restScale);
  add(canopy, dome.clone().translate(0, 0, V.canopyDistance), material === parachutePack ? parachuteCanopy : material);
  const points: number[] = [];
  for (let i = 0; i < V.lineCount; i++) {
    const a = (i * Math.PI * 2) / V.lineCount;
    points.push(0, 0, 0, Math.cos(a) * V.canopyRadius, Math.sin(a) * V.canopyRadius, V.canopyDistance);
  }
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), lineMat);
  lines.raycast = () => {};
  canopy.add(lines);
  model.add(canopy);
  return model;
}
