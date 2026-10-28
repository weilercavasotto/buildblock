import { SIZE, TEXT, TUTORIAL_STEPS, TutorialStep } from '../constants';

/** The side of the highlighted part where the arrow and the card go. */
type Side = 'below' | 'above' | 'right' | 'left';

let active = false;

/** Is the tutorial on screen? (the game's shortcuts must wait) */
export const isTutorialOpen = (): boolean => active;

const SVG = 'http://www.w3.org/2000/svg';

/** An arrow pointing up (it is turned to point at the highlighted part); drawn with strokes so it takes the colour of the text. */
function arrowIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '3');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M12 21V4M5 11l7-7 7 7');
  svg.append(path);
  return svg;
}

const isShown = (el: Element | null): el is HTMLElement => !!el && el.getClientRects().length > 0 && !el.closest('[hidden]');

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, Math.max(min, max)));

/**
 * The tutorial: the screen is dimmed, one part of it (the step's `target`) is lit by a pulsing highlight, a blinking arrow points at it and a
 * card says what it is for; Next and Back (or the arrow keys) move along the steps (`TUTORIAL_STEPS`), Skip or Esc ends it. A step without a
 * target is a card in the middle of the screen, and a step whose target is not on screen is skipped. It covers the game while it is open
 * (clicks and keys do not reach it). All text is set with `textContent`. Styles: `#tutorial` in src/styles/main.css.
 */
export function startTutorial(steps: ReadonlyArray<TutorialStep> = TUTORIAL_STEPS): void {
  if (active) return;
  active = true;
  const previousFocus = document.activeElement as HTMLElement | null;
  const t = TEXT.onboarding.tutorial;

  const root = document.createElement('div');
  root.id = 'tutorial';
  const spot = document.createElement('div');
  spot.className = 'tutorial-spot';
  const arrow = document.createElement('div');
  arrow.className = 'tutorial-arrow';
  const icon = arrowIcon();
  arrow.append(icon);
  const card = document.createElement('div');
  card.className = 'tutorial-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', t.label);
  const title = document.createElement('h3');
  title.className = 'tutorial-title';
  const body = document.createElement('p');
  body.className = 'tutorial-text';
  const footer = document.createElement('div');
  footer.className = 'tutorial-footer';
  const counter = document.createElement('span');
  counter.className = 'tutorial-counter';
  const skip = button(t.skip, 'dialog-button');
  const back = button(t.back, 'dialog-button');
  const next = button(t.next, 'dialog-button primary');
  footer.append(counter, skip, back, next);
  card.append(title, body, footer);
  root.append(spot, arrow, card);
  document.body.append(root);

  let index = -1;

  /** The index of the first step from `from` (going `dir`) whose target is on screen (a step without a target always is), or -1. */
  const reachable = (from: number, dir: 1 | -1): number => {
    for (let i = from; i >= 0 && i < steps.length; i += dir) {
      if (!steps[i].target || isShown(document.querySelector(steps[i].target!))) return i;
    }
    return -1;
  };

  const finish = () => {
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('resize', onResize);
    root.remove();
    active = false;
    if (previousFocus?.isConnected) previousFocus.focus();
  };

  /** Shows the step at `i` (already known to be reachable): its text, the highlight, the arrow and the card. */
  const show = (i: number) => {
    index = i;
    const step = steps[i];
    title.textContent = step.title;
    body.textContent = step.text;
    const position = steps.slice(0, i + 1).filter((_, k) => reachable(k, 1) === k).length;
    const total = steps.filter((_, k) => reachable(k, 1) === k).length;
    counter.textContent = t.step(position, total);
    const last = reachable(i + 1, 1) === -1;
    next.textContent = last ? t.finish : t.next;
    back.hidden = reachable(i - 1, -1) === -1;
    place(step);
  };

  const place = (step: TutorialStep) => {
    const target = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    const margin = SIZE.tutorialMargin;
    const cardWidth = Math.min(SIZE.tutorialCardWidth, window.innerWidth - 2 * margin);
    card.style.width = `${cardWidth}px`;
    const cardHeight = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!target) {
      // A note: the card in the middle, no highlight, no arrow.
      root.classList.add('centred');
      card.style.left = `${(vw - cardWidth) / 2}px`;
      card.style.top = `${(vh - cardHeight) / 2}px`;
      return;
    }
    root.classList.remove('centred');
    const r = target.getBoundingClientRect();
    const pad = SIZE.tutorialPad;
    spot.style.left = `${r.left - pad}px`;
    spot.style.top = `${r.top - pad}px`;
    spot.style.width = `${r.width + 2 * pad}px`;
    spot.style.height = `${r.height + 2 * pad}px`;

    const gap = SIZE.tutorialGap;
    const size = SIZE.tutorialArrow;
    // The side with the most room for the arrow and the card.
    const room: Record<Side, number> = {
      below: vh - r.bottom - pad - (size + 2 * gap + cardHeight),
      above: r.top - pad - (size + 2 * gap + cardHeight),
      right: vw - r.right - pad - (size + 2 * gap + cardWidth),
      left: r.left - pad - (size + 2 * gap + cardWidth),
    };
    const order: Side[] = ['below', 'above', 'right', 'left'];
    const side = order.find((s) => room[s] >= 0) ?? order.reduce((a, b) => (room[b] > room[a] ? b : a));
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let ax = 0;
    let ay = 0;
    let cardLeft = 0;
    let cardTop = 0;
    let turn = 0; // the arrow is drawn pointing up
    let bobX = '0px';
    let bobY = '0px';
    const bob = 'var(--size-tutorial-bob)';
    if (side === 'below') {
      ax = cx - size / 2;
      ay = r.bottom + pad + gap;
      cardLeft = cx - cardWidth / 2;
      cardTop = ay + size + gap;
      bobY = `calc(${bob} * -1)`;
    } else if (side === 'above') {
      ax = cx - size / 2;
      ay = r.top - pad - gap - size;
      cardLeft = cx - cardWidth / 2;
      cardTop = ay - gap - cardHeight;
      turn = 180;
      bobY = bob;
    } else if (side === 'right') {
      ax = r.right + pad + gap;
      ay = cy - size / 2;
      cardLeft = ax + size + gap;
      cardTop = cy - cardHeight / 2;
      turn = -90;
      bobX = `calc(${bob} * -1)`;
    } else {
      ax = r.left - pad - gap - size;
      ay = cy - size / 2;
      cardLeft = ax - gap - cardWidth;
      cardTop = cy - cardHeight / 2;
      turn = 90;
      bobX = bob;
    }
    arrow.style.left = `${ax}px`;
    arrow.style.top = `${ay}px`;
    arrow.style.setProperty('--bob-x', bobX);
    arrow.style.setProperty('--bob-y', bobY);
    icon.style.transform = `rotate(${turn}deg)`;
    card.style.left = `${clamp(cardLeft, margin, vw - cardWidth - margin)}px`;
    card.style.top = `${clamp(cardTop, margin, vh - cardHeight - margin)}px`;
  };

  const go = (dir: 1 | -1) => {
    const to = reachable(index + dir, dir);
    if (to === -1) {
      if (dir === 1) finish();
      return;
    }
    show(to);
  };

  const onResize = () => {
    if (index >= 0) place(steps[index]);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const items = [skip, back, next].filter((el) => !el.hidden);
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      items[(at + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
    // Enter and Space press the focused button; every other key must not reach the game under the tutorial.
    e.stopPropagation();
  };

  skip.onclick = finish;
  back.onclick = () => go(-1);
  next.onclick = () => go(1);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', onResize);

  const first = reachable(0, 1);
  if (first === -1) {
    finish();
    return;
  }
  show(first);
  next.focus();
}

function button(label: string, className: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  return el;
}
