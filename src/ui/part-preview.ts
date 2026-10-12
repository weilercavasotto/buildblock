import * as THREE from 'three';
import { COLORS, PART_INFO, PREVIEW, hexToNumber } from '../constants';
import { createPartObject } from '../parts/part-defs';
import { PartType, Vec3 } from '../types';

interface PreviewScene {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pivot: THREE.Group;
  /** Per part: the centred object and the camera distance that frames it. */
  parts: Map<string, { object: THREE.Object3D; distance: number }>;
}

let shared: PreviewScene | null = null;

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
    const distance = (radius * PREVIEW.margin) / Math.sin(THREE.MathUtils.degToRad(PREVIEW.fov / 2));
    entry = { object, distance };
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
  angle: number = PART_INFO[type].previewAngle,
  color?: string,
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

/**
 * Keeps rotating the preview in `canvas` until the returned function is called, which also puts it back at the resting
 * angle (or leaves it as is with `reset = false`).
 */
export function startSpin(type: PartType, canvas: HTMLCanvasElement, speed: number, reset = true, color?: string): () => void {
  let frame = 0;
  const start = performance.now();
  const tick = (now: number) => {
    renderPartPreview(type, canvas, PART_INFO[type].previewAngle + ((now - start) / 1000) * speed, color);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    if (reset) renderPartPreview(type, canvas, undefined, color);
  };
}
