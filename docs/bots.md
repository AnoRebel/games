# Bot opponents

Bots live in `packages/game-ai` so offline play (the browser) and online rooms
(the Nitro server) import the same policies and make the same decisions.

## Card games

Last Card and Albastini keep their heuristic policies (`src/cardBots.ts`).
Difficulty changes how much value-aware strategy they apply and how quickly
they play.

## Board games (Bao, Checkers)

| Tier   | Search                                                     | Budget       | Evaluation                                                                                   |
| ------ | ---------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------- |
| easy   | none — uniform choice over legal moves                     | 0 nodes      | —                                                                                            |
| normal | alpha-beta, depth 2                                        | 20,000 nodes | material + mobility / seeds + front row                                                      |
| hard   | iterative deepening to depth 6, with a transposition table | 60,000 nodes | adds advancement, back-row defence, threats / occupied front pits, nyumba, capture potential |

- **Deterministic.** Budgets count visited nodes, never time, so every machine
  picks the same move. Ties break on a fixed move order. The easy tier draws
  from a PRNG seeded by the game state, never ambient randomness.
- **Always legal.** A bot returns one of the engine's own legal moves, or no
  move when the game is over or the seat has nothing to do. When the budget
  cuts a depth short, the best move of the last completed depth stands.
- **Responsive.** The search checks in every 250 nodes and hands the event
  loop back once a slice has run for 8 ms, so slices stay short on slow phones
  without pausing needlessly on fast machines. The bot thinks while its
  pacing delay runs, so the move lands after the delay rather than after delay
  plus thinking time. The server uses the same sliced search so a deep
  decision in one room never stalls the others.

## Strength benchmark

`packages/game-ai/test/benchmark.test.ts` plays seeded matches (six seeds, both
colours each, four random opening plies, a fixed move cap where an unfinished
game is a draw). It runs with the normal test suite, or on its own with
`bun run test:bench`. Results are exact and reproducible:

| Game                   | Match          | Result (12 games) | Score | Gate  |
| ---------------------- | -------------- | ----------------- | ----- | ----- |
| Bao (Bao la Kiswahili) | normal vs easy | 12 W              | 100%  | ≥ 65% |
| Bao (Bao la Kiswahili) | hard vs normal | 12 W              | 100%  | ≥ 60% |
| Checkers (Drafti)      | normal vs easy | 12 W              | 100%  | ≥ 65% |
| Checkers (Drafti)      | hard vs normal | 11 W, 1 D         | 96%   | ≥ 60% |

Changing a budget, an evaluation weight or the seeds changes these numbers;
re-run the benchmark and update this table with the change.

## Responsiveness on a phone

Measured on the production build in Chromium at 360×640 (touch, 2× pixel
ratio) with the CPU throttled 4×, three moves each against the hard bot.
"Long tasks" are main-thread tasks over 50 ms while the bot was thinking.

| Game     | Bot  | Longest task, first move | Longest task, later moves |
| -------- | ---- | ------------------------ | ------------------------- |
| Checkers | hard | 155 ms                   | 67–121 ms                 |
| Checkers | easy | 237 ms                   | 59–83 ms                  |
| Bao      | hard | 124 ms                   | none                      |
| Bao      | easy | 225 ms                   | none                      |

The easy bot does no search, so its numbers are the cost of rendering and
animating the move itself. The hard search adds no longer tasks than that
baseline. With the earlier 2,000-node slices, checkers on hard reached 202 ms.
Board animations move only `transform` and `opacity` (see
[the animation decision](decisions/animation-library.md)).
