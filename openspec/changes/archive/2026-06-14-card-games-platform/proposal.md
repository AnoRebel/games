## Why

We need a card games platform that ships two complete games — **Last Card** and **Albastini** — while establishing a modular foundation so future games can be added without rewriting infrastructure. Players expect realtime online multiplayer, offline local play, theming, and learnability (tutorials + always-available rules), none of which exist today. Building the shared engine, room, realtime, and presentation layers once — and proving them against two structurally different games (a shedding game and a trick-taking game) — de-risks every game we add later.

## What Changes

- **Scaffold a Nuxt 4 application** (configured for Nuxt 5 `compatibilityVersion`) with the agreed stack: VueUse, date-fns + `@date-fns/tz`, `@vueuse/motion`, and Nuxt UI.
- **Introduce a game-agnostic engine core**: a pure, deterministic rules-engine contract (state + reducer + legal-move generation) that each game implements as a self-contained module. The engine is decoupled from transport and UI.
- **Add two game modules** implementing that contract:
  - **Last Card** — shedding game; standard 52-card deck; configurable action cards (2s pickup, 8s/10s skip, Jacks/Aces suit-change variants), "Last Card" call with penalty, stacking, draw-pile reshuffle.
  - **Albastini** — 36-card trick-taking game; Ace-7-King-Jack-Queen ranking; bidding (otea), trump determination, draw-to-refill, card-point scoring, individual and team (2/3) victory points.
- **Add a rooms capability**: create/join rooms per game, host controls (start/end game), spectator mode, and per-game lifecycle (lobby → in-progress → finished).
- **Add a realtime multiplayer capability** using [Conduit](https://github.com/AnoRebel/Conduit) (WebRTC with WebSocket relay fallback) for room sync, moves, presence, and chat, with a server-authoritative state model.
- **Add local (offline) multiplayer**: same engine driven by a local in-memory transport (hotseat / pass-and-play and bot-fillable seats), no network required.
- **Add a theming + backgrounds capability**: built-in card-back/table themes (sourced from the provided SVG assets) plus user-uploaded card backs and backgrounds; runtime theme switching.
- **Add per-game social & meta features**: realtime chat, game time-tracking, and a leaderboard.
- **Add learnability**: each game ships an interactive in-game tutorial and an always-accessible "Rules / How to Play" panel.
- **Add responsive, motion-light card UI**: a reusable card-rendering layer (SVG sprite based) and animation system tuned for smoothness and low memory, working on mobile.

## Capabilities

### New Capabilities

- `game-engine-core`: Game-agnostic, deterministic rules-engine contract — state shape, move/reducer model, legal-move generation, turn order, RNG seeding, and the module interface every game implements.
- `last-card-game`: Last Card rules as an engine module — deck, dealing, matching, action cards, "Last Card" call/penalty, stacking, reshuffle, round/match scoring, and configurable variants.
- `albastini-game`: Albastini rules as an engine module — 36-card deck and ranking, bidding/otea, trump, trick resolution, draw-to-refill, card-point scoring, and individual/team victory points.
- `game-rooms`: Room lifecycle and membership — create/join/leave, host assignment and controls (start/end), seating, spectators, and game time-tracking.
- `realtime-multiplayer`: Online realtime transport via Conduit — connection/signaling, server-authoritative state sync, move broadcast, presence, reconnection, and the local-transport equivalent for offline play.
- `theming-and-backgrounds`: Built-in and user-uploaded card-back and table/background themes with runtime switching and persistence.
- `game-chat`: Per-room realtime chat for players and spectators.
- `leaderboard`: Per-game leaderboards aggregating match results and rankings.
- `game-learnability`: Per-game interactive tutorial and always-accessible rules / how-to-play reference.
- `card-presentation-ui`: Reusable responsive card-rendering and animation layer (SVG sprite based, `@vueuse/motion`) shared by all games.

### Modified Capabilities

<!-- None — this is a greenfield project with no existing specs. -->

## Impact

- **New codebase**: Nuxt 4 app initialized from scratch (no existing app code).
- **Dependencies added**: `nuxt`, `@vueuse/core`/`@vueuse/nuxt`, `@vueuse/motion`, `date-fns`, `@date-fns/tz`, `@nuxt/ui`, and Conduit (`@conduit/client` + server adapter for Nitro).
- **Server/runtime**: Nitro routes/handlers host the Conduit signaling/relay server and authoritative room/game state; offline mode bypasses the server entirely.
- **Assets**: card sprites and card-back/background themes derived from the SVGs in `dev_materials/` (`DeckCards.svg` for the 52 card faces; the three card-back SVGs as built-in back themes).
- **Cross-cutting**: all date/time tracking uses date-fns + `@date-fns/tz`; all animation uses `@vueuse/motion`; engine modules remain pure and transport-agnostic so the same code runs offline and online.
