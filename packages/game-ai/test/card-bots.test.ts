/**
 * The card-game bots moved into this package unchanged: every difficulty
 * still plays Last Card and Albastini to a legal end, making exactly the same
 * decisions as before (fingerprints recorded from the original policies).
 */
import { describe, it, expect } from "vitest";
import {
  applyMove,
  hashSeed,
  type BaseGameState,
  type BaseMove,
  type GameModule,
  type Player,
} from "@games/engine-core";
import { lastCardGame, defaultLastCardConfig } from "@games/game-last-card";
import { albastiniGame, defaultAlbastiniConfig } from "@games/game-albastini";
import { chooseBotMove } from "../src/index";

const P = (n: number): Player[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, seat: i }));

/** `<moves>:<hash of the decision log>` for a fully bot-played game. */
function fingerprint(
  game: GameModule<BaseGameState, BaseMove, unknown>,
  config: unknown,
  n: number,
  seed: string,
  difficulty: "easy" | "normal" | "hard",
) {
  let s = game.createInitialState(config, P(n), seed);
  const log: string[] = [];
  for (let i = 0; i < 5000 && !game.isTerminal(s); i++) {
    const m = chooseBotMove(game, s, s.activeSeat!, difficulty);
    if (!m) break;
    log.push(JSON.stringify(m));
    const r = applyMove(game, s, m);
    if (!r.ok) throw new Error(`illegal bot move: ${r.error}`);
    s = r.state;
  }
  expect(game.isTerminal(s)).toBe(true);
  return `${log.length}:${hashSeed(log.join("|")).toString(16)}`;
}

const EXPECTED: Record<string, string> = {
  "last-card/easy/2": "20:5541f60e",
  "last-card/easy/4": "31:85f7f521",
  "last-card/normal/2": "80:bd8603fd",
  "last-card/normal/4": "50:530b8b01",
  "last-card/hard/2": "86:fddf8f1f",
  "last-card/hard/4": "286:3beca881",
  "albastini/easy/2": "37:73c5fdda",
  "albastini/easy/4": "39:3e74279",
  "albastini/normal/2": "37:cea76951",
  "albastini/normal/4": "39:82cda9ab",
  "albastini/hard/2": "37:723bd0d9",
  "albastini/hard/4": "39:ce080ca0",
};

describe("card-game bots — unchanged policy outcomes", () => {
  const games = [
    ["last-card", lastCardGame, defaultLastCardConfig()],
    ["albastini", albastiniGame, { ...defaultAlbastiniConfig(), enableBidding: true }],
  ] as const;
  for (const [name, game, config] of games) {
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      for (const n of [2, 4]) {
        it(`${name} ${n}p @ ${difficulty} terminates with the same decisions`, () => {
          expect(
            fingerprint(
              game as never,
              config,
              n,
              `fp-${name}-${difficulty}-${n}`,
              difficulty,
            ),
          ).toBe(EXPECTED[`${name}/${difficulty}/${n}`]);
        });
      }
    }
  }
});
