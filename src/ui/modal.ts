export interface ModalOptions {
  /** Extra class(es) of the `.dialog` element (e.g. `help`, `catalog`). */
  className: string;
  /** Extra class(es) of the dimmed `.dialog-backdrop`. */
  backdropClass?: string;
  /** Id of the element that titles the dialog (for `aria-labelledby`). */
  labelledBy: string;
  /** `KeyboardEvent.code`s (besides Escape) that close the modal, e.g. the key that opens it. */
  closeCodes?: string[];
  /** Fills the dialog and returns the element that gets the initial focus. `close` closes the modal. */
  build(dialog: HTMLElement, close: () => void): HTMLElement;
  /** Extra keyboard handling. Return true when the key was handled (its default action is then prevented). */
  onKeyDown?(e: KeyboardEvent): boolean;
  onClose?(): void;
}

let current: (() => void) | null = null;

export const isModalOpen = (): boolean => current !== null;

export function closeModal(): void {
  current?.();
}

/**
 * Generic modal dialog used by the help and the parts catalog. It provides the backdrop (a click on it closes the
 * modal), `Esc`, focus trapping (Tab cycles through the focusable elements inside), focus restoration, and it
 * swallows every other key press (capture phase + `stopPropagation`) so the game under it does not react. Browser
 * shortcuts are not prevented. Only one modal is open at a time: opening another closes the current one.
 */
export function openModal(options: ModalOptions): void {
  closeModal();
  const previousFocus = document.activeElement as HTMLElement | null;

  const backdrop = document.createElement('div');
  backdrop.className = `dialog-backdrop ${options.backdropClass ?? ''}`.trim();
  const dialog = document.createElement('div');
  dialog.className = `dialog ${options.className}`;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', options.labelledBy);
  backdrop.append(dialog);

  const finish = () => {
    document.removeEventListener('keydown', onKeyDown, true);
    backdrop.remove();
    current = null;
    options.onClose?.();
    if (previousFocus?.isConnected) previousFocus.focus();
  };

  const focusable = (): HTMLElement[] =>
    [...dialog.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]')].filter(
      (el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && !el.closest('[hidden]'),
    );

  const onKeyDown = (e: KeyboardEvent) => {
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    const typing = e.target instanceof HTMLInputElement && e.target.type === 'search'; // a key typed into a search field is text
    if (e.key === 'Escape' || (plain && !typing && options.closeCodes?.includes(e.code))) {
      e.preventDefault();
      finish();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const items = focusable();
      if (items.length > 0) {
        const index = items.indexOf(document.activeElement as HTMLElement);
        const step = e.shiftKey ? -1 : 1;
        items[(index + step + items.length) % items.length].focus();
      }
    } else if (options.onKeyDown?.(e)) {
      e.preventDefault();
    }
    // Everything else must not reach the game under the modal.
    e.stopPropagation();
  };

  backdrop.onclick = (e) => {
    if (e.target === backdrop) finish();
  };

  current = finish;
  const initialFocus = options.build(dialog, finish);
  document.addEventListener('keydown', onKeyDown, true);
  document.body.append(backdrop);
  initialFocus.focus();
}
