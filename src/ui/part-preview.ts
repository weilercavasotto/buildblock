import * as THREE from 'three';
import { COLORS, GROUND_Y, PREVIEW, SAVE_PREVIEW, hexToNumber } from '../constants';
import { createPartObject } from '../parts/part-defs';
import { Part, PartType, Vec3, partCentre } from '../types';

interface PreviewScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Group;
  /** Per part: the centred object and the camera distance that frames it. */
  parts: Map<string, { object: THREE.Object3D; distance: number }>;
}

let shared: PreviewScene | null = null;

/** How a preview is drawn. */
export interface PreviewOptions {
  /** Paint of the part (`Part.color`). */
  color?: string;
}

/** One off-screen WebGL renderer shared by every preview (hotbar, catalog cards, inspector): browsers cap contexts. */
function setup(): PreviewScene {
  if (shared) return shared;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(hexToNumber(COLORS.white), hexToNumber(COLORS.scene.hemisphereGround), 1.4));
  const sun = new THREE.DirectionalLight(hexToNumber(COLORS.white), 2.4);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const pivot = new THREE.Group();
  scene.add(pivot);
  shared = { renderer, scene, camera: new THREE.PerspectiveCamera(PREVIEW.fov, 1, 0.1, 50), pivot, parts: new Map() };
  return shared;
}

/** The camera distance that frames a sphere of the given radius in the preview camera. */
const distanceFor = (radius: number): number => (radius * PREVIEW.margin) / Math.sin(THREE.MathUtils.degToRad(PREVIEW.fov / 2));

function partEntry(type: PartType, color?: string) {
  const s = setup();
  const key = `${type}:${color ?? ''}`;
  let entry = s.parts.get(key);
  if (!entry) {
    // Rotation 0: a wheel is shown with its axle along X.
    const object = createPartObject({ type, color });
    const box = new THREE.Box3().setFromObject(object);
    object.position.sub(box.getCenter(new THREE.Vector3()));
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    entry = { object, distance: distanceFor(radius) };
    s.parts.set(key, entry);
  }
  return entry;
}

/** Creates a canvas for previews, `cssSize` px wide and tall, with the backing store scaled for the display. */
export function createPreviewCanvas(cssSize: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const pixels = Math.round(cssSize * Math.min(window.devicePixelRatio || 1, 2));
  canvas.width = canvas.height = pixels;
  canvas.style.width = canvas.style.height = `${cssSize}px`;
  return canvas;
}

/** Draws `type`, turned `angle` radians around the vertical axis, into `canvas` (see `createPreviewCanvas`). */
export function renderPartPreview(
  type: PartType,
  canvas: HTMLCanvasElement,
  angle: number = PREVIEW.angle,
  { color }: PreviewOptions = {},
): void {
  const s = setup();
  const entry = partEntry(type, color);
  const size = canvas.width;
  s.renderer.setPixelRatio(1);
  s.renderer.setSize(size, size, false);
  s.pivot.clear();
  s.pivot.add(entry.object);
  s.pivot.rotation.y = angle;
  const direction = new THREE.Vector3(...PREVIEW.cameraDirection).normalize();
  s.camera.position.copy(direction.multiplyScalar(entry.distance));
  s.camera.lookAt(0, 0, 0);
  s.renderer.render(s.scene, s.camera);

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(s.renderer.domElement, 0, 0, size, size);
}

/** The material of the floor under a creation in the preview of a save (shared by every preview). */
let floor: THREE.Material | null = null;
const floorMaterial = (): THREE.Material => (floor ??= new THREE.MeshStandardMaterial({ color: hexToNumber(COLORS.scene.floor), roughness: 1 }));

/**
 * Draws a whole creation (all its `parts`, each at its place as in build mode, folded rotors and pistons included) on the floor of the
 * game (green with its grid lines, level with the ground, so large that it fills the whole canvas behind the creation) into `canvas`,
 * framed on the creation (an empty one shows just the floor), from the resting angle of the part previews.
 */
export function renderCreationPreview(parts: ReadonlyArray<Part>, canvas: HTMLCanvasElement, angle: number = PREVIEW.angle): void {
  const ctx = canvas.getContext('2d')!;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  const s = setup();
  const group = new THREE.Group();
  for (const part of parts) {
    const holder = new THREE.Group();
    holder.position.set(...partCentre(part));
    holder.add(createPartObject(part));
    group.add(holder);
  }
  // The creation is what is framed; the floor is added after measuring it.
  const box = parts.length > 0 ? new THREE.Box3().setFromObject(group) : new THREE.Box3(new THREE.Vector3(0, GROUND_Y, 0), new THREE.Vector3(0, GROUND_Y, 0)).expandByScalar(SAVE_PREVIEW.emptyRadius);
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
  // The floor: a plane level with the ground, big enough to fill the view whichever way it looks, with the grid of the game on it (its lines run along the cell edges).
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(SAVE_PREVIEW.extent, SAVE_PREVIEW.extent).rotateX(-Math.PI / 2), floorMaterial());
  plane.position.y = GROUND_Y;
  const lines = new THREE.GridHelper(SAVE_PREVIEW.extent, SAVE_PREVIEW.extent, hexToNumber(COLORS.scene.gridMinor), hexToNumber(COLORS.scene.gridMinor));
  lines.position.set(0.5, GROUND_Y + SAVE_PREVIEW.lineLift, 0.5);
  group.add(plane, lines);
  group.position.sub(box.getCenter(new THREE.Vector3()));
  s.renderer.setPixelRatio(1);
  s.renderer.setSize(size, size, false);
  s.pivot.clear();
  s.pivot.add(group);
  s.pivot.rotation.y = angle;
  const direction = new THREE.Vector3(...PREVIEW.cameraDirection).normalize();
  s.camera.position.copy(direction.multiplyScalar(distanceFor(radius)));
  s.camera.lookAt(0, 0, 0);
  s.renderer.render(s.scene, s.camera);
  s.pivot.clear();
  plane.geometry.dispose();
  lines.geometry.dispose();
  (lines.material as THREE.Material).dispose();
  ctx.drawImage(s.renderer.domElement, 0, 0, size, size);
}

/**
 * Keeps rotating the preview in `canvas` until the returned function is called, which also puts it back at the resting
 * angle (or leaves it as is with `reset = false`).
 */
export function startSpin(type: PartType, canvas: HTMLCanvasElement, speed: number, reset = true, options: PreviewOptions = {}): () => void {
  let frame = 0;
  const start = performance.now();
  const tick = (now: number) => {
    renderPartPreview(type, canvas, PREVIEW.angle + ((now - start) / 1000) * speed, options);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    if (reset) renderPartPreview(type, canvas, undefined, options);
  };
}
