# Games

**Games** (Swahili: **Michezo**) is a modular multiplayer games platform. It
ships two card games — **Last Card** (shedding) and **Albastini**
(trick-taking) — and two board games — **Bao** (East African mancala) and
**Checkers** (Drafti, English/American and International) — on a shared,
game-agnostic engine with offline (local) and realtime online multiplayer,
bot opponents, rooms, spectators, theming, chat, leaderboards, and per-game
tutorials.

## Features

- **Four games**: Last Card (shedding), Albastini (Tanzanian trick-taking),
  Bao and Checkers, each on a shared, pure, deterministic engine. See
  [Game rules](#game-rules).
- **Rule variants**: each game declares its variants and a default — Bao la
  Kiswahili or Bao la Kujifunza; Drafti, English/American or International
  checkers. The setup dialog, room lobby and rules panel show the chosen one.
- **Bot opponents** at three strengths (easy, normal, hard). The board-game
  bots search deterministically, so the same position always gets the same
  move; see [docs/bots.md](docs/bots.md).
- **Offline & online multiplayer** behind one transport seam — hotseat + bots
  offline; realtime, server-authoritative rooms online, where the server can
  fill seats with bots.
- **Rooms**: create/join, shareable links, seating, host start/end, presence;
  the host picks the variant, bot seats and bot strength before the game
  starts.
- **Spectators** with access control — public rooms or **locked** rooms that
  require a passcode (distinct player vs spectator links).
- **Themes**: built-in + user-uploaded card backs and table backgrounds, and
  scene themes (Felt, Arcade, Neon, or your own colours) that restyle boards
  and tables with contrast checked against WCAG AA.
- **Boards that fit phones**: Bao and Checkers boards scale to the screen,
  with a zoom mode, keyboard play, move hints and screen-reader announcements.
- **Per-room chat**, per-game **leaderboards** (standings plus recent plays
  with variant, bot strength and experience tier), **tutorials** and an
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

### Bao

A mancala game for two on a board of 4 rows of 8 pits; each player owns the two
rows nearest them and sows only around their own 16 pits. Sow seeds one at a
time; a last seed landing in an occupied pit is picked up and sown on
(**relay**). Ending in an occupied front pit facing a non-empty enemy pit
**captures** that pit, and the captured seeds are sown again from a **kichwa**
(end pit). Capturing is compulsory. You win when your opponent's front row is
empty, or when they cannot move.

| Variant                        | Setup                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Bao la Kiswahili** (default) | 6 seeds in the **nyumba** (house), 2 in each of the two pits beside it, 22 in reserve per player |
| **Bao la Kujifunza**           | 2 seeds in every pit, no reserve, no nyumba — play starts from the board                         |

In Bao la Kiswahili each turn of the opening (**namua**) places one reserve
seed first; once both reserves are empty play moves to **mtaji**, sowing from
the board. A working nyumba (6+ seeds) can stop a sowing or send it on
**safari**. A turn that sows more than 192 seeds and still has to relay is
endless, and the player making it loses.

**Scope.** This is Bao la Kiswahili as played in Zanzibar, following Alex de
Voogt's description. Two disputed optional rules are not used: blocking a pit
(**kutakatia**) and taking two seeds from the nyumba as a tax.

### Checkers

Played on the dark squares; men move diagonally forward, capturing is
compulsory, and a man reaching the far row becomes a king. Win by taking every
enemy piece or leaving your opponent without a move.

| Variant              | Board | Kings                 | Men capture      | Capture choice     | Draws                                                                                      |
| -------------------- | ----- | --------------------- | ---------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| **Drafti** (default) | 8×8   | flying (any distance) | forward only     | any capture        | 1 v 1 or 2 v 2 kings; 3 kings v 1 within 12 moves; threefold repetition                    |
| **English/American** | 8×8   | one square            | forward only     | any capture        | threefold repetition; 40 moves each with no capture or man move                            |
| **International**    | 10×10 | flying (any distance) | forward and back | must take the most | threefold repetition; 25 king-only moves each; king v king; short endgames within 16 moves |

A capture sequence, once started, must be completed. In International
draughts jumped pieces stay on the board until the move ends, and a man is
crowned only when its move stops on the far row.

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
- **LibSQL** (SQLite-compatible) for the global leaderboard and room snapshots
- **Vitest** for tests, **bunwright** for browser smoke checks

## Repository layout (bun workspaces)

```
packages/
  engine-core/      # @games/engine-core — pure, deterministic engine contract (variants, setup, scoring)
  game-last-card/   # @games/game-last-card — Last Card rules
  game-albastini/   # @games/game-albastini — Albastini rules
  game-bao/         # @games/game-bao — Bao rules (both variants)
  game-checkers/    # @games/game-checkers — Checkers rules (three variants)
  game-ai/          # @games/game-ai — bot policies for every game
app/                # Nuxt app (pages, components, composables, transports, UI)
server/             # Nitro: rooms, server bots, leaderboard, Conduit signaling/relay
shared/             # rules shared by app and server (leaderboard ranking and tiers)
site.config.ts      # product name and site identity
docs/               # bots, design decisions, operations
scripts/smoke/      # browser smoke checks against a running build
```

The dependency graph is a DAG: `engine-core` is a leaf (no deps); games depend
only on `engine-core`; `game-ai` depends on the games; the app and server
depend on all of them. Engine and game packages
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

## Data and the rename

The product was renamed from Card Games to Games. Saved data moves to the new
identifiers automatically — browser data on each player's first visit, and the
server's default database to `data/games.db` at start-up, after a verified
backup. See
[docs/operations/database-migration.md](docs/operations/database-migration.md)
for what happens, how to back up first, and how to roll back.

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
Otea), and Bao uses its own (nyumba, kichwa, kimbi, namua, mtaji, safari).
Translations live in `locales/`.

## Quality

```bash
bun run test          # run the Vitest suite (engine + games + bots + platform)
bun run test:bench    # bot strength benchmark only
bun run lint          # ESLint (includes the engine determinism guard)
bun run format:check  # Prettier
bun run typecheck     # vue-tsc type-check
```

Browser smoke checks run against a running build (`bun run build`, then
`node .output/server/index.mjs`); point them at it with `SMOKE_BASE`:

```bash
SMOKE_BASE=http://localhost:3000 bun run smoke:integration  # offline + online play, rename, leaderboard
bun run smoke:boards        # board layout, zoom, keyboard and hints
bun run smoke:themes        # scene themes and contrast
bun run smoke:leaderboard   # standings and history
```

## Architecture notes

Each game is a self-contained module implementing the engine contract
(`createInitialState` / `reducer` / `getLegalMoves` / `isTerminal` / `getScores`
/ `redactFor`). Offline and online share one `GameTransport` seam:
`LocalTransport` runs the engine in-process (hotseat + bots) while `WsTransport`
talks to server-authoritative rooms, with per-viewer redaction so hidden cards
never reach the client. Rules, tutorials, and learnability content ship inside
each game package, keeping the app free of game-specific logic. Each game
declares its rule variants and bot difficulties in its metadata; one shared
setup resolver validates a chosen variant and difficulty for offline games
and online rooms alike.
