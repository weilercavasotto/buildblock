export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Styles the confirm button as destructive and focuses "cancel" first, so Enter never deletes by accident. */
  danger?: boolean;
}

let close: ((confirmed: boolean) => void) | null = null;

/**
 * Modal confirmation dialog. Resolves `true` when confirmed, `false` when cancelled (cancel button, Escape or a
 * click on the backdrop). Keyboard focus stays inside the dialog (Tab cycles) and returns to the previously
 * focused element afterwards. Only one dialog is open at a time: opening a new one cancels the previous.
 * Styles: `.dialog-*` in src/styles/main.css. All text is set with `textContent`.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  close?.(false);

  return new Promise((resolve) => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const id = `dialog-${Date.now().toString(36)}`;

    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.setAttribute('aria-describedby', `${id}-message`);

    const title = document.createElement('h2');
    title.className = 'dialog-title';
    title.id = `${id}-title`;
    title.textContent = options.title;

    const message = document.createElement('p');
    message.className = 'dialog-message';
    message.id = `${id}-message`;
    message.textContent = options.message;

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    const cancel = makeButton(options.cancelLabel, 'dialog-button');
    const confirm = makeButton(options.confirmLabel, options.danger ? 'dialog-button danger' : 'dialog-button primary');
    actions.append(cancel, confirm);

    dialog.append(title, message, actions);
    backdrop.append(dialog);

    const finish = (confirmed: boolean) => {
      document.removeEventListener('keydown', onKeyDown, true);
      backdrop.remove();
      close = null;
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(confirmed);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      } else if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        e.preventDefault();
        e.stopPropagation();
        const order = [cancel, confirm];
        const index = order.indexOf(document.activeElement as HTMLButtonElement);
        const step = e.shiftKey ? -1 : 1;
        order[(index + step + order.length) % order.length].focus();
      }
    };

    cancel.onclick = () => finish(false);
    confirm.onclick = () => finish(true);
    backdrop.onclick = (e) => {
      if (e.target === backdrop) finish(false);
    };

    close = finish;
    document.addEventListener('keydown', onKeyDown, true);
    document.body.append(backdrop);
    (options.danger ? cancel : confirm).focus();
  });
}

function makeButton(label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  return button;
}
