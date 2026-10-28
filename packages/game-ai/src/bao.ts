/**
 * Bao search adapter and evaluation.
 *
 * Evaluations score seed differential and front-row strength (the win
 * condition is an empty front row); the strong evaluation adds occupied front
 * pits, working nyumba and capture potential.
 */
import type { Seat } from "@games/engine-core";
import {
  FRONT,
  NYUMBA,
  applyTurn,
  resolveTurns,
  type BaoMove,
  type BaoState,
} from "@games/game-bao";
import type { SearchAdapter } from "./search";

function sideStats(state: BaoState, seat: Seat) {
  const pits = state.pits[seat]!;
  let total = state.reserves[seat]!;
  let front = 0;
  let occupied = 0;
  for (let i = 0; i < pits.length; i++) {
    total += pits[i]!;
    if (i < FRONT) {
      front += pits[i]!;
      if (pits[i]! > 0) occupied++;
    }
  }
  return { total, front, occupied };
}

/** Seeds of `victim` sitting opposite occupied front pits of `attacker`. */
function exposed(state: BaoState, attacker: Seat): number {
  const own = state.pits[attacker]!;
  const opp = state.pits[1 - attacker]!;
  let sum = 0;
  for (let i = 0; i < FRONT; i++) if (own[i]! > 0) sum += opp[7 - i]!;
  return sum;
}

export function evaluateBao(state: BaoState, seat: Seat, strong: boolean): number {
  const opp = (1 - seat) as Seat;
  const me = sideStats(state, seat);
  const them = sideStats(state, opp);
  let score = (me.total - them.total) * 10 + (me.front - them.front) * 2;
  if (!strong) return score;
  score += (me.occupied - them.occupied) * 6;
  const working = (s: Seat) =>
    state.reserves[s]! > 0 && state.nyumba[s]! && state.pits[s]![NYUMBA]! >= 6 ? 1 : 0;
  score += (working(seat) - working(opp)) * 8;
  // The side to move threatens; the other side is exposed.
  score += exposed(state, seat) * 3 - exposed(state, opp);
  return score;
}

export const baoAdapter: SearchAdapter<BaoState, BaoMove> = {
  expand(state, seat) {
    return resolveTurns(state, seat).map((turn) => ({
      move: turn.move,
      child: applyTurn(state, seat, turn, { checkNextMoves: false }),
    }));
  },
  outcome: (state) => (state.phase === "finished" ? { winner: state.winner } : null),
  evaluate: evaluateBao,
  weight: (m) => (m.infinite ? -1000 : m.captures.reduce((n, c) => n + c.seeds, 0)),
  moveKey: (m) => `${m.kind}:${m.start}:${m.direction}:${m.entry}:${m.safari}`,
  positionKey: (state, seat) =>
    `${state.pits[0]!.join(",")}|${state.pits[1]!.join(",")}|${state.reserves[0]},${state.reserves[1]}|${Number(state.nyumba[0])}${Number(state.nyumba[1])}|${seat}`,
};
