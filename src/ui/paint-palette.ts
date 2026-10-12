import { PAINT_COLORS, TEXT } from '../constants';

/**
 * Colour picker shown under the top bar while the paint cursor mode is active. The first swatch is the default colour:
 * painting with it removes the paint. Painting itself is done by `BuildMode`, which is told the chosen colour.
 */
export class PaintPalette {
  private root = document.getElementById('paint-palette')!;
  private buttons: HTMLButtonElement[] = [];
  private index = 1;

  constructor(private onChange: (color: string | null) => void) {
    this.root.setAttribute('aria-label', TEXT.paint.group);
    PAINT_COLORS.forEach(({ name, hex }, i) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'paint-swatch';
      swatch.title = name;
      swatch.setAttribute('aria-label', name);
      swatch.style.background = hex;
      swatch.onclick = () => this.select(i);
      this.buttons.push(swatch);
      this.root.append(swatch);
    });
    this.select(this.index);
  }

  /** The colour to paint with, or null for the default colour (removes the paint). */
  get color(): string | null {
    return this.index === 0 ? null : PAINT_COLORS[this.index].hex;
  }

  show(visible: boolean): void {
    this.root.hidden = !visible;
  }

  private select(index: number): void {
    this.index = index;
    this.buttons.forEach((b, i) => {
      b.classList.toggle('selected', i === index);
      b.setAttribute('aria-pressed', String(i === index));
    });
    this.onChange(this.color);
  }
}
