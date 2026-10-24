import { Grid } from '../build/grid';
import { SAVE, SIZE } from '../constants';
import { SaveGame } from '../save';
import { createPreviewCanvas, renderCreationPreview } from './part-preview';

/** The picture of each save (a PNG data URL), kept for as long as the save is unchanged: a save is identified by its id and its last update. */
const cache = new Map<string, string>();

/**
 * A picture of the creation in a save, for the saved-games list: its parts cleaned the way loading does (`Grid.load`, old formats
 * converted) and drawn by the shared preview renderer (an empty save is just the floor).
 */
export function savePreviewUrl(save: SaveGame): string {
  const key = `${save.id}:${save.updatedAt}`;
  let url = cache.get(key);
  if (!url) {
    const grid = new Grid();
    grid.load(save.parts, save.format !== SAVE.format);
    const canvas = createPreviewCanvas(SIZE.savePreview);
    renderCreationPreview(grid.all(), canvas);
    url = canvas.toDataURL('image/png');
    cache.set(key, url);
  }
  return url;
}
