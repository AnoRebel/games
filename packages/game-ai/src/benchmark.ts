/**
 * Deterministic strength benchmark for the board-game bots.
 *
 * Each seed plays two games, one with each side to move first. A few opening
 * plies are chosen by a PRNG seeded from the seed, so games differ while
 * staying reproducible; after that both bots play. A game still running at
 * the move cap counts as a draw. Scores count a win as 1 and a draw as ½.
 */
import {
  type BaseGameState,
  type BaseMove,
  type Difficulty,
  type GameModule,
  type Player,
  applyMove,
  createRng,
  nextInt,
} from "@card-games/engine-core";
import { chooseBotMove } from "./policy";

export interface MatchSpec {
  variant: string;
  /** The tier being measured. */
  a: Difficulty;
  /** Its opponent. */
  b: Difficulty;
  seeds: readonly string[];
  /** Plies after which an unfinished game is a draw. */
  moveCap: number;
  /** Random opening plies before the bots take over. */
  openingPlies: number;
}

export interface MatchReport {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Score of `a` in [0, 1]: (wins + draws / 2) / games. */
  score: number;
}

const PLAYERS: Player[] = [
  { id: "seat-0", name: "Seat 0", seat: 0, bot: true },
  { id: "seat-1", name: "Seat 1", seat: 1, bot: true },
];

/** Play one benchmark game; returns 1 / 0.5 / 0 for the tier on `aSeat`. */
export function playBenchmarkGame<S extends BaseGameState, M extends BaseMove, C>(
  game: GameModule<S, M, C>,
  spec: MatchSpec,
  seed: string,
  aSeat: 0 | 1,
): number {
  let state = game.createInitialState(
    { ...(game.defaultConfig() as object), variant: spec.variant } as C,
    PLAYERS,
    seed,
  );
  let rng = createRng(`opening:${seed}`);
  for (let ply = 0; ply < spec.moveCap && !game.isTerminal(state); ply++) {
    const seat = state.activeSeat!;
    let move: M | null;
    if (ply < spec.openingPlies) {
      const legal = game.getLegalMoves(state, seat);
      const r = nextInt(rng, legal.length);
      rng = r.state;
      move = legal[r.value]!;
    } else {
      move = chooseBotMove(game, state, seat, seat === aSeat ? spec.a : spec.b);
    }
    if (!move) break;
    const res = applyMove(game, state, move);
    if (!res.ok) throw new Error(`benchmark bot played an illegal move: ${res.error}`);
    state = res.state;
  }
  if (!game.isTerminal(state)) return 0.5;
  const scores = game.getScores(state);
  if (scores.drawn || !scores.winners.length) return 0.5;
  return scores.winners.includes(aSeat) ? 1 : 0;
}

export function runMatch<S extends BaseGameState, M extends BaseMove, C>(
  game: GameModule<S, M, C>,
  spec: MatchSpec,
): MatchReport {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const seed of spec.seeds) {
    for (const aSeat of [0, 1] as const) {
      const r = playBenchmarkGame(game, spec, seed, aSeat);
      if (r === 1) wins++;
      else if (r === 0) losses++;
      else draws++;
    }
  }
  const games = wins + draws + losses;
  return { games, wins, draws, losses, score: (wins + draws / 2) / games };
}
