/**
 * Albastini state & move types.
 */

import type { BaseGameState, BaseMove, Card, Seat, Suit } from "@games/engine-core";
import type { AlbastiniConfig } from "./config";

/** A card played into the current trick by a seat. */
export interface TrickPlay {
  seat: Seat;
  card: Card;
}

/** A bid placed during the otea phase. */
export interface Bid {
  seat: Seat;
  card: Card;
}

export type AlbastiniPhase = "bidding" | "playing" | "finished";

export interface AlbastiniState extends BaseGameState {
  gameId: "albastini";
  config: AlbastiniConfig;
  hands: Record<Seat, Card[]>;
  /** Undealt stock; players refill from here between tricks. */
  stock: Card[];
  /** Trump suit (null until determined after bidding). */
  trump: Suit | null;
  /** The face-up trump indicator card, if still on the table. */
  trumpCard: Card | null;
  /** Bids placed this hand (otea). */
  bids: Bid[];
  /** Cards in the current trick, in play order. */
  currentTrick: TrickPlay[];
  /** Suit led in the current trick (null if no card played yet). */
  ledSuit: Suit | null;
  /** Seat to lead / act next. */
  phase: AlbastiniPhase;
  /** Captured ("eaten") cards per seat, for scoring. */
  taken: Record<Seat, Card[]>;
  /** Hand index and cumulative victory points across hands. */
  hand: number;
  victoryPoints: Record<Seat, number>;
  /** The dealer seat (bidding/trump owner). */
  dealer: Seat;
}

export type AlbastiniMove =
  | { type: "bid"; seat: Seat; card: Card }
  | { type: "pass-bid"; seat: Seat }
  | { type: "play"; seat: Seat; card: Card };

// Assignability guards.
type _M = AlbastiniMove extends BaseMove ? true : never;
const _m: _M = true;
void _m;
type _S = AlbastiniState extends BaseGameState ? true : never;
const _s: _S = true;
void _s;
