import { HELP_TABS, HelpRow, TEXT } from '../constants';
import { closeModal, openModal } from './modal';

let open = false;
let lastTab = 0;

export const isHelpOpen = (): boolean => open;

/** Opens the help dialog, or closes it when it is already open. */
export function toggleHelpDialog(): void {
  if (open) closeModal();
  else openHelpDialog();
}

/**
 * Help with one tab per topic (content in `HELP_TABS`). `Esc` or `H` close it, Tab cycles inside it and
 * Left/Right/Home/End move between tabs (see `openModal` for the shared modal behaviour). The last tab is remembered.
 * All text is set with `textContent`.
 */
export function openHelpDialog(): void {
  if (open) return;
  let tabs: HTMLButtonElement[] = [];

  const select = (panel: HTMLElement, index: number, focus = false) => {
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

  openModal({
    className: 'help',
    labelledBy: 'help-title',
    closeCodes: ['KeyH'],
    onClose: () => (open = false),
    onKeyDown: (e) => {
      const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
      if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return false;
      const last = tabs.length - 1;
      const next =
        e.key === 'Home' ? 0 : e.key === 'End' ? last : e.key === 'ArrowRight' ? (current + 1) % tabs.length : (current + last) % tabs.length;
      select(document.getElementById('help-panel')!, next, true);
      return true;
    },
    build: (dialog, close) => {
      const header = div('help-header');
      const title = document.createElement('h2');
      title.className = 'dialog-title';
      title.id = 'help-title';
      title.textContent = TEXT.hud.help.title;
      const closeButton = button('help-close', '×');
      closeButton.setAttribute('aria-label', TEXT.hud.help.close);
      closeButton.title = `${TEXT.hud.help.close} (Esc)`;
      closeButton.onclick = close;
      header.append(title, closeButton);

      const tabList = div('help-tabs');
      tabList.setAttribute('role', 'tablist');
      const panel = div('help-panel');
      panel.id = 'help-panel';
      panel.setAttribute('role', 'tabpanel');
      panel.tabIndex = 0; // keyboard users can scroll long content

      tabs = HELP_TABS.map((tab, index) => {
        const el = button('help-tab', tab.title);
        el.id = `help-tab-${tab.id}`;
        el.setAttribute('role', 'tab');
        el.setAttribute('aria-controls', 'help-panel');
        el.onclick = () => select(panel, index);
        tabList.append(el);
        return el;
      });

      dialog.append(header, tabList, panel);
      open = true;
      select(panel, lastTab);
      return tabs[lastTab];
    },
  });
}

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
