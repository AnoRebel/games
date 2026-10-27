/**
 * Checkers search adapter and evaluation.
 *
 * The basic evaluation counts material and mobility; the strong one adds
 * man advancement (promotion distance), back-row defence, centre control and
 * immediate capture threats, with kings valued by how far they can move.
 */
import type { Seat } from "@games/engine-core";
import {
  applyLegalMove,
  generateMoves,
  isKing,
  ownerOf,
  positionKey,
  type CheckersMove,
  type CheckersState,
} from "@games/game-checkers";
import type { SearchAdapter } from "./search";

export function evaluateCheckers(
  state: CheckersState,
  seat: Seat,
  strong: boolean,
): number {
  const size = state.size;
  const kingValue = state.variant === "english" ? 160 : 260;
  let score = 0;
  for (let sq = 0; sq < state.board.length; sq++) {
    const v = state.board[sq]!;
    const owner = ownerOf(v);
    if (owner === null) continue;
    const sign = owner === seat ? 1 : -1;
    if (isKing(v)) {
      score += sign * kingValue;
      continue;
    }
    score += sign * 100;
    if (strong) {
      const row = Math.floor(sq / size);
      const col = sq % size;
      const advanced = owner === 0 ? size - 1 - row : row;
      score += sign * advanced * 4;
      if (advanced === 0) score += sign * 6; // back-row defence
      if (col > 1 && col < size - 2 && row > 1 && row < size - 2) score += sign * 3;
    }
  }
  // Mobility and standing capture threats of the side to move (one move
  // generation per leaf keeps the evaluation cheap enough for deep search).
  const mine = generateMoves(state, seat);
  score += mine.length * 3;
  if (strong && mine.length && mine[0]!.captures.length) {
    score += Math.max(...mine.map((m) => m.captures.length)) * 30;
  }
  return score;
}

export const checkersAdapter: SearchAdapter<CheckersState, CheckersMove> = {
  expand(state, seat) {
    return generateMoves(state, seat).map((move) => ({
      move,
      child: applyLegalMove(state, move, { checkNextMoves: false }),
    }));
  },
  outcome: (state) => (state.phase === "finished" ? { winner: state.winner } : null),
  evaluate: evaluateCheckers,
  weight: (m) =>
    m.captures.reduce((n, c) => n + (c.king ? 3 : 1), 0) * 10 + (m.promotes ? 5 : 0),
  moveKey: (m) => `${m.from}>${m.path.join(">")}`,
  positionKey: (state, seat) => positionKey(state.board, seat),
};
