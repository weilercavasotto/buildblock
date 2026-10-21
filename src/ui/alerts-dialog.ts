import { PART_INFO, TEXT, lacksKey, missingActions, unassignedOptional } from '../constants';
import { Grid } from '../build/grid';
import { Part } from '../types';
import { openModal } from './modal';

/** The parts that need a key and have none (the first list of the panel). */
export const partsWithoutKey = (grid: Grid): Part[] => grid.all().filter(lacksKey);

/** The parts with any action, required or optional, that has no key yet: what the bell counts. */
export const partsToCheck = (grid: Grid): Part[] => grid.all().filter((p) => lacksKey(p) || unassignedOptional(p).length > 0);

/**
 * The alerts panel (the bell button): the mobility parts of the creation that need a key and have none, grouped by kind, and then the
 * optional keys that are still empty (the bell counts the parts of both lists). With
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
      let first: HTMLElement = closeButton;
      /** The parts in `parts` by kind, one row each with what `actions(part)` says is left; the first clickable row gets the focus. */
      const list = (parts: Part[], actions: (part: Part) => string[]) => {
        const byType = new Map<string, Part[]>();
        for (const part of parts) byType.set(part.type, [...(byType.get(part.type) ?? []), part]);
        for (const [type, members] of byType) {
          const info = PART_INFO[type as keyof typeof PART_INFO];
          body.append(el('h3', 'help-heading', `${info.name} (${members.length})`));
          for (const part of members) {
            const row = el(onSelect ? 'button' : 'div', 'alert-row');
            if (row instanceof HTMLButtonElement) row.type = 'button';
            row.append(el('span', '', `${info.name} ${TEXT.alerts.atCell(part.cell.join(', '))}`), el('span', '', TEXT.alerts.missing(actions(part).join(', '))));
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
      };

      const missing = partsWithoutKey(grid);
      if (missing.length === 0) body.append(el('p', '', TEXT.alerts.allGood));
      else {
        body.append(el('p', '', TEXT.alerts.intro(missing.length)));
        list(missing, (part) => missingActions(part).map((a) => a.label));
      }
      // The optional actions (a wheel's steering and brake, an engine's reverse) work without a key; they are listed so none is forgotten.
      const optional = grid.all().filter((p) => unassignedOptional(p).length > 0);
      if (optional.length > 0) {
        body.append(el('h2', 'alerts-section', TEXT.alerts.optionalTitle), el('p', '', TEXT.alerts.optionalIntro));
        list(optional, (part) => unassignedOptional(part).map((a) => a.label));
      }
      if (onSelect && (missing.length > 0 || optional.length > 0)) body.append(el('p', '', TEXT.alerts.how));
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
