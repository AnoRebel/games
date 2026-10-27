# Design

## Context

See `proposal.md` for motivation and `specs/` for the behavior contract.

The repo already has the right seams for this change:

- `packages/engine-core` defines the pure `GameModule` contract (`createInitialState`, `reducer`, `getLegalMoves`, `isTerminal`, `getScores`, redaction) and a registry keyed by game id.
- `packages/game-last-card` and `packages/game-albastini` are self-contained modules wired through `app/plugins/games.ts`, the server room hub, `nuxt.config.ts` transpile, and Vitest aliases.
- `app/transports/LocalTransport` and `server/utils/roomHub.ts` already share the same engine reducer, so offline/online parity is a wiring problem, not a new protocol.
- Bots live only in `app/transports/bot.ts`, which Nitro cannot import. That is the one structural problem to solve for server-side bot seats.
- Theming today is two layers: app themes (`felt`/`arcade`/`neon` CSS tokens) and card-back/table-image selection with Dexie uploads. There are no board/scene roles.
- Orchestrated animation is anime.js behind `app/utils/anim.ts`; `@vueuse/motion` handles component transitions.
- Leaderboards aggregate `won` + `rankMetric` in Dexie and in the server `results` table; neither stores variant or difficulty.

Both new games are perfect-information, two-player, deterministic board games. No hidden state, no new transport messages, no new realtime protocol.

## Goals / Non-Goals

**Goals:**

- Ship Bao and Checkers as pure engine packages with complete, testable rule enforcement for every declared variant.
- Keep one AI implementation usable by the browser and Nitro.
- Render all four games through one accessible 2D board/table presentation layer.
- Make scene palettes first-class and user-customizable without touching game logic.
- Replace anime.js with GSAP without changing animation behavior or performance guarantees.
- Rename the product and internal identifiers with verified, restart-safe data migration.
- Record enough provenance on results to display game, variant, and difficulty per play.

**Non-Goals:**

- No WebGL/Three.js, no canvas board renderer, no 3D.
- No Bao "kutakatia" pit-blocking rule, no Malawi setup/Bawo variants, no two-seed nyumba taxation. These are disputed or explicitly optional; the default ruleset follows De Voogt/Zanzibar without them.
- No matchmaking, Elo/skill rating, tournaments, clocks, puzzles, or analysis mode. Player tiers measure completed-play experience only.
- No server-side writing of offline results.
- No shared/room-wide themes; themes stay viewer-local.
- No live GitHub, domain, or Dokploy rename in this checkpoint; target GitHub repository is `AnoRebel/games` in a later authorized operation.

## Decisions

### D1. Package layout: two game packages plus one shared AI package

Add:

- `packages/game-bao`
- `packages/game-checkers`
- `packages/game-ai`

`game-ai` receives the existing `app/transports/bot.ts` policies (moved, not rewritten), adds Bao and Checkers policies, and exports `chooseBotMove(game, state, seat, difficulty)`. The Nuxt app and Nitro both import it. It depends on `engine-core` and the game packages for state types; game packages never import `game-ai`, so there is no cycle.

Alternatives rejected:

- Keep bots in `app/` and duplicate for the server: two policies drift and break parity.
- Put search in `engine-core`: the core must stay game-agnostic.
- Put AI in every game package: three copies of alpha-beta and no single benchmark harness.

Wiring checklist for each package: root `package.json` workspace dependency, `nuxt.config.ts` `build.transpile`, `vitest.config.ts` alias, `app/plugins/games.ts` registration, and `server/utils/roomHub.ts` registration. Missing any one produces a runtime "no game registered" failure, so the tasks call them out explicitly.

### D2. Variant metadata lives on the game module

Extend the game metadata with `variants` and `difficulties` (id, display name, default). `createInitialState` merges partial config over the declared defaults, validates the variant/difficulty, and writes the resolved variant into state. Setup, rooms, rules, and leaderboard read the same declaration.

Alternatives rejected:

- Per-game switches in `GameSetupModal.vue`: exactly the duplication this change is meant to avoid.
- Separate variant registry: another global to keep in sync with the module.

Games without variants keep the current single-config behavior; the fields are optional.

### D3. Bao state model and turn resolution

Represent each player's 16 pits as one ring: front row indices `0..7` from that player's left, then back row `8..15` from that player's right back to left (the physical circuit). This makes sowing `+1`/`-1` and kichwa entry a single index walk. Opposite pit for front index `i` is `7 - i`. Nyumba is front index `4`; kichwa are `0` and `7`; kimbi are `1` and `6`.

State carries, per seat: 16 pit counts, reserve count, nyumba liveness. Globally: `phase` (`kunamua` | `mtaji` | `finished`), `activeSeat`, variant, resolved config, and the seeded RNG state for determinism.

Turn generation is a DFS over one turn:

1. Choose the starting action (reserve placement or pit pickup) and direction, filtered by the phase's compulsory-capture and kutakata restrictions.
2. Sow one seed at a time, enforcing relay and the merge of the last seed before testing the landing pit.
3. At a capture, branch only on the kichwa entry choice where the rules allow it; otherwise the entry is forced.
4. At a working nyumba on a non-capturing end, branch on stop vs safari.
5. Stop on empty pit, nyumba stop, no capture, or the 192-seed infinite cutoff.

Each emitted move is a complete turn: start, direction, entry choice, safari choice, plus the recorded path and captures for presentation. The reducer validates membership in `getLegalMoves` and then re-simulates from the move's choices; it never trusts the client-supplied path. A monotonically increasing distributed-seed counter inside the simulation supplies the cutoff and also guarantees termination.

Rules decisions worth recording:

- Capture is compulsory; a kutakata turn is non-capturing for its whole duration.
- In kunamua a reserve seed is placed only into a nonempty front-row pit; a working nyumba cannot start a kutakata turn.
- In mtaji a pit with 16+ seeds can only start a non-capturing turn; a sole occupied kichwa sows toward the centre; a back-row pickup with an empty front row is illegal.
- The AP "kutakatia" block is omitted. It is a disputed/optional rule and adding it would change the default from the De Voogt/Zanzibar ruleset. The omission is documented in the rules content and the ADR-style note in `docs/`.
- Bao la Kujifunza is the same engine with a setup/phase flag: 2 seeds in all 32 pits, no reserve, no nyumba, starts in mtaji.

Rules references: De Voogt via gamecabinet.com/rules/Bao.html, the Abstract Play Bao wiki (full turn ordering and edge cases), and the Wikipedia Bao article for orientation/terminology.

Alternatives rejected:

- Store a turn as a list of "seed drop" micro-moves: leaks intermediate states to clients and makes compulsory capture checks fragmentary.
- Let the client send a final board delta: unverifiable and breaks the reducer contract.

### D4. Checkers state model and move generation

State holds a flat board array (`0` empty, `1` man of seat 0, `2` king of seat 0, `3` man of seat 1, `4` king of seat 1 — or an equivalent typed union), active seat, variant, and draw bookkeeping: position-repetition counts, king-only move counter, no-progress counter, and the 3-vs-1 counter.

Move generation is recursive capture expansion:

- Quiet moves: forward diagonals for men; one step for English kings; sliding for Drafti/International kings.
- Captures: per variant direction rules. A sequence continues while another capture exists from the landing square and cannot revisit a jumped piece.
- Drafti/English: the player may choose any capture or any piece, but once a sequence starts every available capture in it must be completed (maximal per chosen piece, not global).
- International: generate all sequences, then keep only those with the global maximum capture count. Jumped pieces remain on the board until the sequence ends.
- Promotion: Drafti/English end the sequence on reaching the kings row; International only promotes if the complete move stops there.

`Move` is `{ from, path[], captures[], promotes }`; the path feeds capture previews and the move log. Repetition keys are built from board + side to move + variant; counters are updated in the reducer, not recomputed by the UI.

Perft fixtures from the standard starting positions: 7 legal moves for 8×8 Drafti/English and 9 for 10×10 International at depth 1, with deeper fixed counts for the standard variants to catch move-generation regressions.

### D5. Difficulty policies and deterministic search

One policy interface, three implementations, all synchronous and deterministic:

| Tier | Search | Budget | Behaviour |
| --- | --- | --- | --- |
| easy | none | 0 nodes | uniform choice over legal moves via state-seeded PRNG |
| normal | alpha-beta depth 2 | 20,000 nodes | material + mobility + capture ordering |
| hard | iterative deepening, depth ≥4 | 150,000 nodes | alpha-beta + transposition table + stronger evaluation |

Budgets are node counts, never wall-clock, so a slow machine returns the same move. Iterative deepening returns the last completed depth's best move if the node cap truncates the next depth. Move ordering is deterministic (captures first, then evaluation, then move key) so ties resolve identically.

Evaluations are per game: Bao scores seed differential, front-row occupancy (win proximity), mobility, working nyumba, and capture potential; checkers scores man/king material, mobility, promotion distance, back-row defense, and immediate capture threats.

Browser responsiveness comes from cooperative yielding, not a worker: the search runs in slices and yields to the event loop every few thousand nodes. Yielding does not affect the result because no decision depends on elapsed time. Nitro runs the same code synchronously. Alternatives rejected: a Web Worker (more bundling and message protocol for a ~100 ms search) and wall-clock cutoffs (non-deterministic).

The strength ladder is a release gate, not a suggestion. The benchmark harness uses fixed seeds, a fixed move cap (timeouts count as draws), and reports scores. Budgets and evaluation weights are tuned until `hard` ≥60% vs `normal` and `normal` ≥65% vs `easy` on both games, then frozen with the seeds checked in.

### D6. Shared board presentation

Add one `BoardGrid` component that takes `rows`, `cols`, a cell slot, and an optional cell-size cap. It renders a CSS grid inside a `role="grid"` container, uses roving `tabindex`, arrow-key navigation, Enter/Space activation, and an `aria-label` per cell. A polite live region announces moves, captures, promotions, and turn changes.

`BaoTable.vue` and `CheckersTable.vue` consume it. They derive hint maps (origins, destinations, capture paths, last move) from `legalMoves` and the move log; no rule logic lives in the UI. Bao cells show seed counts and a nyumba marker; checkers cells show men/kings with a non-color crown glyph.

Sizing uses square cells in fit mode, at least 24px and preferably 44px; a keyboard-accessible zoom control enables 44px cells with board-local panning. Keep the whole board visible at 360×640 in fit mode with no page overflow. Non-board controls retain 44px targets. Preserve selection/focus across zoom. Spectators get the same grid in read-only mode with no hints or submit path.

### D7. Scene theming on CSS variables

Keep CSS variables as the theme transport. Add a scene token block (surface, board light/dark, cell border, own/opponent piece, accent, legal, capture, last move, text) and apply it on a `.games-scene` wrapper, leaving global chrome on the existing app theme. Built-in scene themes extend Felt/Arcade/Neon for both color modes. Board games and card tables both consume the same tokens.

Custom themes are local data, not uploaded CSS:

- Store `{ id, name, colors: { light, dark } }` under `games:scene-themes`, max 20; keep a global selection and a game-id-to-theme-id assignment map under `games:*` keys. Resolve per-game assignment before global default, then Felt. Clearing/deleting an assignment restores that fallback.
- The editor uses native color pickers (hex output), shows both modes, and previews on a card table and a board.
- Validation uses a pure relative-luminance/contrast function: 4.5:1 for text, 3:1 for graphical roles, checked per mode.
- Missing roles and corrupt records resolve to the built-in default at render time; deleting the active theme selects Felt.
- Themes are never included in room state or transport messages.

Alternatives rejected: CSS-in-JS (new runtime dependency), server-stored themes (privacy and cross-player leakage), one palette for both modes (frequently fails contrast).

### D8. GSAP migration behind the existing seam

Replace the anime.js imports in `app/utils/anim.ts` with GSAP equivalents while keeping the exported helper signatures: `dealIn`, `playCard`, `sweepTo`, `suitFlourish`, `celebrate`, `press`, `floatLoop`, `tilt`, `flyCard`, `shuffle`, `crossFade`, `confetti`, `loseShake`, and `burst`, plus new `sowAlong`, `slidePiece`, `popCapture`, and `promotePiece`. Use `gsap.timeline` for sequences, `gsap.set` for reduced-motion snaps, and the existing `reduced()` / `rich()` gates. Initialize only in the browser. Remove `animejs` from `package.json`; update `docs/decisions/animation-library.md` to record GSAP, the Three.js rejection, and the Popmotion rejection.

`@vueuse/motion` stays for declarative component transitions. Game components call the shared helpers, never GSAP directly.

### D9. Product naming from one declaration

Add a plain `site.config.ts` at the repo root with the canonical name, short name, and description, imported by `nuxt.config.ts` and by the app shell. Locale files keep `app.title` for the translated display name (`Games` / `Michezo`); the header, share defaults, and install prompt read the i18n key, while the PWA manifest and Apple title read the root config. Tests assert that every surface agrees and that no user-visible string still says "Card Games".

Rename root package to `games`, workspace scope/imports to `@games/*`, Dexie database/class to `games`/`GamesDB`, default libsql filename to `games.db`, and application keys/CSS variables/classes/data attributes from `cg` to `games`. Update all callers, lockfile, tests, aliases, and selectors together. Historical archived specifications and legacy migration literals are not mechanically renamed.

Client startup awaits migration before opening gameplay or recording results. Copy legacy local/session storage into `games:*` only where the destination key is absent. Import all legacy IndexedDB stores, including results, uploads, and saved games, into the new database in an atomic destination transaction; verify record counts/keys and only then mark completion. Do not create an empty legacy database merely to detect its existence. Retain legacy stores as recovery copies. Interrupted runs retry without duplicates; conflicting nonempty destinations are reported rather than blindly merged.

For the default server database, run a pre-start migration with writers stopped: detect old/new paths, back up the legacy SQLite database with a consistent snapshot including WAL contents, copy to a temporary destination, verify integrity and table counts, then promote to `games.db`. Preserve the backup; if both paths contain databases without a completed migration marker, fail explicitly. Respect explicit `NUXT_LIBSQL_URL` connections without rewriting remote URLs. Re-running after verified completion is a no-op. Keep the current origin during client migration; a future domain change needs its own cross-origin transfer plan.

The current remote remains `AnoRebel/card-games` for this push. Target `AnoRebel/games` and deployment renaming are follow-up operations, not unattended code substitutions to live infrastructure.

### D10. Leaderboard provenance and metric mapping

Extend the result record with `variant`, `difficulty`, `drawn`, and `experienceTier` on both sides:

- Client: Dexie schema v3 adds the fields to `GameResult` (no new index needed; existing rows read as `unknown`).
- Server: additive `ALTER TABLE results ADD COLUMN` guarded by a pragma check, with `variant`/`difficulty` nullable and `drawn` defaulting to 0; old rows remain valid.
- API: the existing per-game endpoint returns aggregated rows plus a bounded `history` array of recent plays (game, variant, difficulty, result, date).

Show per-game experience tiers independently of bot difficulty: New for 0–9 completed plays, Regular for 10–49, Veteran for 50+. Snapshot the tier after counting the completed match, atomically with idempotent result insertion; history snapshots never change. The server calculates online tiers from server-authoritative completed plays; local tiers use local results. Legacy rows count toward experience but have unknown historical snapshots. This is not a skill rating and never changes ranking.

Ranking stays wins-first. `rankMetric` is set per game: Last Card `-penalty`, Albastini victory points, Bao/Checkers `1` win, `0.5` draw, `0` loss. Win rate is derived from wins, draws, and played. Difficulty is stored for display only and never affects ranking.

Offline results are written by the client as today; online results are written by the room hub from the room's stored variant and difficulty, so clients cannot forge provenance.

### D11. Testing strategy

The tests are the proof that the rules work:

- **Rule conformance**: one table-driven suite per game and variant covering every scenario in the specs, including compulsory captures, capture direction, nyumba stop/safari, mtaji restrictions, promotion timing, and draw triggers.
- **Perft**: fixed move counts for checkers starting positions and selected midgame positions; Bao legal-turn counts for the opening (4 first moves) and positions after each milestone.
- **Properties**: seed conservation (Bao always 64), no illegal move ever accepted, deterministic replay equality, bot legality on random reachable states.
- **Draw/win**: crafted endgames for every draw rule and win condition.
- **AI**: legality sweep, deterministic repeat, budget ceilings, and the strength ladder.
- **Transport**: LocalTransport vs in-process room parity for both new games, including variant/config rehydration.
- **Presentation**: component tests for hints, keyboard navigation, accessible names, contrast validation, theme fallback, and spectator read-only.
- **Branding/leaderboard**: string scan, provenance persistence, legacy-row display, aggregation order.
- **Browser smoke**: setup → variant/difficulty → move → theme switch → result, on a mobile viewport.

Vitest stays node-only; board component tests use the existing Nuxt/Vue test setup or, if absent, add `@vue/test-utils` with jsdom for the component layer only. Browser smoke uses the existing `bunwright` dependency.

## Risks / Trade-offs

- **Bao rules are genuinely disputed** → Default to De Voogt/Zanzibar, omit blocking/taxation, cite sources in the rules content, and encode disputed cases as explicit tests so a future rule flag is a local change.
- **Bao turn generation can explode** → DFS emits complete turns with a 192-seed termination counter; legal-move generation is capped by the rules themselves, and AI search uses node budgets.
- **AI strength gates may fail on first tuning** → Budgets and weights are tunable before the seeds are frozen; the benchmark is deterministic and runs in CI.
- **Leaderboard aggregation hides per-play provenance** → Keep standings aggregated and add a bounded history list; do not fragment rankings by variant.
- **Additive DB migration on libsql** → Guard the `ALTER TABLE`, keep columns nullable, and verify against a copy of an existing database in the migration test.
- **Custom themes can produce ugly or inaccessible scenes** → Validate contrast in both modes, preview on real boards, and fall back per role.
- **GSAP increases the client bundle** → Import only the core/plugins used, keep the helpers tree-shakeable, and verify the build budget in CI.
- **Rename risks lost data or split identities** → Keep the origin, migrate internal ids with verified backups and idempotent copies, and block on ambiguous destinations. Infrastructure renames are deferred.

## Migration Plan

1. Land packages, registration, and variant metadata with no user-visible entry points; run engine/unit tests.
2. Add AI package and move existing policies; run the card-game bot regression suite.
3. Add Bao and Checkers to setup/rooms/server and expose their variants/difficulties.
4. Add the shared board layer and scene-token theming; switch existing tables to the tokens.
5. Migrate `anim.ts` to GSAP, remove anime.js, update the ADR.
6. Back up and migrate legacy identifiers/data, then ship the rename and additive leaderboard changes; keep old rows as unknown provenance. Block startup on migration errors instead of silently serving empty data.
7. Enable new games on the home page and run the full CI plus browser smoke.

Rollback requires stopping writers and reconciling post-migration writes before switching back; legacy backups are snapshots, not live replicas. Restore a verified database backup or transfer new writes back explicitly. Do not claim a code-only revert preserves new results after the identifier migration. The additive result fields remain backward-compatible; reverting GSAP restores anime.js from the lockfile.

## Open Questions

None that change the specs, approach, or task order. Bao blocking and the Malawi variants are deliberately deferred; the rules content states the default ruleset so their absence is not a surprise.
