import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA, CELL_SIZE, GROUND_Y, buildRange } from './constants';
import { partBounds } from './parts/part-defs';
import { Part } from './types';

/**
 * Keeps the orbit camera above the ground without changing how far it is from its target, so the zoom (that distance, see
 * `ZoomControl`) means the same wherever the camera is. The target is kept on or above the ground, and the polar angle is limited to
 * the one at which the camera, at its current distance, is still `CAMERA.minHeight` above the ground: the orbit controls then
 * turn the view away from the ground instead of pushing the camera up (which changed the distance and the view angle of a
 * low camera while zooming). With an `area` the target is also kept inside it (the camera moves along, so the distance and the
 * view angle do not change): the point the camera orbits and zooms towards cannot be panned away from the creation. Call it before
 * `controls.update()`.
 */
export function limitCamera(controls: OrbitControls, camera: THREE.Camera, area: THREE.Box3 | null = null): void {
  if (area) {
    const clamped = controls.target.clone().clamp(area.min, area.max);
    const shift = clamped.clone().sub(controls.target);
    if (shift.lengthSq() > 0) {
      controls.target.copy(clamped);
      camera.position.add(shift);
    }
  }
  controls.target.y = Math.max(controls.target.y, GROUND_Y);
  const distance = camera.position.distanceTo(controls.target);
  const ratio = (GROUND_Y + CAMERA.minHeight - controls.target.y) / Math.max(distance, CAMERA.minDistance * 0.1);
  controls.maxPolarAngle = Math.min(Math.PI * CAMERA.maxPolarFactor, Math.acos(THREE.MathUtils.clamp(ratio, -1, 1)));
}

/**
 * Safety net after `controls.update()` (panning moves the target itself): the camera is never below `CAMERA.minHeight` above the
 * ground, and the target never below the ground.
 */
export function keepCameraAboveGround(controls: OrbitControls, camera: THREE.Camera): void {
  const minCameraY = GROUND_Y + CAMERA.minHeight;
  if (controls.target.y >= GROUND_Y && camera.position.y >= minCameraY) return;
  controls.target.y = Math.max(controls.target.y, GROUND_Y);
  camera.position.y = Math.max(camera.position.y, minCameraY);
  camera.lookAt(controls.target);
}

/**
 * Where the camera's target may be while building: the box of the creation widened by `CAMERA.panMargin` cells (so there is room to
 * build next to it), or, while the creation is empty, the whole build area of a grid of `cells` squares.
 */
export function panArea(parts: ReadonlyArray<Part>, cells: number): THREE.Box3 {
  const area = new THREE.Box3();
  if (parts.length === 0) {
    const { min, max, maxY } = buildRange(cells);
    return area.set(new THREE.Vector3(min - CELL_SIZE / 2, GROUND_Y, min - CELL_SIZE / 2), new THREE.Vector3(max + CELL_SIZE / 2, maxY, max + CELL_SIZE / 2));
  }
  for (const part of parts) area.union(partBounds(part));
  return area.expandByScalar(CAMERA.panMargin * CELL_SIZE);
}
