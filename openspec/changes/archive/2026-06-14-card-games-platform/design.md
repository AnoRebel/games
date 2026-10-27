## Context

Greenfield project: no app code exists yet — only `dev_materials/` (game rule references and SVG card assets), an `openspec/` planning home, and a `.mcp.json` wiring the Nuxt UI MCP. We must deliver two structurally different games (Last Card — a shedding game; Albastini — a trick-taking game) on a shared, modular foundation that supports offline and realtime-online multiplayer, rooms, spectators, host controls, themes, chat, leaderboards, time tracking, and per-game learnability (tutorial + rules).

Mandated stack (from `dev_materials/plan.md`): **Nuxt 4** with `compatibilityVersion: 5`, **VueUse**, **date-fns** + **@date-fns/tz** (all datetime), **@vueuse/motion** (animations), **Nuxt UI**, and **Conduit** (`github.com/AnoRebel/Conduit`) for realtime. The user additionally requested an in-game tutorial and easy-access rules for every game, and specified the **`v-tour-guide`** package for the tutorial.

Key research findings:
- **Conduit** is a WebRTC P2P library with automatic WebSocket-relay fallback (`@conduit/client` + a server adapter, installed via JSR). It supports binary/JSON/MessagePack serialization and ships server adapters (Express/Fastify/Hono/Bun) — Nitro integration uses the client in-app and the server adapter in the Nitro layer.
- **Card assets**: `DeckCards.svg` contains 52 reusable `<symbol>`s keyed `<rank><suit>` (rank 1–13, suit `c/s/h/d`; e.g. `13c` = King of clubs). Three additional SVGs are usable as built-in card backs.
- **Rules** were consolidated from multiple sources; Last Card especially varies by source, so its action cards are modeled as **configurable variants** rather than hardcoded.

## Goals / Non-Goals

**Goals:**
- A pure, deterministic, transport- and UI-agnostic **engine core** with a single game-module contract; both games implement it.
- **One game runtime, two transports**: identical engine code runs offline (local in-memory transport) and online (Conduit + server-authoritative Nitro state) behind a shared transport interface.
- **Server-authoritative** online play with hidden-information hygiene (no leaking other players' hands).
- A **reusable presentation layer** (SVG-sprite card component + `@vueuse/motion` animation system) shared by all games, responsive and motion-light on mobile.
- Modular platform features (rooms, chat, leaderboard, theming, learnability) that don't know game specifics, plus per-game content (rules, tutorial steps, variant config) co-located with each game module.
- Adding a future game = add one engine module + its UI view + its learnability content; no infra changes.

**Non-Goals:**
- Accounts / persistent auth beyond a lightweight player identity (display name + id); full user accounts are out of scope for this change.
- A durable database — leaderboard/results persistence may start with a simple server-side store (file/KV) abstraction; swapping to a real DB is a later change.
- AI opponents beyond simple seat-filling bots for offline play (advanced strategy is out of scope).
- Voice/video (Conduit supports media, but we only use data channels here).
- Monetization, moderation tooling beyond basic chat rate/length limits.

## Decisions

### D1: Modular architecture via a workspace, not a single flat app
Use a pnpm/workspace-style layout inside the Nuxt project so the engine is independently testable and clearly decoupled:
- `packages/engine-core` — the contract + helpers (deck/PRNG/turn-order utils), zero framework deps.
- `packages/game-last-card`, `packages/game-albastini` — engine modules (pure logic + per-game metadata: variants, rules text, tutorial steps).
- Nuxt app (`app/`) consumes engine modules through a registry; `server/` hosts Conduit + authoritative state.

*Alternative considered:* one flat `app/` with `composables/games/*`. Rejected — weaker enforcement of the "core imports no framework/DOM" rule (`game-engine-core` spec) and harder to unit-test the engine in isolation.

### D2: Engine = pure state + reducer + legal-move generator, seeded RNG
Each game module exports `{ id, meta, createInitialState(config, players, seed), reducer(state, move), getLegalMoves(state, seat), isTerminal(state), getScores(state) }`. State is a plain serializable object; the reducer is pure; all randomness flows through a seeded PRNG stored in state. This makes online/offline parity trivial (same inputs → same state) and enables replay/resync (replay moves to reconstruct state — required by `realtime-multiplayer` resync and `game-engine-core` replay scenarios).

*Alternative considered:* OOP game objects with internal mutable state. Rejected — harder to serialize, snapshot, replay, and to guarantee determinism for authoritative validation.

### D3: Transport abstraction — `GameTransport` interface with two implementations
Define a `GameTransport` interface (submitMove, onState, presence, chat). Two impls:
- `LocalTransport` — in-memory; runs the reducer client-side; supports hotseat and bot seats. No network.
- `ConduitTransport` — sends moves to the server; receives authoritative state deltas; uses Conduit data channels with WS-relay fallback.
The UI binds only to `GameTransport`, satisfying the `realtime-multiplayer` "transport parity" requirement and keeping offline a first-class path.

*Alternative considered:* peer-to-peer authority (no server, clients agree via Conduit P2P). Rejected for online — can't keep hidden hands honest or resolve conflicts; we keep P2P only as Conduit's transport optimization under a server-authoritative model.

*Transport carrier decision (revised during build):* the **room/game protocol** rides on **Nitro's native WebSocket support** (crossws — `experimental.websocket`, a `routes/_ws.ts` `defineWebSocketHandler`, with built-in topic **pub/sub** for `room:<id>` broadcast). This is reliable in dev and portable across deploy presets, and its pub/sub maps directly onto room broadcasting. **Conduit** is retained as an *optional* WebRTC peer-to-peer enhancement (lower latency, relay fallback) layered behind the same `GameTransport` seam — not the primary carrier, so we don't fight raw-`ws` upgrade hooks inside Nitro. The client is agnostic: `ConduitTransport`/`WsTransport` both satisfy `GameTransport`.

### D4: Server-authoritative state on Nitro; clients receive filtered projections
Nitro holds the canonical room/game state and validates each move via the engine reducer before broadcasting. Outgoing state is **filtered per recipient** so a seat only sees its own hand plus public info (discards/tricks/counts); spectators see public-only. This satisfies `realtime-multiplayer` (reject illegal move, no hidden-hand leak) and `game-rooms` (spectator) requirements. Conduit carries the messages; Nitro is the authority.

### D5: Card rendering from the SVG sprite; theming via CSS + asset swap
A `<PlayingCard>` component references `DeckCards.svg` symbols by `<rank><suit>` id for faces and renders backs from the active theme. Themes (built-in backs from the three SVGs + user uploads) are a reactive store persisted with VueUse `useStorage`. Backgrounds and backs swap at runtime (`theming-and-backgrounds`). Uploads validated for type/size client-side.

*Alternative considered:* per-card PNG image set. Rejected — the provided SVG sprite is crisp at any size, smaller in aggregate, and a single fetch.

*Deck of Cards API (deckofcardsapi.com):* evaluated and **rejected for game logic**. It is stateful and server-side (a network round-trip per shuffle/draw, deck stored remotely under a `deck_id`), which would break determinism, offline play, replay, and server-authoritative validation — the platform's core guarantees. Our pure seeded in-engine deck (`engine-core/cards.ts` + `rng.ts`) is the single source of truth. The API is retained only as an *optional remote card-image source* for theming (its hosted SVG/PNG faces could back a future "classic" face theme); it is never a logic dependency.

### D5b: Client storage — three tiers (Dexie / localStorage / sessionStorage)
Two tabs must be able to play two independent games at once, and some data is structured and must persist — so client state is split into three tiers by lifetime, scope, and shape:
- **Dexie / IndexedDB (structured, persistent, queryable)** — data that must persist *and* has structure or size: **leaderboard results** (many rows, queried/sorted/aggregated per game), **saved offline games**, and **user-uploaded theme assets stored as `Blob`** (card backs / backgrounds — IndexedDB stores binary natively and avoids the ~5 MB base64 `localStorage` cap). A typed `Dexie` subclass (`app/db.ts`) with `EntityTable`s; reactive reads via `liveQuery` wrapped in a `useLiveQuery` composable.
- **`localStorage` (shared across tabs, persistent, scalar)** — tiny preferences and identity that should be the same everywhere and survive close: selected theme/back/background **id**, language, tutorial-seen flags, player id + display name. VueUse `useLocalStorage` (synchronous → no hydration flicker).
- **`sessionStorage` (per-tab, ephemeral)** — the active game *session*: which room this tab is in, the player's seat, and in-progress **offline** game state. Keeps two tabs isolated. VueUse `useSessionStorage`.

Edge case — resuming an offline game after closing the tab is an explicit "save game" written to the Dexie saved-games table on demand, not default session behaviour. Online games need no client persistence: they are server-authoritative and rejoinable via the persisted player id.

Rule of thumb: per-tab `sessionStorage` for live session state; `localStorage` for small shared scalars; **Dexie for anything structured that must persist (results, saves, uploaded blobs)**.

### D6: Animations via `@vueuse/motion`, transform/opacity only
All deal/play/draw/collect/shuffle motion uses `@vueuse/motion` with compositor-friendly properties and respects `prefers-reduced-motion` (VueUse `usePreferredReducedMotion`), meeting `card-presentation-ui` performance scenarios. A small set of shared motion presets keeps games consistent and avoids per-frame allocation.

### D7: Learnability — `v-tour-guide` tutorials + a rules overlay, content per game module
Each game module ships `tutorialSteps` (consumed by `v-tour-guide`) and `rulesContent`. A shared `<RulesPanel>` overlay and a tutorial launcher live in the platform layer but render game-supplied content, satisfying `game-learnability` (per-game content, on-demand + first-time, skippable, available in lobby and mid-game). First-time detection uses persisted local state.

### D8: Time, IDs, and config
All timestamps/durations use date-fns + `@date-fns/tz` (`game-rooms` time tracking, `game-chat` timestamps). Room codes and seeds are generated server-side (and passed into the engine) so the determinism rules hold and scripts/tests stay reproducible. Game variants (e.g. Last Card action-card toggles) are part of room creation config and flow into `createInitialState`.

## Risks / Trade-offs

- **Conduit maturity / JSR install in Nitro** → Isolate it entirely behind `ConduitTransport` and the Nitro server adapter; if integration friction arises, the `GameTransport` seam lets us swap to a plain WebSocket relay without touching games or UI.
- **WebRTC NAT/connectivity failures** → Rely on Conduit's automatic WebSocket-relay fallback (covered by a `realtime-multiplayer` scenario); never assume direct P2P.
- **Hidden-information leaks** via naive full-state broadcast → Enforce per-recipient state filtering at the server boundary; add a test asserting opponents' hands are absent from a recipient's payload.
- **Rule ambiguity (esp. Last Card variants)** → Model action cards as config-driven variants with sensible defaults; document each variant; don't hardcode one source's interpretation.
- **Animation jank on low-end mobile** → Constrain to transform/opacity, cap concurrent animations, honor reduced-motion, and budget memory (no large per-card DOM churn — reuse sprite refs).
- **Determinism broken by ambient randomness/time** → Lint/review rule: engine packages must not use `Math.random`/`Date.now`; RNG and timestamps are injected.
- **Scope is large for one change** → The tasks plan sequences it so the engine + one game + local transport is a working vertical slice before online, theming, and the second game layer on.

## Migration Plan

Greenfield — no rollback of existing behavior. Deployment is incremental by phase (see `tasks.md`): (1) scaffold + engine core + card UI, (2) Last Card on local transport (playable offline slice), (3) rooms + Conduit online + server authority, (4) Albastini, (5) theming, chat, leaderboard, learnability, (6) responsive/animation/perf polish. Each phase is independently runnable; if a later phase (e.g. Conduit) is blocked, offline play still ships.

## Open Questions

- **Persistence backend for leaderboards/results**: start with a server-side KV/file store behind an interface, or pull in a DB now? (Leaning: interface + simple store now, DB later.)
- **Player identity**: anonymous per-session id + display name only, or lightweight persisted profile? (Leaning: persisted display name + id via local storage; no auth this change.)
- **Conduit signaling hosting**: run the signaling/relay inside the same Nitro server, or as a separate process? (Leaning: same Nitro server for simplicity; revisit if it complicates scaling.)
- **Bot sophistication** for offline seat-filling: random-legal-move bots sufficient for v1?
