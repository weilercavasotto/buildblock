import { TEXT, keyLabel, keyProblem } from '../constants';

/**
 * Waits for the player to press the key they want for a part (the key sections of the inspector). The next key press is taken before
 * the game sees it (so the editing shortcuts do not fire): a valid key goes to `onKey`, Backspace / Delete clears the key (`onKey(null)`),
 * Esc cancels, and a key the game keeps for itself (`RESERVED_KEYS`) is refused with a message through `onProblem` while the wait goes on.
 * Returns a function that stops waiting. Keys with Ctrl / Cmd / Alt are left to the browser.
 */
export function captureKey(onKey: (code: string | null) => void, onProblem: (message: string) => void, onDone: () => void): () => void {
  const stop = () => {
    document.removeEventListener('keydown', onKeyDown, true);
    onDone();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    if (e.code === 'Escape') return stop();
    if (e.code === 'Backspace' || e.code === 'Delete') {
      stop();
      return onKey(null);
    }
    const problem = keyProblem(e.code);
    if (problem === 'reserved') return onProblem(TEXT.keys.reserved(keyLabel(e.code)));
    if (problem) return onProblem(TEXT.keys.unsupported);
    stop();
    onKey(e.code);
  };
  document.addEventListener('keydown', onKeyDown, true);
  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
  };
}
