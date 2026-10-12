import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA, TEXT, ZOOM } from '../constants';

/**
 * Zoom control (top left, under the home button): +/- buttons and a vertical slider, kept in sync with the
 * mouse-wheel zoom of the orbit controls. Zoom is the camera's distance to its target, limited to
 * [CAMERA.minDistance, CAMERA.maxDistance]; the slider is logarithmic (top = closest) and the label shows the
 * zoom relative to the default camera distance.
 */
export class ZoomControl {
  private root = document.getElementById('zoom')!;
  private slider = document.getElementById('zoom-slider') as HTMLInputElement;
  private label = document.getElementById('zoom-label')!;
  private zoomIn = document.getElementById('zoom-in')!;
  private zoomOut = document.getElementById('zoom-out')!;
  private lastLabel = '';
  private referenceDistance = new THREE.Vector3(...CAMERA.startPosition).distanceTo(
    new THREE.Vector3(...CAMERA.startTarget),
  );

  constructor(
    private controls: OrbitControls,
    private camera: THREE.Camera,
  ) {
    // The orbit controls enforce these limits for the wheel, pinch and every other way of dollying.
    controls.minDistance = CAMERA.minDistance;
    controls.maxDistance = CAMERA.maxDistance;

    this.slider.step = String(ZOOM.sliderStep);
    this.slider.oninput = () => this.setDistance(this.distanceFromSlider(Number(this.slider.value)));
    this.zoomIn.onclick = () => this.setDistance(this.distance / ZOOM.buttonFactor);
    this.zoomOut.onclick = () => this.setDistance(this.distance * ZOOM.buttonFactor);
    // Do not keep keyboard focus: the arrow keys belong to the game (driving) once the mouse is released.
    for (const el of [this.slider, this.zoomIn, this.zoomOut]) el.addEventListener('pointerup', () => el.blur());

    // Fires for the mouse wheel, pinch, damping and the camera following the car.
    controls.addEventListener('change', () => this.sync());
    this.sync();
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  /** Refreshes the slider and label from the current camera distance. Safe to call at any time. */
  sync(): void {
    const distance = this.distance;
    const label = TEXT.hud.zoom(this.referenceDistance / distance);
    if (label !== this.lastLabel) {
      this.lastLabel = label;
      this.label.textContent = label;
    }
    // While the slider is being dragged it already holds the value; rewriting it would fight the thumb.
    if (document.activeElement !== this.slider) this.slider.value = String(this.sliderFromDistance(distance));
  }

  private get distance(): number {
    return this.camera.position.distanceTo(this.controls.target);
  }

  /** Moves the camera along its line of sight to `distance` from the target (clamped to the limits). */
  private setDistance(distance: number): void {
    const clamped = THREE.MathUtils.clamp(distance, CAMERA.minDistance, CAMERA.maxDistance);
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(direction, clamped);
    this.controls.update();
    this.sync();
  }

  /** 0 = farthest, 1 = closest; logarithmic so each slider step is the same zoom ratio. */
  private sliderFromDistance(distance: number): number {
    const t = Math.log(CAMERA.maxDistance / distance) / Math.log(CAMERA.maxDistance / CAMERA.minDistance);
    return THREE.MathUtils.clamp(t, 0, 1);
  }

  private distanceFromSlider(t: number): number {
    return CAMERA.maxDistance * Math.pow(CAMERA.minDistance / CAMERA.maxDistance, t);
  }
}
