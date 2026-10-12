import { LOADING, MOTION, TEXT } from '../constants';

/** One unit of work done behind the loading screen; `label` is shown while it runs. */
export interface LoadingStep {
  label: string;
  run(): void | Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** Resolves once the browser has had a chance to paint (with a timeout, as hidden tabs pause animation frames). */
const nextPaint = () => Promise.race([new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0))), wait(LOADING.paintTimeoutMs)]);

/**
 * Full-screen overlay (mark + name + progress bar + status text) for moments when the scene is swapped. It covers the
 * page and blocks input while visible. Use `run(steps)` to do the work in labelled steps, or `show` / `setProgress` /
 * `hide` when the steps are driven elsewhere. The overlay stays up at least `LOADING.minDurationMs`, so it never flashes.
 */
export class LoadingScreen {
  private root = document.getElementById('loading')!;
  private fill = document.getElementById('loading-fill')!;
  private label = document.getElementById('loading-label')!;
  private shownAt = 0;
  /** Serialises overlapping `run` calls: the next one starts when the previous overlay is gone. */
  private queue: Promise<void> = Promise.resolve();

  show(label: string = TEXT.loading.default): void {
    this.root.classList.remove('closing');
    this.root.hidden = false;
    this.shownAt = performance.now();
    this.setProgress(0, label);
  }

  /** `fraction` is 0-1. */
  setProgress(fraction: number, label?: string): void {
    const clamped = Math.min(1, Math.max(0, fraction));
    this.fill.style.width = `${Math.round(clamped * 100)}%`;
    this.root.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    if (label !== undefined) this.label.textContent = label;
  }

  /** Completes the bar, waits out the minimum display time and fades the overlay away. */
  async hide(): Promise<void> {
    this.setProgress(1);
    await wait(Math.max(0, LOADING.minDurationMs - (performance.now() - this.shownAt)));
    this.root.classList.add('closing');
    await wait(MOTION.loadingFade);
    this.root.hidden = true;
    this.root.classList.remove('closing');
  }

  /** Shows the overlay, runs the steps in order (the bar advances after each) and hides it. */
  run(steps: LoadingStep[]): Promise<void> {
    const job = this.queue.then(async () => {
      this.show(steps[0]?.label);
      try {
        for (const [i, step] of steps.entries()) {
          this.setProgress(i / steps.length, step.label);
          await nextPaint(); // let the new label / bar reach the screen before the (possibly heavy) step blocks the thread
          await step.run();
        }
      } finally {
        await this.hide();
      }
    });
    this.queue = job.catch(() => {});
    return job;
  }
}
