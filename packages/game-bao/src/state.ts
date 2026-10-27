/**
 * Bao state model.
 *
 * Each player's 16 pits form one ring, in sowing order: front row indices
 * 0..7 run from that player's left to right, then the back row 8..15 runs from
 * the player's right back to their left. Sowing `+1` is clockwise and `-1`
 * anticlockwise, both as a single index walk around the ring.
 *
 * Front index `i` faces the opponent's front index `7 - i` (their left is our
 * right). Kichwa are front 0 and 7, kimbi 1 and 6, the nyumba is front 4 —
 * the fifth pit from the player's left.
 */

import type { BaseGameState, BaseMove, Seat } from "@card-games/engine-core";

export type BaoVariant = "bao-la-kiswahili" | "bao-la-kujifunza";

export interface BaoConfig {
  variant: BaoVariant;
}

/** Sowing direction around a player's own ring: +1 clockwise, -1 anticlockwise. */
export type SowDirection = 1 | -1;

/** Kichwa (end pit of the front row) a capture is sown from. */
export type Kichwa = 0 | 7;

/** One leg of sowing within a turn, for presentation (animation / move log). */
export interface SowSegment {
  /** Where the seeds came from. */
  source: "reserve" | "pit" | "capture";
  /** Ring index the seeds were lifted from (pit/reserve placement), or the kichwa for captures. */
  from: number;
  /** Ring indices that received one seed each, in order. */
  pits: number[];
}

/** Seeds taken from the opponent during a turn. */
export interface BaoCapture {
  /** The capturing player's front pit that triggered the capture. */
  by: number;
  /** The opponent's front-row ring index the seeds were taken from. */
  pit: number;
  seeds: number;
}

/**
 * A complete Bao turn. The choice fields (`start`, `direction`, `entry`,
 * `safari`) fully determine the turn; the remaining fields describe what the
 * turn does and are always recomputed by the engine, never trusted.
 */
export interface BaoMove extends BaseMove {
  type: "sow";
  /** Capturing turn (mtaji / namua capture) or non-capturing kutakata turn. */
  kind: "capture" | "kutakata";
  /** Ring index of the starting pit (front row while reserves remain). */
  start: number;
  /** Initial sowing direction; null for a namua capture, which starts by capturing. */
  direction: SowDirection | null;
  /** Kichwa chosen for the turn's first free capture entry; null when forced or unused. */
  entry: Kichwa | null;
  /** Stop (false) or safari (true) at a working nyumba; null when no choice arose. */
  safari: boolean | null;
  /** True when the start places a reserve seed (namua phase). */
  fromReserve: boolean;
  /** Sowing legs in order. */
  path: SowSegment[];
  /** Captures in order. */
  captures: BaoCapture[];
  /** Seeds distributed during the turn. */
  sown: number;
  /** The turn exceeded the infinite-turn cutoff; its player loses. */
  infinite: boolean;
}

export type BaoPhase = "kunamua" | "mtaji" | "finished";

export type BaoEndReason = "front-row-empty" | "no-legal-move" | "infinite-turn";

export interface BaoState extends BaseGameState {
  gameId: "bao";
  phase: BaoPhase;
  variant: BaoVariant;
  config: BaoConfig;
  /** 16 ring pits per seat. */
  pits: Record<Seat, number[]>;
  /** Seeds still held in reserve per seat (public). */
  reserves: Record<Seat, number>;
  /** Whether each seat's nyumba still has house status. */
  nyumba: Record<Seat, boolean>;
  /** The last applied turn (for last-move highlighting); null at the start. */
  lastMove: BaoMove | null;
  /** Number of turns applied. */
  turn: number;
  winner: Seat | null;
  endReason: BaoEndReason | null;
}

// ---- ring geometry ----------------------------------------------------------

export const RING = 16;
export const FRONT = 8;
export const NYUMBA = 4;
export const KICHWA: readonly Kichwa[] = [0, 7];
export const KIMBI = [1, 6] as const;
export const TOTAL_SEEDS = 64;
/** A turn that has distributed more than this many seeds and needs another relay is infinite. */
export const INFINITE_CUTOFF = 192;

export const isFront = (i: number) => i >= 0 && i < FRONT;

/** The opponent's front-row ring index facing our front index `i`. */
export const opposite = (i: number) => 7 - i;

/** The next ring index after `i` in direction `dir`. */
export const step = (i: number, dir: SowDirection) => (i + dir + RING) % RING;

/**
 * Board grid placement (4 rows × 8 columns) as seen with seat 0 at the bottom:
 * row 0 = seat 1 back, row 1 = seat 1 front, row 2 = seat 0 front, row 3 = seat 0 back.
 */
export function pitCell(seat: Seat, ring: number): { row: number; col: number } {
  if (seat === 0) {
    return ring < FRONT ? { row: 2, col: ring } : { row: 3, col: 15 - ring };
  }
  return ring < FRONT ? { row: 1, col: 7 - ring } : { row: 0, col: ring - 8 };
}

/** Inverse of `pitCell`. */
export function cellPit(row: number, col: number): { seat: Seat; ring: number } {
  switch (row) {
    case 0:
      return { seat: 1, ring: col + 8 };
    case 1:
      return { seat: 1, ring: 7 - col };
    case 2:
      return { seat: 0, ring: col };
    default:
      return { seat: 0, ring: 15 - col };
  }
}
