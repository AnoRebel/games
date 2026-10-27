/**
 * Last Card state & move types.
 */

import type { BaseGameState, BaseMove, Card, Seat, Suit } from "@games/engine-core";
import type { LastCardConfig } from "./config";

/**
 * A pending skip/reverse chain awaiting interjections.
 *
 * `kind` is fixed at open time — a skip chain only accepts skip cards and a
 * reverse chain only reverse cards, so the two never mix. `origin` is the seat
 * that opened it (the turn advances from there once resolved).
 */
export interface PendingActionChain {
  kind: "skip" | "reverse";
  /** Seat that played the card which opened this chain. */
  origin: Seat;
  /**
   * Number of cards in the chain so far. For a skip, this is how many seats the
   * stop travels (and how many players it stops). For a reverse, an odd count
   * leaves the direction flipped and an even count restores it.
   */
  count: number;
  /**
   * Direction in force when the chain opened. Reverse chains re-derive the final
   * direction from this plus `count`, so interjections stay order-independent.
   */
  baseDirection: 1 | -1;
  /** Seats that have declined to interject; they are not asked again. */
  passed: Seat[];
  /**
   * Wall-clock ms deadline for the window, or null when untimed. Set by the
   * transport layer from `config.interjectionWindowMs` — the reducer itself
   * stays pure and never reads the clock.
   */
  deadline: number | null;
}

export interface LastCardState extends BaseGameState {
  gameId: "last-card";
  config: LastCardConfig;
  /** Each seat's hand. Hidden from other seats via redactFor. */
  hands: Record<Seat, Card[]>;
  /** Face-down draw pile (top = last element). */
  drawPile: Card[];
  /** Face-up discard pile (top = last element). */
  discardPile: Card[];
  /** Active suit demand — set by a suit-change card; otherwise top card's suit. */
  activeSuit: Suit;
  /** Play direction: 1 clockwise, -1 counter-clockwise. */
  direction: 1 | -1;
  /** Accumulated pickup penalty waiting to land on the next non-stacker. */
  pendingPickup: number;
  /**
   * The per-card amount of the LAST pickup card played into `pendingPickup`
   * (e.g. 2 for a two, 5 for a Joker), or 0 when nothing is pending. Stacking is
   * ordered: you may only add a pickup whose amount is ≥ this, so a Joker (+5)
   * may stack on a pending 2, but a 2 (+2) may NOT stack on a pending Joker.
   */
  pendingPickupUnit: number;
  /**
   * An open skip/reverse interjection window, or null when no chain is pending.
   *
   * While open, the turn does NOT advance: any player holding a matching card
   * may interject (pushing the stop / flipping direction again), and eligible
   * players may pass. The chain resolves — applying its accumulated effect and
   * handing the turn on — once every eligible seat has passed or the host's
   * timer expires.
   */
  pendingAction: PendingActionChain | null;
  /** Seat that has validly declared "Last Card" (cleared when they play out). */
  declaredLastCard: Seat | null;
  /**
   * Seat that reduced to one card but has not yet declared, pending the next
   * player's action (when the window closes, the penalty applies).
   */
  awaitingCall: Seat | null;
  /** 'playing' | 'finished'. */
  phase: "playing" | "finished";
  /** Round index (0-based) and cumulative scores across rounds. */
  round: number;
  cumulativeScores: Record<Seat, number>;
  /** Seat that emptied their hand to win the current/last round. */
  roundWinner: Seat | null;
}

export type LastCardMove =
  | {
      type: "play";
      seat: Seat;
      /** Lead card (must be a legal play). */
      card: Card;
      /**
       * Additional cards of the SAME RANK as `card`, played together in one turn
       * (pair/triplet/…). Optional; omitted/empty for a single-card play.
       */
      extraCards?: Card[];
      chosenSuit?: Suit;
      declareLastCard?: boolean;
    }
  | { type: "draw"; seat: Seat }
  | { type: "declare-last-card"; seat: Seat }
  | { type: "pass"; seat: Seat }
  /**
   * Add a matching skip/reverse card to an open chain, out of turn. Legal for
   * ANY seat holding a card of the chain's rank family — including the seat the
   * stop currently rests on, who thereby forfeits their turn to push it onward.
   */
  | {
      type: "interject";
      seat: Seat;
      card: Card;
      /** Declare "Last Card" if this interjection empties down to a last group. */
      declareLastCard?: boolean;
    }
  /** Decline to interject; the chain resolves once all eligible seats pass. */
  | { type: "pass-interjection"; seat: Seat };

// Ensure the move union is assignable to BaseMove.
type _AssertMove = LastCardMove extends BaseMove ? true : never;
const _moveOk: _AssertMove = true;
void _moveOk;

// Ensure the state is assignable to BaseGameState.
type _AssertState = LastCardState extends BaseGameState ? true : never;
const _stateOk: _AssertState = true;
void _stateOk;
