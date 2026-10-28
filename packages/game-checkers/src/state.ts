/**
 * Checkers state model, shared by Drafti, English/American and International.
 *
 * The board is a flat array of `size × size` squares indexed `row * size + col`,
 * with row 0 at the top. Seat 0 starts on the bottom rows and moves up (toward
 * row 0); seat 1 starts on the top rows and moves down. Only dark squares —
 * `(row + col)` odd — are ever occupied.
 */

import type { BaseGameState, BaseMove, Seat } from "@games/engine-core";

export type CheckersVariant = "drafti" | "english" | "international";

export interface CheckersConfig {
  variant: CheckersVariant;
}

/** Square contents: empty, or a man/king of seat 0 or seat 1. */
export const EMPTY = 0;
export const MAN_0 = 1;
export const KING_0 = 2;
export const MAN_1 = 3;
export const KING_1 = 4;

export type Piece = 0 | 1 | 2 | 3 | 4;

export const ownerOf = (p: number): Seat | null =>
  p === 1 || p === 2 ? 0 : p === 3 || p === 4 ? 1 : null;
export const isKing = (p: number) => p === KING_0 || p === KING_1;
export const manOf = (seat: Seat): Piece => (seat === 0 ? MAN_0 : MAN_1);
export const kingOf = (seat: Seat): Piece => (seat === 0 ? KING_0 : KING_1);

/** A piece taken during a move. */
export interface CapturedPiece {
  square: number;
  king: boolean;
}

/**
 * A complete checkers move: the origin, every landing square in order (one for
 * a quiet move), every captured piece in jump order, and whether it promotes.
 * Enough to preview a capture path or write the move log without the rules.
 */
export interface CheckersMove extends BaseMove {
  type: "move";
  from: number;
  path: number[];
  captures: CapturedPiece[];
  promotes: boolean;
}

export type CheckersPhase = "playing" | "finished";

export type CheckersEndReason =
  | "no-pieces"
  | "no-legal-move"
  | "repetition"
  | "kings-equal"
  | "king-endgame"
  | "no-progress";

/** Countdown for an endgame material draw rule. */
export interface EndgameCounter {
  /** Material signature the countdown applies to; a change restarts it. */
  key: string;
  /** Plies played since the signature arose. */
  plies: number;
  /** Moves made by the stronger side since the signature arose. */
  strongerMoves: number;
}

export interface CheckersState extends BaseGameState {
  gameId: "checkers";
  phase: CheckersPhase;
  variant: CheckersVariant;
  config: CheckersConfig;
  size: number;
  board: number[];
  lastMove: CheckersMove | null;
  /** Plies played. */
  ply: number;
  /** Occurrences of each position (board + side to move) since the last irreversible move. */
  positionCounts: Record<string, number>;
  /** Consecutive plies without a capture or a man move. */
  quietPlies: number;
  endgame: EndgameCounter | null;
  winner: Seat | null;
  drawn: boolean;
  endReason: CheckersEndReason | null;
}

/** Board size per variant. */
export const BOARD_SIZE: Record<CheckersVariant, number> = {
  drafti: 8,
  english: 8,
  international: 10,
};

export const isDark = (size: number, sq: number) =>
  (Math.floor(sq / size) + (sq % size)) % 2 === 1;

/** The row a seat promotes on. */
export const kingsRow = (size: number, seat: Seat) => (seat === 0 ? 0 : size - 1);

/**
 * Standard notation number of a dark square (1-based, counted from the top
 * left), or null for a light square.
 */
export function squareNumber(size: number, sq: number): number | null {
  if (!isDark(size, sq)) return null;
  return Math.floor(sq / 2) + 1;
}
