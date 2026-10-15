import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WHEEL, WHEEL_VISUAL as V } from '../constants';

/**
 * Geometry of the wheel model, built once and shared by every wheel. All of it is around the Y axis (the axle), centred on
 * the origin; `createPartObject` turns the Y axis onto the real axle. Two pieces, each one merged mesh (the rim is open between the spokes):
 * - `tire`: a lathe-turned rubber ring (flat sidewalls, rounded shoulders, flat tread) plus staggered tread lugs;
 * - `rim`: the light metal parts: lip ring, five spokes, hub cap and lug nuts;
 */
export const wheelGeometry = (() => {
  const R = WHEEL.radius;
  const h = WHEEL.width / 2;

  // ---- tire: profile (radius, height) revolved around Y, counter-clockwise so the normals point outwards ----
  const bodyRadius = R - V.lugHeight; // the lugs add the last bit, so nothing sticks out of the physical radius
  const s = V.tireShoulder;
  const bead = V.tireInnerRadius;
  const profile: THREE.Vector2[] = [new THREE.Vector2(bead, -h * 0.85), new THREE.Vector2(bead + 0.03, -h), new THREE.Vector2(bodyRadius - s, -h)];
  for (const deg of [-90, -60, -30, 0]) {
    const a = THREE.MathUtils.degToRad(deg);
    profile.push(new THREE.Vector2(bodyRadius - s + s * Math.cos(a), -(h - s) + s * Math.sin(a)));
  }
  for (const deg of [0, 30, 60, 90]) {
    const a = THREE.MathUtils.degToRad(deg);
    profile.push(new THREE.Vector2(bodyRadius - s + s * Math.cos(a), h - s + s * Math.sin(a)));
  }
  profile.push(new THREE.Vector2(bead + 0.03, h), new THREE.Vector2(bead, h * 0.85), profile[0].clone());
  const tireParts: THREE.BufferGeometry[] = [new THREE.LatheGeometry(profile, V.segments)];

  // Tread lugs, alternating between two rows so the pattern looks staggered.
  for (let i = 0; i < V.treadLugs; i++) {
    const angle = (i / V.treadLugs) * Math.PI * 2;
    const lug = new THREE.BoxGeometry(V.lugHeight * 2, V.lugWidth, V.lugLength); // x radial, y axial, z tangential
    lug.translate(bodyRadius, (i % 2 === 0 ? 1 : -1) * V.lugRowOffset, 0);
    lug.rotateY(-angle);
    tireParts.push(lug);
  }
  const tire = mergeGeometries(tireParts.map((g) => g.toNonIndexed()))!;

  // ---- rim: light metal parts ----
  const rw = V.rimWidth;
  const lip = new THREE.LatheGeometry(
    [
      new THREE.Vector2(V.rimRadius - V.rimLip, -rw / 2),
      new THREE.Vector2(V.rimRadius, -rw / 2),
      new THREE.Vector2(V.rimRadius, rw / 2),
      new THREE.Vector2(V.rimRadius - V.rimLip, rw / 2),
      new THREE.Vector2(V.rimRadius - V.rimLip, -rw / 2),
    ],
    V.segments,
  );
  const rimParts: THREE.BufferGeometry[] = [lip];

  const spokeInner = V.hubRadius * 0.8;
  const spokeOuter = V.rimRadius - V.rimLip + 0.01;
  for (let i = 0; i < V.spokes; i++) {
    const angle = (i / V.spokes) * Math.PI * 2;
    const spoke = new THREE.BoxGeometry(spokeOuter - spokeInner, rw * 0.8, V.spokeWidth);
    spoke.translate((spokeInner + spokeOuter) / 2, 0, 0);
    spoke.rotateY(-angle);
    rimParts.push(spoke);
  }
  rimParts.push(new THREE.CylinderGeometry(V.hubRadius, V.hubRadius, rw + V.hubProtrusion * 2, 24));
  for (let i = 0; i < V.nuts; i++) {
    const angle = ((i + 0.5) / V.nuts) * Math.PI * 2; // between the spokes
    const nut = new THREE.CylinderGeometry(V.nutRadius, V.nutRadius, rw - V.rimRecess * 0.8, 6);
    nut.translate(V.nutCircle * Math.cos(angle), 0, V.nutCircle * Math.sin(angle));
    rimParts.push(nut);
  }
  const rim = mergeGeometries(rimParts.map((g) => g.toNonIndexed()))!;

  return { tire, rim };
})();
