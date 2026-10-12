import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS, ENGINE_BODY, ENGINE_FAN, ENGINE_VISUAL, ROUGHNESS, hexToNumber } from '../constants';
import { Vec3 } from '../types';

/**
 * The engine model: a small V engine in its own frame, `ENGINE_BODY.width` on a side, origin at the centre of that cube. The
 * fan (with its small yellow nose) is at the front, +z, the cylinder heads up (+y) and a dark oil pan at the bottom.
 * Everything is tuned through `ENGINE_VISUAL`; `createPartObject` turns it so the front points where the engine pushes and
 * the bottom rests on the block it is mounted on.
 */
const V = ENGINE_VISUAL;
const half = ENGINE_BODY.width / 2;

const standard = (hex: string) => new THREE.MeshStandardMaterial({ color: hexToNumber(hex), roughness: ROUGHNESS.block });
const rimMat = standard(COLORS.part.engineRim);
const darkMat = standard(COLORS.part.engineDark);
const markMat = standard(COLORS.accent.highlight);
/** The default aluminium of the engine, when it is not painted. */
export const engineMetal = standard(COLORS.part.engine);

const box = (size: Vec3, at: Vec3): THREE.BufferGeometry => new THREE.BoxGeometry(...size).translate(...at);

// The shared geometries (built once). The bores and their rims are laid on the top face of a bank (y = bankHeight / 2).
const boreAt = (i: number): number => (i - (V.cylinders - 1) / 2) * (V.bankLength / V.cylinders);
const bores = mergeGeometries(
  Array.from({ length: V.cylinders }, (_, i) => new THREE.CircleGeometry(V.boreRadius, V.segments).rotateX(-Math.PI / 2).translate(0, V.bankHeight / 2 + 0.002, boreAt(i))),
)!;
const rims = mergeGeometries(
  Array.from({ length: V.cylinders }, (_, i) => new THREE.RingGeometry(V.boreRadius, V.rimRadius, V.segments).rotateX(-Math.PI / 2).translate(0, V.bankHeight / 2 + 0.001, boreAt(i))),
)!;
const crankcase = box([ENGINE_BODY.width, V.crankcaseHeight, ENGINE_BODY.width], [0, -half + V.panHeight + V.crankcaseHeight / 2, 0]);
const pan = box([V.panWidth, V.panHeight, V.panLength], [0, -half + V.panHeight / 2, 0]);
const bank = box([V.bankWidth, V.bankHeight, V.bankLength], [0, 0, 0]);
const intake = box([V.intakeWidth, V.intakeHeight, V.intakeLength], [0, V.intakeLift, 0]);
// The fan: blades around a hub in the xy plane (the axis is z), a ring around them and a nose cone on the hub.
const F = ENGINE_FAN;
const bladeLength = F.radius - F.hubRadius;
const blades = mergeGeometries(
  Array.from({ length: F.blades }, (_, i) =>
    new THREE.BoxGeometry(bladeLength, F.bladeWidth, F.bladeThickness)
      .rotateX(F.bladePitch)
      .translate(F.hubRadius + bladeLength / 2, 0, 0)
      .rotateZ((i * Math.PI * 2) / F.blades),
  ),
)!;
const hub = new THREE.CylinderGeometry(F.hubRadius, F.hubRadius, F.hubLength, V.segments).rotateX(Math.PI / 2);
const ring = new THREE.TorusGeometry(F.ringRadius, F.ringTube, 8, V.segments * 2);
const nose = new THREE.ConeGeometry(F.noseRadius, F.noseLength, V.segments).rotateX(Math.PI / 2).translate(0, 0, F.hubLength / 2 + F.noseLength / 2);

/** Builds the engine; `metal` is the material of its aluminium parts (the default one, or the paint). */
export function createEngineModel(metal: THREE.Material = engineMetal): THREE.Group {
  const model = new THREE.Group();
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = model): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  add(crankcase, metal);
  add(pan, darkMat);
  add(intake, darkMat);

  // The two banks of the V, leaning away from each other, each with its row of bores.
  for (const side of [1, -1]) {
    const group = new THREE.Group();
    group.position.set(side * V.bankOffset, V.bankLift, 0);
    group.rotation.z = -side * V.bankTilt;
    add(bank, metal, group);
    add(rims, rimMat, group).castShadow = false;
    add(bores, darkMat, group).castShadow = false;
    model.add(group);
  }

  // The fan at the front, on the crankshaft axis: dark blades on a metal hub, in a ring, with a small accent nose.
  const fan = new THREE.Group();
  fan.position.set(0, V.crankHeight, half + F.standoff);
  add(blades, darkMat, fan);
  add(hub, rimMat, fan);
  add(ring, rimMat, fan);
  add(nose, markMat, fan);
  model.add(fan);

  return model;
}
