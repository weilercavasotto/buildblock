import { FPS_COUNTER, TEXT } from '../constants';

/** Small frames-per-second readout. Call `frame()` once per rendered frame. */
export class FpsCounter {
  private el = document.getElementById('fps')!;
  private frames = 0;
  private windowStart = 0;
  private warmedUp = false;

  /** `elapsedSeconds` is the total running time (e.g. `timer.getElapsed()`). */
  frame(elapsedSeconds: number): void {
    this.frames++;
    const span = elapsedSeconds - this.windowStart;
    if (span < FPS_COUNTER.updateInterval) return;

    // The first window includes shader compilation and asset loading, so it is not a real reading.
    if (!this.warmedUp) {
      this.warmedUp = true;
      this.frames = 0;
      this.windowStart = elapsedSeconds;
      return;
    }

    const fps = Math.round(this.frames / span);
    this.el.textContent = TEXT.hud.fps(fps);
    this.el.className = fps >= FPS_COUNTER.goodFps ? 'good' : fps >= FPS_COUNTER.okFps ? 'ok' : 'bad';
    this.frames = 0;
    this.windowStart = elapsedSeconds;
  }

  toggle(): void {
    this.el.hidden = !this.el.hidden;
  }
}
