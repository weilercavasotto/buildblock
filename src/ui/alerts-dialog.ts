import { PART_INFO, TEXT, lacksKey } from '../constants';
import { Grid } from '../build/grid';
import { Part } from '../types';
import { openModal } from './modal';

/** The parts that need a key and have none (what the bell counts), most recently listed first by kind. */
export const partsWithoutKey = (grid: Grid): Part[] => grid.all().filter(lacksKey);

/**
 * The alerts panel (the bell button): the mobility parts of the creation that need a key and have none, grouped by kind. With
 * `onSelect` each row is a button that closes the panel and takes the player to that part (inspect mode, camera flies to it); while
 * playing there is no `onSelect` and the rows only list. `Esc` closes it (the shared modal behaviour of `openModal`). All text is set
 * with `textContent`.
 */
export function openAlertsDialog(grid: Grid, onSelect: ((part: Part) => void) | null): void {
  openModal({
    className: 'alerts',
    labelledBy: 'alerts-title',
    build: (dialog, close) => {
      const header = el('div', 'help-header');
      const title = el('h2', 'dialog-title', TEXT.alerts.title);
      title.id = 'alerts-title';
      const closeButton = el('button', 'help-close', '×') as HTMLButtonElement;
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', TEXT.alerts.close);
      closeButton.title = `${TEXT.alerts.close} (Esc)`;
      closeButton.onclick = close;
      header.append(title, closeButton);

      const body = el('div', 'alerts-body');
      const missing = partsWithoutKey(grid);
      let first: HTMLElement = closeButton;
      if (missing.length === 0) {
        body.append(el('p', '', TEXT.alerts.allGood));
      } else {
        body.append(el('p', '', TEXT.alerts.intro(missing.length)), el('p', '', onSelect ? TEXT.alerts.how : ''));
        const byType = new Map<string, Part[]>();
        for (const part of missing) byType.set(part.type, [...(byType.get(part.type) ?? []), part]);
        for (const [type, parts] of byType) {
          const info = PART_INFO[type as keyof typeof PART_INFO];
          body.append(el('h3', 'help-heading', `${info.name} (${parts.length})`));
          for (const part of parts) {
            const row = el(onSelect ? 'button' : 'div', 'alert-row');
            if (row instanceof HTMLButtonElement) row.type = 'button';
            row.append(el('span', '', info.name), el('span', '', TEXT.alerts.atCell(part.cell.join(', '))));
            if (onSelect) {
              row.onclick = () => {
                close();
                onSelect(part);
              };
              if (first === closeButton) first = row;
            }
            body.append(row);
          }
        }
      }
      dialog.append(header, body);
      return first;
    },
  });
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
