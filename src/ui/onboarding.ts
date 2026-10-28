import { STORAGE, TEXT } from '../constants';
import { openModal } from './modal';
import { startTutorial } from './tutorial';

/** Has the welcome dialog been shown before (in this browser)? */
function welcomed(): boolean {
  try {
    return localStorage.getItem(STORAGE.onboardingKey) !== null;
  } catch {
    return true; // no storage: do not welcome again and again
  }
}

function markWelcomed(): void {
  try {
    localStorage.setItem(STORAGE.onboardingKey, JSON.stringify({ welcomedAt: Date.now() }));
  } catch {
    /* storage unavailable or full */
  }
}

/**
 * The welcome of a player who has just entered a game for the first time (a new game or a loaded save): a dialog with a short greeting, a button that starts the tutorial
 * (`startTutorial`) and one that skips it. Shown once per browser, whichever game is entered first (it is remembered as soon as it opens). All text is set with `textContent`.
 */
export function offerOnboarding(): void {
  if (welcomed()) return;
  markWelcomed();
  const t = TEXT.onboarding.welcome;
  let startAfterClose = false;
  openModal({
    className: 'welcome',
    labelledBy: 'welcome-title',
    onClose: () => {
      if (startAfterClose) startTutorial();
    },
    build: (dialog, close) => {
      const title = document.createElement('h2');
      title.className = 'dialog-title';
      title.id = 'welcome-title';
      title.textContent = t.title;
      const message = document.createElement('p');
      message.className = 'dialog-message';
      message.textContent = t.message;
      const hint = document.createElement('p');
      hint.className = 'dialog-message';
      hint.textContent = t.hint;
      const actions = document.createElement('div');
      actions.className = 'dialog-actions';
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'dialog-button';
      skip.textContent = t.skip;
      skip.onclick = close;
      const start = document.createElement('button');
      start.type = 'button';
      start.className = 'dialog-button primary';
      start.textContent = t.start;
      start.onclick = () => {
        startAfterClose = true;
        close();
      };
      actions.append(skip, start);
      dialog.append(title, message, hint, actions);
      return start;
    },
  });
}
