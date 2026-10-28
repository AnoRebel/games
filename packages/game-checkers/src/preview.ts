/**
 * Presentation helpers that read a move's own description — no rules engine
 * calls — so the UI can preview capture paths and write the move log.
 */

import type { CheckersMove } from "./state";
import { squareNumber } from "./state";

export interface MovePreview {
  origin: number;
  /** Landing squares in order; the last one is the destination. */
  landings: number[];
  destination: number;
  /** Captured squares in jump order. */
  captured: number[];
  /** Straight-line legs of the path, origin first. */
  legs: { from: number; to: number }[];
  promotes: boolean;
}

export function previewMove(move: CheckersMove): MovePreview {
  const stops = [move.from, ...move.path];
  return {
    origin: move.from,
    landings: [...move.path],
    destination: move.path[move.path.length - 1]!,
    captured: move.captures.map((c) => c.square),
    legs: move.path.map((to, i) => ({ from: stops[i]!, to })),
    promotes: move.promotes,
  };
}

/** Standard move notation, e.g. `11-15`, `22x15x8`, with `K` on promotion. */
export function moveNotation(size: number, move: CheckersMove): string {
  const sep = move.captures.length ? "x" : "-";
  const squares = [move.from, ...move.path].map((sq) => squareNumber(size, sq));
  return squares.join(sep) + (move.promotes ? "K" : "");
}
