import { PART_CATEGORIES, PART_INFO, PART_ORDER, PREVIEW, SIZE, TEXT } from '../constants';
import { PartType } from '../types';
import { enableDrag } from './drag-drop';
import { Hotbar } from './hotbar';
import { openModal } from './modal';
import { createPreviewCanvas, renderPartPreview, startSpin } from './part-preview';

let open = false;
let lastTab = 0;

export const isCatalogOpen = (): boolean => open;

/**
 * Parts catalog: a modal with one tab per category (plus "All"). Every card shows a 3D preview that spins while the
 * pointer is over it. Clicking a card opens the inspector on the right (big slowly-spinning preview, description,
 * properties and tips); dragging a card onto a hotbar slot (the hotbar is raised above the modal's backdrop) puts the
 * part there. A search field filters the cards by name, category and description (`/` focuses it). `Esc` or `C` close it, Tab cycles inside it, Left/Right/Home/End change tab.
 */
export function openCatalog(hotbar: Hotbar): void {
  if (open) return;

  const tabDefs = [{ id: 'all', title: TEXT.catalog.all }, ...PART_CATEGORIES];
  let tabs: HTMLButtonElement[] = [];
  let grid: HTMLElement;
  let inspector: HTMLElement;
  let search: HTMLInputElement;
  let query = '';
  let selected: PartType | null = null;
  let stopInspectorSpin: (() => void) | null = null;
  const stopCardSpins = new Set<() => void>();

  const closeAll = () => {
    stopInspectorSpin?.();
    stopCardSpins.forEach((stop) => stop());
  };

  const selectTab = (index: number, focus = false) => {
    lastTab = index;
    tabs.forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === index));
      el.tabIndex = i === index ? 0 : -1;
    });
    grid.setAttribute('aria-labelledby', tabs[index].id);
    const category = tabDefs[index].id;
    const inCategory = PART_ORDER.filter((type) => category === 'all' || PART_INFO[type].category === category);
    const parts = inCategory.filter(matchesQuery);
    stopCardSpins.forEach((stop) => stop());
    stopCardSpins.clear();
    const empty = inCategory.length === 0 ? TEXT.catalog.empty : TEXT.catalog.noResults(query.trim());
    grid.replaceChildren(...(parts.length ? parts.map(renderCard) : [text('p', 'catalog-empty', empty)]));
    if (focus) tabs[index].focus();
  };

  /** Every word of the search must appear in the part's name, category, tagline or description (case-insensitive). */
  const matchesQuery = (type: PartType): boolean => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const info = PART_INFO[type];
    const haystack = [info.name, categoryTitle(info.category), info.tagline, info.description].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  };

  const renderCard = (type: PartType): HTMLElement => {
    const info = PART_INFO[type];
    const card = el('button', 'catalog-card') as HTMLButtonElement;
    card.type = 'button';
    card.dataset.part = type;
    card.classList.toggle('selected', type === selected);
    const canvas = createPreviewCanvas(SIZE.catalogCardPreview);
    renderPartPreview(type, canvas);
    card.append(canvas, text('span', 'catalog-card-name', info.name), text('span', 'catalog-card-category', categoryTitle(info.category)));

    // The preview spins while the pointer (or keyboard focus) is on the card.
    let stop: (() => void) | null = null;
    const startHover = () => {
      if (stop) return;
      stop = startSpin(type, canvas, PREVIEW.hoverSpinSpeed, true);
      stopCardSpins.add(stop);
    };
    const endHover = () => {
      if (!stop) return;
      stop();
      stopCardSpins.delete(stop);
      stop = null;
    };
    card.addEventListener('pointerenter', startHover);
    card.addEventListener('pointerleave', endHover);
    card.addEventListener('focus', startHover);
    card.addEventListener('blur', endHover);

    enableDrag(card, {
      source: () => ({ type }),
      image: () => canvas,
      onClick: () => inspect(type),
      onDrop: (source, slot) => {
        if (slot !== null) hotbar.assign(slot, source.type);
      },
    });
    return card;
  };

  const inspect = (type: PartType) => {
    selected = type;
    grid.querySelectorAll('.catalog-card').forEach((card) => card.classList.toggle('selected', (card as HTMLElement).dataset.part === type));
    renderInspector();
  };

  const renderInspector = () => {
    stopInspectorSpin?.();
    stopInspectorSpin = null;
    inspector.hidden = selected === null;
    if (selected === null) return;
    const info = PART_INFO[selected];
    const type = selected;

    const canvas = createPreviewCanvas(SIZE.inspectorPreview);
    renderPartPreview(type, canvas);
    stopInspectorSpin = startSpin(type, canvas, PREVIEW.inspectSpinSpeed, false);

    const name = text('h3', 'inspector-name', info.name);
    name.id = 'inspector-name';
    const props = el('dl', 'inspector-props');
    for (const { label, value } of info.properties) props.append(text('dt', '', label), text('dd', '', value));
    const tips = el('ul', 'inspector-tips');
    for (const tip of info.tips) tips.append(text('li', '', tip));

    const slots = hotbar.slotOf(type).map((i) => i + 1);
    const status = text('p', 'inspector-status', slots.length ? TEXT.catalog.inHotbar(slots) : TEXT.catalog.notInHotbar);
    const action = el('button', 'catalog-action primary') as HTMLButtonElement;
    action.type = 'button';
    action.textContent = slots.length ? TEXT.catalog.selectInHotbar : TEXT.catalog.addToHotbar;
    action.onclick = () => {
      if (slots.length) hotbar.select(slots[0] - 1);
      else {
        const slot = hotbar.add(type);
        status.textContent = TEXT.catalog.added(slot + 1);
      }
    };

    inspector.replaceChildren(
      canvas,
      name,
      text('span', 'inspector-chip', `${TEXT.catalog.category}: ${categoryTitle(info.category)}`),
      text('p', 'inspector-tagline', info.tagline),
      text('p', 'inspector-description', info.description),
      text('h4', 'inspector-heading', TEXT.catalog.properties),
      props,
      text('h4', 'inspector-heading', TEXT.catalog.tips),
      tips,
      status,
      action,
    );
  };

  let unsubscribe = () => {};

  openModal({
    className: 'catalog',
    backdropClass: 'catalog-backdrop',
    labelledBy: 'catalog-title',
    closeCodes: ['KeyC'],
    onClose: () => {
      open = false;
      closeAll();
      unsubscribe();
      hotbar.setRaised(false);
    },
    onKeyDown: (e) => {
      if (e.key === '/' && document.activeElement !== search) {
        search.focus(); // jump to the search field
        return true;
      }
      const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
      if (current < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return false;
      const last = tabs.length - 1;
      const next =
        e.key === 'Home' ? 0 : e.key === 'End' ? last : e.key === 'ArrowRight' ? (current + 1) % tabs.length : (current + last) % tabs.length;
      selectTab(next, true);
      return true;
    },
    build: (dialog, close) => {
      const header = el('div', 'help-header');
      const title = text('h2', 'dialog-title', TEXT.catalog.title);
      title.id = 'catalog-title';
      const closeButton = text('button', 'help-close', '×') as HTMLButtonElement;
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', TEXT.catalog.close);
      closeButton.title = `${TEXT.catalog.close} (Esc)`;
      closeButton.onclick = close;
      header.append(title, closeButton);

      const tabList = el('div', 'help-tabs');
      tabList.setAttribute('role', 'tablist');
      tabs = tabDefs.map((tab, index) => {
        const button = text('button', 'help-tab', tab.title) as HTMLButtonElement;
        button.type = 'button';
        button.id = `catalog-tab-${tab.id}`;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', 'catalog-grid');
        button.onclick = () => selectTab(index);
        tabList.append(button);
        return button;
      });

      grid = el('div', 'catalog-grid');
      grid.id = 'catalog-grid';
      grid.setAttribute('role', 'tabpanel');
      inspector = el('aside', 'catalog-inspector');
      inspector.setAttribute('aria-labelledby', 'inspector-name');
      inspector.hidden = true;
      search = el('input', 'catalog-search') as HTMLInputElement;
      search.type = 'search';
      search.placeholder = TEXT.catalog.searchPlaceholder;
      search.setAttribute('aria-label', TEXT.catalog.search);
      search.autocomplete = 'off';
      search.spellcheck = false;
      search.oninput = () => {
        query = search.value;
        selectTab(lastTab);
      };
      const body = el('div', 'catalog-body');
      const main = el('div', 'catalog-main');
      main.append(search, text('p', 'catalog-hint', TEXT.catalog.dragHint), grid);
      body.append(main, inspector);

      dialog.append(header, tabList, body);
      open = true;
      hotbar.setRaised(true);
      // The hotbar changed (drop, swap, select...): refresh the inspector's "in hotbar" status.
      unsubscribe = hotbar.onLayoutChange(() => selected && renderInspector());
      selectTab(lastTab);
      return tabs[lastTab];
    },
  });
}

const categoryTitle = (id: string): string => PART_CATEGORIES.find((c) => c.id === id)?.title ?? id;

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function text(tag: string, className: string, content: string): HTMLElement {
  const node = el(tag, className);
  node.textContent = content;
  return node;
}
