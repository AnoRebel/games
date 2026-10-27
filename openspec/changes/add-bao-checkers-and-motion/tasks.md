# Tasks

## 1. Foundation

- [x] 1.1 Extend the game metadata and config resolution with declared rule variants and difficulty tiers, including validation of unknown values and a no-variant regression path; verify with new `engine-core` unit tests for defaults, unknown variant/difficulty, and existing games.
- [x] 1.2 Scaffold `packages/game-bao`, `packages/game-checkers`, and `packages/game-ai` with package manifests, tsconfigs, and placeholder exports; wire root `package.json`, `nuxt.config.ts` `build.transpile`, and `vitest.config.ts` aliases. Verify `bun install` and `bun run typecheck` succeed with the new workspaces.
- [x] 1.3 Register the new game modules in `app/plugins/games.ts` and `server/utils/roomHub.ts`; verify an integration test can resolve `requireGame("bao")` and `requireGame("checkers")` in both the app test context and the room-hub test.
- [x] 1.4 Add the shared scene/theme and site identity constants needed by later groups without changing behavior; verify typecheck and that no existing test changes outcome.

## 2. Bao Engine

- [x] 2.1 Implement the Bao state model with the 16-pit ring, opposite-pit mapping, kichwa/kimbi/nyumba indices, and standard 32-seed setup; verify tests for initial counts, seed conservation (64), and nyumba placement.
- [x] 2.2 Implement sowing, relay, and compulsory captures with kichwa entry direction rules; verify table-driven tests for empty-pit termination, relay continuation, opposite-pit capture, forced capture, and repeated captures.
- [x] 2.3 Implement kunamua turn generation: reserve placement, forced capturing placement, kutakata start priorities, and working-nyumba restrictions; verify the opening exposes exactly 4 legal turns and the no-legal-move loss case.
- [x] 2.4 Implement nyumba rules: working threshold, kutakata stop, safari on a non-capturing end, capture precedence, and permanent loss of house status; verify a test per decision plus a stop/safari choice test.
- [x] 2.5 Implement mtaji turn generation: pit-size limits, compulsory captures, front-row preference, sole-kichwa direction, empty-front-row back-row restriction, plus the front-row-empty and no-legal-move losses and the 192-seed infinite cutoff; verify scenario tests for each.
- [x] 2.6 Implement Bao la Kujifunza setup and phase shortcut, expose both variants with Kiswahili as default, and verify variant resolution, full-board seeding, and a played-out learner game reaches a legal terminal state.
- [x] 2.7 Add the complete Bao turn representation (start, direction, entry, safari, path, captures) and ensure the reducer re-simulates and rejects forged moves; verify determinism/replay and illegal-move-unchanged tests.
- [x] 2.8 Ship Bao rules content in English and Swahili for both variants, including the documented omission of pit blocking/taxation and the win conditions; verify content lookups resolve per locale and variant and the rules panel renders them.

## 3. Checkers Engine

- [x] 3.1 Implement the Checkers state model and per-variant setup for Drafti, English/American, and International, with seat 0 moving first; verify board size, piece counts, empty middle rows, and default variant tests.
- [x] 3.2 Implement man and king movement for all variants, including flying kings and short kings; verify tests for forward-only men, blocked men, and both king ranges.
- [x] 3.3 Implement capture generation for all variants: direction rules, multi-capture completion, no double jump, International removal timing, and the maximal-capture rule; verify perft counts of 7 for the 8×8 starts and 9 for the 10×10 start plus targeted capture fixtures.
- [x] 3.4 Implement promotion timing differences, including Drafti/English move termination and International stop-on-row promotion; verify one test per variant, including pass-over behavior.
- [x] 3.5 Implement win detection and all three draw rule sets with repetition and move counters; verify crafted endgames for every draw trigger, a draw result recorded for both seats, and a no-legal-move loss.
- [x] 3.6 Add the checkers move representation (origin, path, captures, promotes) and verify capture-path previews can be built from a legal move without engine calls.
- [x] 3.7 Add determinism, replay, and illegal-move tests for all three variants, including variant persistence through serialization.
- [x] 3.8 Ship Checkers rules content in English and Swahili for all three variants, stating board, captures, promotion, and draw differences; verify content lookups and panel rendering per variant.

## 4. AI Opponents

- [x] 4.1 Move the existing card-game bot policies from `app/transports/bot.ts` into `packages/game-ai` and update app imports; verify the existing `test/bot.test.ts`, offline playthrough, and full-playthrough suites pass unchanged.
- [x] 4.2 Implement the deterministic policy interface and easy/normal/hard policies for Bao and Checkers, including node budgets, alpha-beta, move ordering, and per-game evaluations; verify legality, repeated-decision equality, and budget-ceiling tests.
- [x] 4.3 Add cooperative yielding for browser search without time-based decisions; verify a test that a yielded search returns the same move as a synchronous run and a browser smoke where input stays responsive during a hard search.
- [x] 4.4 Build the deterministic strength benchmark harness with checked-in seeds and a fixed move cap; run it for both games and record that hard ≥60% vs normal and normal ≥65% vs easy, tuning budgets before freezing the seeds.
- [x] 4.5 Wire server bot seats to the shared package and verify an offline and an in-room decision from the same state and difficulty return the same move.
- [x] 4.6 Verify the card-game bot regression explicitly: all three difficulties still terminate legally for Last Card and Albastini with unchanged policy outcomes.

## 5. Setup, Rooms, and Transport

- [x] 5.1 Update the setup modal to read declared variants and difficulties from game metadata and emit them for offline and online starts; verify a component test for defaults, variant switching, and unsupported games without variants.
- [x] 5.2 Thread variant and difficulty through `createLocalTransport` and `LocalTransport`; verify an offline runtime test that plays both new games at each difficulty and keeps the chosen config.
- [x] 5.3 Validate and persist variant/difficulty in room creation and start, preserve them across rehydration and rematch, and reject mid-game changes; verify room-hub and rehydrate tests for valid, invalid, default, and rematch cases.
- [x] 5.4 Show the selected variant in the lobby and keep difficulty limited to bot seats; verify a room test where two humans start at `easy` and no move is altered.
- [x] 5.5 Add offline/online parity tests for each new variant, including identical seed and move sequences producing identical final states.
- [x] 5.6 Add all setup, room, and game-selection strings in English and Swahili; verify every new key exists in both locale files.

## 6. Board Presentation

- [x] 6.1 Build the shared `BoardGrid` with CSS-grid cells, roving tabindex, arrow-key navigation, Enter/Space activation, accessible cell names, and a polite announcement region; verify component tests for grid roles, focus movement, and announcements.
- [x] 6.2 Build `BaoTable` on the shared grid with seed counts, nyumba marker, legal sow destinations, forced-capture state, last move, and spectator read-only mode; verify component tests for hints, markers, and non-interactive spectators.
- [x] 6.3 Build `CheckersTable` with men/kings, non-color crown glyph, legal destinations, capture-path previews, forced capture, promotion, and last move; verify component tests for each state.
- [x] 6.4 Make both tables responsive with fit-mode board targets at least 24px, zoom/pan mode with 44px targets, 44px non-board controls, no page overflow at 360×640, orientation reflow, and focus preservation; verify phone/desktop browser smoke including keyboard zoom.
- [x] 6.5 Add the new games to the home page and play-route table switch, including game-over/rematch flows; verify a browser smoke from home card to first move and from game over to rematch.

## 7. Scene Theming

- [x] 7.1 Define the scene token contract and extend Felt, Arcade, and Neon with complete light/dark scene palettes for card tables and both board families; verify a test that every built-in theme defines every role in both modes.
- [x] 7.2 Implement custom theme storage, global default and per-game assignments, per-role fallback, corrupt-record recovery, assignment deletion fallback, and the 20-theme limit; verify different games restore different selections and unassigned games use the global default.
- [x] 7.3 Implement the custom theme editor with role inputs, light/dark preview, live board/table preview, save/edit/delete, and duplicate-name handling; verify component tests for create, edit, delete, and duplicate rejection.
- [x] 7.4 Implement WCAG contrast validation (4.5:1 text, 3:1 graphical) across both modes and wire it into save; verify unit tests for passing/failing pairs and that a rejected save leaves the previous theme active.
- [x] 7.5 Apply scene tokens to the existing card tables and the new boards, compose with card-back/background uploads, and keep non-color state cues; verify a grayscale-cue component test and a browser smoke switching a custom theme mid-game.
- [x] 7.6 Verify themes stay viewer-local: no theme data in room state or transport messages, and a spectator renders their own theme; verify with a transport-message assertion test.

## 8. Motion

- [x] 8.1 Add `gsap`, migrate every helper in `app/utils/anim.ts` behind unchanged signatures, and add board helpers for sowing, piece slide, capture removal, and promotion; verify existing animation call sites still typecheck and `rg animejs` returns no source references.
- [x] 8.2 Preserve reduced-motion and subtle-motion gating in the migrated helpers; verify tests with mocked `prefers-reduced-motion` and motion preference for card and board helpers.
- [x] 8.3 Guard all GSAP initialization for SSR and animation-failure fallback; verify the game route server-renders without browser API access and renders a static board.
- [x] 8.4 Remove the `animejs` dependency, update `docs/decisions/animation-library.md` with the GSAP decision and Three.js/Popmotion rejection, and verify `bun install`, build, and the documented rationale match the shipped stack.

## 9. Product Rename

- [x] 9.1 Add the root site config and use it for the header, home title, manifest name/short name, Apple title, install prompt, share defaults, and metadata description; verify a test asserting every surface reports the same name and a string scan finds no user-visible "Card Games".
- [x] 9.2 Add localized product names and game-agnostic brand copy in English (`Games`) and Swahili (`Michezo`), including tagline, subtitle, install, and invitation text; verify locale tests for both languages and no card-only wording.
- [ ] 9.3 Rename root/workspace packages, imports, aliases, lockfile, database class/default filename, application keys, CSS variables/classes/attributes to `games`/`@games/*`; verify typecheck/build plus a scan allowing old ids only in migration literals and historical documents.
- [ ] 9.4 Implement awaited, idempotent client database/key migration preserving profiles, results, uploads, saved games, and preferences; verify interrupted retry, destination conflicts, quota failure, no duplicate results, and completion only after destination verification.
- [ ] 9.5 Implement a pre-start server database migration with writers stopped, consistent WAL-aware backup, integrity/count verification, explicit connection override support, and conflict detection; test old-only/new-only/both paths and interrupted retry. Document backup, recovery, and rollback of post-migration writes.

## 10. Leaderboard

- [ ] 10.1 Extend the client result model and Dexie schema to v3 with variant, difficulty, and draw fields while keeping old rows readable; verify a migration test that loads a v2 database and displays legacy rows as unknown provenance.
- [ ] 10.2 Extend the server results schema additively, record provenance from room config, and return a bounded recent-play history from the leaderboard endpoint; verify schema-init against an existing database and an API test for provenance and legacy rows.
- [ ] 10.3 Implement the per-game metric mapping (Last Card penalty, Albastini VP, Bao/Checkers win-draw-loss) and the wins → win rate → games → name ordering; verify aggregation tests for wins, draws, losses, ties, and unchanged card-game metrics.
- [ ] 10.4 Display game, variant, difficulty, experience tier, result, and date per play beside standings; verify labels, unknown legacy provenance, and not-applicable difficulty for human-only plays.
- [ ] 10.6 Persist per-game experience-tier snapshots (New 0–9, Regular 10–49, Veteran 50+) after counting a completed play, alongside idempotent result insertion; test 9/10 and 49/50 boundaries, per-game independence, duplicate insertion, and unchanged historical tiers. Show current tiers in standings without affecting ranking.
- [ ] 10.5 Verify the leaderboard remains readable on mobile with the new columns and history; verify a browser smoke at 360px width.

## 11. Integration and Documentation

- [ ] 11.1 Run the full verification gate: `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run build` all pass; record any pre-existing warnings separately.
- [ ] 11.2 Run the end-to-end browser smoke: offline bao and checkers with each difficulty, online room with a chosen variant, theme switch, rename surfaces, and a recorded result with provenance in the leaderboard.
- [ ] 11.3 Check the performance budget on a mobile viewport: board interaction stays responsive during a hard bot search, animations use transform/opacity, and the client bundle increase from GSAP is recorded.
- [ ] 11.4 Update `README.md` and the ruleset documentation for the new games, variants, rename, and the Bao ruleset scope note; verify documented commands and game lists match the shipped code.

## Workflow follow-up

- [x] Rename GitHub to `AnoRebel/games`, update the remote, and rename the deployment to **Games** with `games.anorebel.net` served alongside the retained `card-games.anorebel.net` origin.
- Archive the change after review and the full verification gate pass.
- Verify the archived specs include the new capabilities and the updated theming, leaderboard, rooms, learnability, card presentation, and engine-core deltas.
