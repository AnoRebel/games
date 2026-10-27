/** Board cell sizing shared by every grid board. */

/** Smallest board target in fit mode (px). */
export const MIN_CELL = 24;
/** Preferred touch target, used by zoom mode (px). */
export const ZOOM_CELL = 44;

/** Cell size that fits `cols` cells into `available` px, within the limits. */
export function fitCellSize(available: number, cols: number, maxCell = 72): number {
  return Math.max(MIN_CELL, Math.min(maxCell, Math.floor(available / cols)));
}

/** Cell size for the current mode. */
export function cellSizeFor(
  available: number,
  cols: number,
  zoomed: boolean,
  maxCell = 72,
): number {
  const fit = fitCellSize(available, cols, maxCell);
  return zoomed ? Math.max(ZOOM_CELL, fit) : fit;
}
