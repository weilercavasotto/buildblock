import { sound } from '../audio/sound';
import { Grid } from './grid';
import { HISTORY } from '../constants';
import { Part } from '../types';

/** State of the grid taken before an edit, used to decide whether the edit changed anything. */
export interface Checkpoint {
  parts: Part[];
  mutations: number;
}

/**
 * Undo/redo for grid edits. Each user action (a click, a removal, a whole paint stroke, Clear) is ONE step:
 * take a `begin()` checkpoint before the edit and `commit()` it afterwards (or wrap the edit in `run()`).
 * Steps are snapshots of the grid, which is small; parts are never mutated after creation, so the snapshots
 * can share the part objects.
 */
export class History {
  private undoStack: Part[][] = [];
  private redoStack: Part[][] = [];
  private mutations = 0;
  private listeners: Array<() => void> = [];

  constructor(private grid: Grid) {
    grid.subscribe(() => this.mutations++);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  subscribe(fn: () => void): void {
    this.listeners.push(fn);
  }

  begin(): Checkpoint {
    return { parts: this.grid.all(), mutations: this.mutations };
  }

  /** Records the edit made since `checkpoint` as one undo step (does nothing if the grid did not change). */
  commit(checkpoint: Checkpoint): void {
    if (checkpoint.mutations === this.mutations) return;
    this.undoStack.push(checkpoint.parts);
    if (this.undoStack.length > HISTORY.maxSteps) this.undoStack.shift();
    this.redoStack = [];
    this.notify();
  }

  /** Runs `edit` as a single undo step. */
  run(edit: () => void): void {
    const checkpoint = this.begin();
    edit();
    this.commit(checkpoint);
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(this.grid.all());
    this.grid.load(previous);
    sound.play('undo');
    this.notify();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.grid.all());
    this.grid.load(next);
    sound.play('redo');
    this.notify();
  }

  /** Forgets all steps (a different creation was loaded). */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}
