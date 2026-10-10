import { FRAME_LIMIT } from './constants';

/**
 * Caps rendering at `FRAME_LIMIT.targetFps`. `requestAnimationFrame` fires at the display refresh rate
 * (e.g. 75 or 144 Hz), so on every callback ask `shouldRender(now)` and skip the frame when it says false.
 *
 * Frames are scheduled on a fixed timeline (`next += interval`) rather than "at least one interval since the last
 * frame", so the average stays at the target even when the refresh rate is not a multiple of it (75 Hz renders
 * 4 of every 5 callbacks = 60 FPS, instead of dropping to 37.5).
 */
export class FrameLimiter {
  private next = 0;
  private interval = 1000 / FRAME_LIMIT.targetFps;

  /** `nowMs` is the timestamp `requestAnimationFrame` / `setAnimationLoop` passes to the callback. */
  shouldRender(nowMs: number): boolean {
    if (nowMs < this.next - FRAME_LIMIT.toleranceMs) return false;
    // More than a frame behind (first frame, hidden tab, long stall): restart the timeline instead of catching up.
    this.next = nowMs - this.next > this.interval ? nowMs + this.interval : this.next + this.interval;
    return true;
  }
}
