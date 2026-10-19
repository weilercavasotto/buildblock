import { SETTINGS_PANEL, SettingRow, TEXT } from '../constants';
import { sound } from '../audio/sound';
import { settings } from '../settings';
import { closeModal, openModal } from './modal';

let open = false;
/** Refreshes the mute switch of the open panel (null while it is closed). */
let refreshMute: (() => void) | null = null;
sound.onMuteChange(() => refreshMute?.());

export const isSettingsOpen = (): boolean => open;

/** Opens the settings panel, or closes it when it is already open. */
export function toggleSettingsDialog(): void {
  if (open) closeModal();
  else openSettingsDialog();
}

/**
 * The settings panel (the gear button): sound (the mute switch and three volume sliders), the display (FPS counter, the controls
 * panel) and the graphics (shadows, particles), from `SETTINGS_PANEL`. A change applies at once and is saved (see `settings.ts`).
 * `Esc` closes it (the shared modal behaviour of `openModal`). All text is set with `textContent`.
 */
export function openSettingsDialog(): void {
  if (open) return;
  openModal({
    className: 'settings',
    labelledBy: 'settings-title',
    onClose: () => {
      open = false;
      refreshMute = null;
    },
    build: (dialog, close) => {
      const header = el('div', 'help-header');
      const title = el('h2', 'dialog-title', TEXT.settings.title);
      title.id = 'settings-title';
      const closeButton = el('button', 'help-close', '×') as HTMLButtonElement;
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', TEXT.settings.close);
      closeButton.title = `${TEXT.settings.close} (Esc)`;
      closeButton.onclick = close;
      header.append(title, closeButton);

      const body = el('div', 'settings-body');
      let first: HTMLElement = closeButton;
      for (const section of SETTINGS_PANEL) {
        body.append(el('h3', 'help-heading', section.heading));
        for (const row of section.rows) {
          const { node, control } = renderRow(row);
          body.append(node);
          if (first === closeButton) first = control;
        }
      }
      dialog.append(header, body);
      open = true;
      return first;
    },
  });
}

function renderRow(row: SettingRow): { node: HTMLElement; control: HTMLElement } {
  const node = el('div', 'setting-row');
  const label = el('div', 'setting-label');
  label.append(el('span', 'setting-name', row.label));
  if (row.hint) label.append(el('span', 'setting-hint', row.hint));
  const control = row.kind === 'slider' ? slider(row) : switchButton(row);
  node.append(label, control);
  return { node, control: control.querySelector('input, button') ?? control };
}

/** An on / off switch (a button with `role="switch"`): a setting of the game, or the sound engine's mute (on = sound on). */
function switchButton(row: SettingRow): HTMLElement {
  const button = el('button', 'switch') as HTMLButtonElement;
  button.type = 'button';
  button.setAttribute('role', 'switch');
  button.setAttribute('aria-label', row.label);
  button.append(el('span', 'switch-knob'));
  const show = () => button.setAttribute('aria-checked', String(row.kind === 'mute' ? !sound.muted : Boolean(settings.get(row.key!))));
  button.onclick = () => {
    if (row.kind === 'mute') sound.toggleMuted();
    else settings.set(row.key!, !settings.get(row.key!) as never);
    show();
  };
  if (row.kind === 'mute') refreshMute = show;
  show();
  return button;
}

/** A volume slider, 0-100%, with its value beside it. */
function slider(row: SettingRow): HTMLElement {
  const wrap = el('div', 'setting-slider');
  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'slider-input';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  input.setAttribute('aria-label', row.label);
  const value = el('span', 'slider-value');
  const show = () => {
    const percent = Math.round(Number(settings.get(row.key!)) * 100);
    input.value = String(percent);
    value.textContent = `${percent}%`;
    input.style.setProperty('--fill', String(percent / 100));
  };
  input.oninput = () => {
    settings.set(row.key!, (Number(input.value) / 100) as never);
    show();
  };
  show();
  wrap.append(input, value);
  return wrap;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
