import { HELP_TABS, HelpRow, TEXT } from '../constants';

let close: (() => void) | null = null;
let lastTab = 0;

export const isHelpOpen = (): boolean => close !== null;

/** Opens the help dialog, or closes it when it is already open. */
export function toggleHelpDialog(): void {
  if (close) close();
  else openHelpDialog();
}

/**
 * Modal help with one tab per topic (content in `HELP_TABS`). Keyboard: Esc or H close it, Tab cycles through the
 * dialog, Left/Right/Home/End move between tabs. While it is open it swallows every key press so the game under it
 * does not react (no tool switching, undo or driving). Clicking the backdrop closes it. Focus returns to the previously
 * focused element, and the last tab is remembered. All text is set with `textContent`.
 */
export function openHelpDialog(): void {
  if (close) return;
  const previousFocus = document.activeElement as HTMLElement | null;

  const backdrop = div('dialog-backdrop');
  const dialog = div('dialog help');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'help-title');

  const header = div('help-header');
  const title = document.createElement('h2');
  title.className = 'dialog-title';
  title.id = 'help-title';
  title.textContent = TEXT.hud.help.title;
  const closeButton = button('help-close', '×');
  closeButton.setAttribute('aria-label', TEXT.hud.help.close);
  closeButton.title = `${TEXT.hud.help.close} (Esc)`;
  header.append(title, closeButton);

  const tabList = div('help-tabs');
  tabList.setAttribute('role', 'tablist');
  const panel = div('help-panel');
  panel.setAttribute('role', 'tabpanel');
  panel.tabIndex = 0; // keyboard users can scroll long content

  const tabs = HELP_TABS.map((tab, index) => {
    const el = button('help-tab', tab.title);
    el.id = `help-tab-${tab.id}`;
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-controls', 'help-panel');
    tabList.append(el);
    el.onclick = () => select(index);
    return el;
  });
  panel.id = 'help-panel';

  const select = (index: number, focus = false) => {
    lastTab = index;
    tabs.forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === index));
      el.tabIndex = i === index ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tabs[index].id);
    panel.replaceChildren(...renderTab(index));
    panel.scrollTop = 0;
    if (focus) tabs[index].focus();
  };

  dialog.append(header, tabList, panel);
  backdrop.append(dialog);

  const finish = () => {
    document.removeEventListener('keydown', onKeyDown, true);
    backdrop.remove();
    close = null;
    if (previousFocus?.isConnected) previousFocus.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button, [tabindex="0"]')].filter((el) => el.tabIndex >= 0);
    if (e.key === 'Escape' || (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
      e.preventDefault();
      finish();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const step = e.shiftKey ? -1 : 1;
      focusable[(index + step + focusable.length) % focusable.length].focus();
    } else if (tabs.includes(document.activeElement as HTMLButtonElement) && isTabKey(e.key)) {
      e.preventDefault();
      const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
      const last = tabs.length - 1;
      const next =
        e.key === 'Home' ? 0 : e.key === 'End' ? last : e.key === 'ArrowRight' ? (current + 1) % tabs.length : (current + last) % tabs.length;
      select(next, true);
    }
    // Everything else must not reach the game under the dialog; browser shortcuts (F5, Ctrl+R, ...) are not prevented.
    e.stopPropagation();
  };

  closeButton.onclick = finish;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) finish();
  };

  close = finish;
  document.addEventListener('keydown', onKeyDown, true);
  document.body.append(backdrop);
  select(lastTab);
  tabs[lastTab].focus();
}

const isTabKey = (key: string): boolean => ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key);

function renderTab(index: number): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  for (const section of HELP_TABS[index].sections) {
    const heading = document.createElement('h3');
    heading.className = 'help-heading';
    heading.textContent = section.heading;
    nodes.push(heading, ...section.rows.map(renderRow));
  }
  return nodes;
}

function renderRow(row: HelpRow): HTMLElement {
  const el = div(row.keys ? 'help-row' : 'help-row help-note');
  if (row.keys) {
    const keys = div('help-keys');
    row.keys.forEach((key, i) => {
      if (i > 0) keys.append(span('help-or', TEXT.hud.help.or));
      const cap = document.createElement('kbd');
      cap.textContent = key;
      keys.append(cap);
    });
    el.append(keys);
  }
  el.append(span('help-text', row.text));
  return el;
}

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function button(className: string, label: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  return el;
}
