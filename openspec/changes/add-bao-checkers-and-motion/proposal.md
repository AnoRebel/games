# Proposal

## Why

The platform currently ships only two card games. Bao and checkers are the obvious next step: both are deeply rooted in the same East African/Swahili context as Albastini, both support genuine rule variants, and both need a bot opponent so a single player can learn and play offline. The existing animation layer is anime.js-only and has no board-game choreography, so the new games would either ship flat or duplicate motion code. This change adds both games with researched rule sets, selectable variants and difficulty, and one revised animation stack that also improves the existing card games.

## What Changes

- Add **Bao** as a first-class game with two selectable rule variants:
  - **Bao la Kiswahili** (default) — full Zanzibar/De Voogt rules: 4×8 board, 32 pits, 64 seeds, 22 seeds in hand, namua and mtaji phases, compulsory captures, relay sowing, nyumba stop/safari, kichwa/kimbi entry rules, and the two Bao win conditions.
  - **Bao la Kujifunza** — learner game: two seeds in every pit, no hand, no nyumba, starts directly in the mtaji phase.
- Add **Checkers** as a first-class game with three selectable rule variants:
  - **Tanzanian Drafti** (default) — 8×8, flying kings, forward-only man movement/captures, any legal capture path, promotion ends the jump, Drafti draw rules.
  - **English/American checkers** — 8×8, short kings, forward-only man movement/captures, free capture choice, crowning ends the jump.
  - **International draughts** — 10×10, flying kings, backward captures for men, mandatory longest capture, crowning only when the move stops on the kings row.
- Add **difficulty selection** for both games: `easy`, `normal` (default), and `hard`, using deterministic, legal bot policies. Difficulty applies to bot-filled seats; online human rooms select the rule variant.
- Add shared **board presentation** for 4×8 and 8×8/10×10 boards: responsive touch layout, legal-move hints, capture/path previews, last-move highlighting, and accessible labels. No canvas/WebGL dependency.
- Revise the animation decision: **GSAP replaces anime.js** as the single orchestrated-event animation library, wrapped in the existing `app/utils/anim.ts` seam. **Three.js remains rejected** because both new games are 2D and WebGL would add memory/context cost without a gameplay requirement.
- Extend setup, home, rooms, rules/tutorial, leaderboard, and server registration so both games work identically offline and online.
- Rename the public site from **Card Games** to **Games** (Swahili: **Michezo**) and make brand copy game-agnostic. Internal identifiers move to the same name — `@games/*` packages, root `games`, Dexie `games`, `games.db`, `games:*` storage keys, `--games-*` CSS variables — with one-time migration of existing data.
- Make game scenes fully themeable: every built-in theme covers card tables and board scenes, players can create, preview, save, edit, and delete custom scene themes with validated contrast and colors, and each game can use its own saved scene theme.
- Record and display the game, rule variant, bot difficulty, and player tier used for every leaderboard result, with a per-play history on the leaderboard.
- Add rule-conformance, AI-strength, transport-parity, and UI smoke tests; every rule requirement in the new specs carries executable scenarios.

## Capabilities

### New Capabilities

- `bao-game`: Bao rules, state model, legal-move generation, captures, nyumba rules, both variants, scoring/win conditions, and deterministic bot policy inputs.
- `checkers-game`: Checkers rules for Drafti, English/American, and International, including move/capture generation, kings, promotion, draw rules, and deterministic bot policy inputs.
- `game-ai-opponents`: Shared difficulty tiers and measurable, deterministic bot behaviour for Bao and Checkers, with legal-move guarantees and configurable strength.
- `board-presentation-ui`: Shared 2D board rendering, responsive/touch layout, legal-move and capture-path affordances, accessibility, and reduced-motion-safe board animations.
- `site-identity`: The public product name, internal identifiers, install/metadata naming, and brand copy, renamed from Card Games to Games in English and Michezo in Swahili.

### Modified Capabilities

- `game-engine-core`: Game modules declare their selectable rule variants, defaults, and supported difficulty tiers so setup/rooms/UI read one contract instead of per-game switches.
- `game-learnability`: Rules and tutorials become variant-aware for Bao and Checkers, in English and Swahili.
- `card-presentation-ui`: The orchestrated-event animation stack changes from anime.js to GSAP; existing card animations are migrated behind the same helpers and performance/reduced-motion guarantees.
- `game-rooms`: Room creation validates the selected game variant and difficulty, preserves them for the match, and rejects unsupported combinations.
- `leaderboard`: Add an explicit per-game ranking-metric mapping plus recorded game, variant, and difficulty provenance with a per-play history.
- `theming-and-backgrounds`: Scene theming expands from card backs and table backgrounds to complete board/card scenes, with built-in defaults and user-created custom scene themes.

## Impact

- New workspace packages: `packages/game-bao`, `packages/game-checkers`; shared bot policy moved to a runtime-neutral package so both the Nuxt app and Nitro server can use it.
- App: game registration, home cards, setup modal (variant + difficulty), play route, new `BaoTable.vue` and `CheckersTable.vue`, content lookup, i18n.
- Server: game registration in the room hub; variant/difficulty validation; no new transport protocol.
- Dependencies: add `gsap`; remove `animejs`; update the animation ADR.
- Branding: locale strings, header, manifest, share defaults, metadata, `@games/*` packages, storage/class/CSS names, and database names; verified one-time migration preserves existing data. GitHub and Dokploy renames remain deferred.
- Theming: scene token set, defaults for every game, custom-theme editor, global fallback, and per-game theme assignments; card-back/background uploads remain.
- Tests: new engine test suites, perft-style move-generation checks, AI strength/termination tests, offline/online parity tests, and browser smoke tests for both boards.
- Leaderboard storage: additive variant, difficulty, draw, and experience-tier snapshots; New (0–9 plays), Regular (10–49), Veteran (50+) per game. Existing rows remain readable with unknown provenance; no destructive migration.
