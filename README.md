# Card Games

Modular multiplayer card games platform. Ships **Last Card** (shedding) and
**Albastini** (trick-taking) on a shared, game-agnostic engine with offline
(local) and realtime online multiplayer, rooms, spectators, theming, chat,
leaderboards, and per-game tutorials.

## Features

- **Two games**: Last Card (shedding) and Albastini (Tanzanian trick-taking),
  each on a shared, pure, deterministic engine. See [Game rules](#game-rules).
- **Offline & online multiplayer** behind one transport seam — hotseat + bots
  offline; realtime, server-authoritative rooms online.
- **Rooms**: create/join, shareable links, seating, host start/end, presence.
- **Spectators** with access control — public rooms or **locked** rooms that
  require a passcode (distinct player vs spectator links).
- **Themes**: built-in + user-uploaded card backs and table backgrounds.
- **Per-room chat**, per-game **leaderboards**, **tutorials** and an
  always-available **rules** panel.
- **Dark/light mode** with animated transitions, **i18n** (English + Swahili),
  in-game **notifications**, and a **settings** page.
- Responsive and mobile-friendly; reduced-motion aware throughout.

## Game rules

### Last Card (shedding)

Be the first to empty your hand. Played with a **54-card deck** (standard 52
plus **2 jokers**); each player is dealt **7 cards** and the top of the stock is
turned to start the discard pile.

On your turn, play a card that matches the top of the discard pile by **suit or
rank**. Holding two or more of the same rank, you may play them all together in
one turn. If you can't play, draw one card and your turn ends. **You cannot win
on an action card** — your final card must be a plain one.

**Action cards**

| Card      | Effect                                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| **2**     | Next player picks up 2 (stacks).                                                                                |
| **Joker** | Next player picks up 5. A Joker may stack onto a pending 2 (2 + 5 = 7), but a 2 may **not** stack onto a Joker. |
| **7**     | Skips the next player.                                                                                          |
| **8**     | Reverses the direction of play.                                                                                 |
| **Jack**  | Wild — choose the next suit.                                                                                    |

**Last Card!** When a play leaves you on your last card (or your last same-rank
group), the game prompts you — on your turn, untimed — to call **“Last Card”**.
Call it, or stay quiet and risk a penalty if you're caught. At the end of a round
the winner scores 0; everyone else scores the pip value of the cards left in
hand (Ace 1, face cards 10, Joker 15). Lowest total wins.

### Albastini (Tanzanian trick-taking)

A trick-taking game played with a **36-card deck** (standard 52 minus the 2s,
8s, 9s, and 10s). Each player is dealt **5 cards**. Unusual trick ranking, high
to low: **Ace, 7, King, Jack, Queen, 6, 5, 4, 3** — the 7 (Jike) beats the King!

Card points total **120** per hand: Ace (Dume) 11, 7 (Jike) 10, King (Mzungu) 4,
Jack 3, Queen 2; the rest (the Ngarasha) are worth nothing.

**Otea (bidding) & trump.** Before trump is shown, opponents may each bid one
card of a different suit. The dealer turns the top stock card; its suit becomes
**trump (Mchezo)**, and that card is slid under the deck to be the **last card
drawn**. A player who bid the trump suit exchanges: they take the turned trump
card into hand and surrender their bid card (which becomes the last card drawn).

**Play (Kula — “to eat”).** There is no follow-suit requirement — play any card.
The highest trump wins the trick; with no trump, the highest card of the led
suit wins. The winner “eats” the cards, everyone refills to 5 from the stock,
and the winner leads again.

**Scoring.** Count the points you ate. The top scorer earns victory points (1 if
everyone reached the threshold, otherwise 2); ties score nothing. The winner of
each hand deals the next.

## Stack

- **Nuxt 4** (`future.compatibilityVersion: 5`) + Nitro
- **@nuxt/ui** (Tailwind v4) for UI
- **VueUse** (`@vueuse/core`, `@vueuse/nuxt`) + **@vueuse/motion** + **GSAP**
  for animation (see `docs/decisions/animation-library.md`)
- **date-fns** + **@date-fns/tz** for all date/time + timezone handling
- **valibot** for schema validation; **Dexie** (IndexedDB) for results / uploads
- **nuxt-i18n-micro** for i18n (en + sw)
- **v-tour-guide** for interactive in-game tutorials
- **Realtime**: Nitro-native WebSockets (crossws) carry the room/game protocol;
  **Conduit** (`@conduit/client` / `@conduit/server`, via JSR) is an optional
  WebRTC peer-to-peer enhancement behind the same transport seam
- **Vitest** for tests

## Repository layout (bun workspaces)

```
packages/
  engine-core/      # pure, deterministic, framework-free game engine contract
  game-last-card/   # Last Card rules as an engine module (depends on engine-core)
  game-albastini/   # Albastini rules as an engine module (depends on engine-core)
app/                # Nuxt app (pages, components, composables, transports, UI)
server/             # Nitro: Conduit signaling/relay + server-authoritative state
```

The dependency graph is a DAG: `engine-core` is a leaf (no deps); games depend
only on `engine-core`; the app depends on all three. Engine and game packages
**must not** use `Math.random` / `Date.now` / `new Date()` — randomness flows
through a seeded PRNG and time is injected (enforced by an ESLint rule).

## Prerequisites

- [bun](https://bun.sh) ≥ 1.3
- Conduit (optional WebRTC enhancement) is installed from JSR:
  ```bash
  bunx jsr add @conduit/client @conduit/server
  ```

## Setup

```bash
bun install
```

## Develop

```bash
bun run dev        # Nuxt dev server (offline + online both work)
bun run build      # production build
bun run preview    # preview the production build
```

## Playing online

Online rooms run over Nitro-native WebSockets — no extra services needed in dev
or in a standard Node deployment. Create a room from a game's lobby, share the
**player link**, and (for locked rooms) the **spectator link** with its passcode.

To enable the optional Conduit WebRTC path, set `NUXT_CONDUIT_ENABLED=true`.
Conduit/i18n/realtime settings are env-overridable via `runtimeConfig`
(`NUXT_PUBLIC_CONDUIT_PATH`, `NUXT_CONDUIT_AUTH_MODE`, etc.).

## Internationalization

UI is available in **English (en)** and **Swahili (sw)** — switch via the globe
menu. Albastini surfaces authentic Swahili terms (Dume, Jike, Mzungu, Kula,
Otea). Translations live in `locales/`.

## Quality

```bash
bun run test       # run the Vitest suite (engine + games + platform)
bun run lint       # ESLint (includes the engine determinism guard)
bun run typecheck  # vue-tsc type-check
```

## Architecture notes

Each game is a self-contained module implementing the engine contract
(`createInitialState` / `reducer` / `getLegalMoves` / `isTerminal` / `getScores`
/ `redactFor`). Offline and online share one `GameTransport` seam:
`LocalTransport` runs the engine in-process (hotseat + bots) while `WsTransport`
talks to server-authoritative rooms, with per-viewer redaction so hidden cards
never reach the client. Rules, tutorials, and learnability content ship inside
each game package, keeping the app free of game-specific logic.
