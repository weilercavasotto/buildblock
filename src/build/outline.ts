import * as THREE from 'three';
import { HIGHLIGHT } from '../constants';

/** A coloured wireframe box with a translucent fill around `box`; never takes part in raycasts. */
export function createOutline(box: THREE.Box3, color: number, fillOpacity: number): THREE.Group {
  const size = box.getSize(new THREE.Vector3());
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const group = new THREE.Group();
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color, depthTest: false }));
  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fillOpacity, depthWrite: false }),
  );
  for (const object of [lines, fill]) {
    object.raycast = () => {};
    object.renderOrder = 10;
    group.add(object);
  }
  group.position.copy(box.getCenter(new THREE.Vector3()));
  return group;
}

export const outlineFill = {
  selected: HIGHLIGHT.selectedFillOpacity,
  remove: HIGHLIGHT.removeFillOpacity,
  hover: HIGHLIGHT.hoverFillOpacity,
};

/** Removes an outline from its parent and frees its GPU resources. */
export function disposeOutline(group: THREE.Object3D | null): void {
  if (!group) return;
  group.removeFromParent();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh | THREE.LineSegments;
    mesh.geometry?.dispose();
    (mesh.material as THREE.Material | undefined)?.dispose();
  });
}
