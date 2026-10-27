## 1. Project scaffold & tooling

- [x] 1.1 Initialize a Nuxt 4 app with `future.compatibilityVersion: 5` in `nuxt.config`
- [x] 1.2 Set up a workspace layout (`packages/*` + Nuxt `app/`, `server/`) with package manager workspaces (bun, acyclic DAG)
- [x] 1.3 Add dependencies (latest stable, verified compatible): `@vueuse/core`/`@vueuse/nuxt`, `@vueuse/motion`, `date-fns`, `@date-fns/tz`, `@nuxt/ui`, `v-tour-guide`, valibot, tailwindcss, tw-animate-css; self-hosted fonts via `@nuxt/fonts` (Inter, Bricolage Grotesque, Outfit, Fraunces+italic)
- [x] 1.4 Conduit (`@conduit/client`/`@conduit/server` 1.0.5) installed via JSR and wired in Group 6 as the optional WebRTC enhancement (`server/plugins/conduit.ts`, env-gated); install command in README
- [x] 1.5 Configure TypeScript 6, ESLint 10 + Prettier (integrated via eslint-config-prettier, stylistic off) and Vitest; add ESLint guard forbidding `Math.random`/`Date.now`/`new Date()` in `packages/engine-core` and `packages/game-*`
- [x] 1.6 Add base Nuxt UI setup, root layout, and a landing page listing available games (per-game accent fonts)
- [x] 1.7 Verify the app builds and runs (`dev` and `build` both green; fonts + icons resolve locally)

## 2. Engine core (`packages/engine-core`)

- [x] 2.1 Define the `GameModule` interface (`types.ts`): id, meta, defaultConfig, createInitialState, reducer, getLegalMoves, isTerminal, getScores, redactFor (+ Seat/Player/BaseGameState/BaseMove/ScoreResult)
- [x] 2.2 Implement a seeded PRNG (mulberry32, pure/serializable state) + seeded shuffle/deal utilities (`rng.ts`)
- [x] 2.3 Implement shared helpers: card/deck model with `<rank><suit>` sprite-id mapping (`cards.ts`), turn-order (`turn.ts`), generic move-applier with turn + legal-move validation and replay (`apply.ts`)
- [x] 2.4 Implement a game registry (`registry.ts`): registerGame/getGame/requireGame/listGames/clearGames
- [x] 2.5 Unit tests (27 passing): determinism, replay==incremental, seeded deal reproducibility, illegal + out-of-turn + terminal rejection, registry
- [x] 2.6 Verify standalone type-check with no DOM/framework lib (tsconfig excludes DOM) + determinism ESLint guard proven to fire on Math.random/Date.now/new Date()

## 3. Card presentation UI

- [x] 3.1 `DeckCards.svg` inlined once via `<CardSprite>` (?raw, symbols only); three card-back SVGs served from /public/cards as built-in backs
- [x] 3.2 `<PlayingCard>` renders a face via `<use href="#<suit><rank>">` (sprite id `c13` etc.) and a themed back from `useCardTheme`
- [x] 3.3 `<CardHand>` (responsive overlap via useElementSize, no overflow) + `<CardPile>` (stacked draw/discard/trump); touch-friendly buttons
- [x] 3.4 `@vueuse/motion` presets (`motionPresets.ts`: deal/play/pop/stagger) — transform/opacity only
- [x] 3.5 `usePreferredReducedMotion` gates hand/card motion; global reduced-motion CSS in main.css
- [x] 3.6 Verified via /cards-demo: all 52 faces render (`#c1`..`#d13`), themed backs, hand/pile layouts; build green
- [x] 3.7 (added) Client storage tiers: Dexie DB (`app/db.ts`: results/themeAssets/savedGames) + `useLiveQuery`; `useCardTheme` on localStorage; sessionStorage reserved for per-tab session state

## 4. Transport abstraction & local (offline) play

- [x] 4.1 `GameTransport` interface (`transports/types.ts`): getView/submitMove/onChange/presence/chat/players/destroy + TransportView
- [x] 4.2 `LocalTransport`: runs the reducer in-memory, hotseat (viewer follows active human seat), redacts per viewer
- [x] 4.3 Bots (`bot.ts`): prefer-progress legal-move picker, deterministic (no ambient RNG); drives bot seats with delay
- [x] 4.4 Game-view shell: `useGameSession` composable + `/play/[game]` lobby + `LastCardTable`/`AlbastiniTable`; games registered via `plugins/games.ts`; `GameRulesPanel` + `useGameContent`
- [x] 4.5 Verified end-to-end offline (no network): 6 LocalTransport tests + 2 full-playthrough-to-terminal tests (Last Card & Albastini). Caught+fixed Albastini endgame deadlock (trick completion + lead with empty hands)

## 5. Last Card game module (`packages/game-last-card`)

- [x] 5.1 52-card deck, dealing (default 7), starting discard with redraw-action-start rule
- [x] 5.2 Matching (suit/rank via `canPlay`), draw rule, turn passing
- [x] 5.3 Configurable action cards: pickup (+ stacking), skip, suit-change, optional reverse — all toggleable via config; plus `allowActionCardFinish` (caught real "can't go out on an action card" rule)
- [x] 5.4 "Last Card" call + missed-call penalty (awaitingCall window closes on next seat's action)
- [x] 5.5 Draw-pile exhaustion reshuffle (keeps top discard) via seeded PRNG
- [x] 5.6 Round win, penalty scoring (A=1,face=10,pip), single/cumulative match scoring (lowest wins)
- [x] 5.7 Last Card variant config + `lastCardRules` + `lastCardTutorial` content
- [x] 5.8 Unit tests — 15 covering every spec scenario (deal, matching, action cards, call/penalty, reshuffle, win, determinism, redaction). Playable view deferred to Group 4 (needs LocalTransport + card UI)

## 6. Rooms & realtime online (Nitro-native WS primary; Conduit optional)

- [x] 6.1 Realtime carrier: **Nitro-native WebSockets** (crossws, `experimental.websocket`, `server/routes/_ws.ts`) carry the room/game protocol with topic pub/sub. **Conduit** (WebRTC P2P + relay) kept as optional enhancement behind the same seam (`server/plugins/conduit.ts`, env-gated off by default). Decision recorded in design.
- [x] 6.2 Server-authoritative room/game state (`server/utils/roomHub.ts`): every move validated via engine `applyMove` before broadcast
- [x] 6.3 Per-recipient state redaction via `redactFor` (hide other seats' hands + draw-pile/stock identities; spectators public-only) — verified live (A sees own 7, 0 of B's)
- [x] 6.4 `WsTransport` (client) satisfies `GameTransport`; same table UI online & offline. (Conduit WebRTC transport is the optional future enhancement.)
- [x] 6.5 Rooms: `POST /api/rooms` create + shareable room id in URL, join/leave, seating, seat-limit, spectator entry
- [x] 6.5a Spectator access control: public vs locked visibility (set at create), distinct player vs spectator links (spectator link carries `&spectate=1&code=`), passcode-gated, server rejects unauthorized spectators with NO state streamed, host `set-visibility` toggle — all verified live + 4 unit tests
- [x] 6.6 Host controls: start (lobby→in-progress, min-player gate), end (→finished), host reassignment on leave/disconnect
- [x] 6.7 Presence (joined/connected/disconnected) in room snapshot; seat kept on disconnect for grace-period reconnect
- [x] 6.8 Game time tracking: room startedAt/endedAt ISO timestamps; chat timestamps via date-fns + @date-fns/tz in GameChat
- [x] 6.9 Verified: 7 RoomHub unit tests + live 2-client E2E (move propagation, hidden-hand redaction, illegal/out-of-turn rejection, locked-spectator denial with no leak, passcode admit)

## 7. Albastini game module (`packages/game-albastini`)

- [x] 7.1 36-card deck + trick strength (A>7>K>J>Q>6..3) and point values (A=11,7=10,K=4,J=3,Q=2,rest=0; 120 total) in `config.ts`
- [x] 7.2 Dealing (5 each), seating for 2/3/4/6 with team configs (scoringUnits by team)
- [x] 7.3 Bidding (otea) with distinct-suit constraint + trump determination (turn top stock; matching bidder claims indicator); fixed trump-reveal when bidding disabled
- [x] 7.4 Trick play (no follow-suit), resolution (highest trump else highest led suit), winner eats and leads
- [x] 7.5 Draw-to-refill (winner first, to 5) and exhausted-stock endgame
- [x] 7.6 Scoring + victory points for individual and team (2/3) play, tie = 0 VP
- [x] 7.7 `albastiniRules` + `albastiniTutorial` content (Swahili terms surfaced). Playable view deferred to Group 4 (transport + UI)
- [x] 7.8 Unit tests — 14 covering deck/ranking/points, deal/trump, bidding, trick resolution (incl. 7-beats-King), VP scoring, ties, determinism, redaction, out-of-turn

## 8. Theming & backgrounds

- [x] 8.1 Built-in card-back themes (three SVGs) + default table backgrounds, reactive store (`useCardTheme`)
- [x] 8.2 Runtime theme/background switching applied to `<PlayingCard>` + tables (live, no reload)
- [x] 8.3 User upload of custom card back / background with type + size validation (`useThemeUploads`, Dexie blobs, `ThemePicker`)
- [x] 8.4 Persist selected theme/background ids via `useLocalStorage`; uploaded blobs persist in Dexie; restored on return
- [x] 8.5 Verified: switching live; upload rejects bad type/size (toast); persistence across reload (build green)

## 9. Chat, leaderboard & learnability

- [x] 9.1 Per-room realtime chat (`GameChat`) over the transport (players + spectators), timestamps via date-fns + @date-fns/tz (TZDate)
- [x] 9.2 Chat length limit (500) + server-side guard; UI maxlength + trim (rate limiting hook in roomHub)
- [x] 9.3 Leaderboard (`useLeaderboard` + `recordResults`, Dexie results table): record on terminal state, aggregate per game, rank by wins then metric (Last Card -penalty, Albastini VP)
- [x] 9.4 Responsive per-game leaderboard UI (`GameLeaderboard`, stacks on mobile)
- [x] 9.5 `GameRulesPanel` slideover renders per-game `rulesContent`, accessible in lobby + mid-game without losing state
- [x] 9.6 `GameTutorial` via `v-tour-guide` renders per-game `tutorialSteps`: first-time offer (persisted per game), on-demand button, skippable
- [x] 9.7 Verified: chat over local + online E2E, leaderboard ranking logic, rules slideover, tutorial offer/launch; build + lint green

## 10. App-wide UX: notifications, settings, theme mode & i18n

- [x] 10.1 In-game event notifications (`useGameNotifications` → Nuxt UI toasts): turn start, suit change, pickup, Last Card call, win — driven by state deltas, gated by notifications pref
- [x] 10.2 Settings page (`/settings`): app-wide appearance (theme mode + `ThemePicker`), language, preferences (notifications/animations/sound via `usePreferences`), name. (Per-game variant config edited in each lobby.)
- [x] 10.3 Dark/light mode (`useThemeMode`) with View Transitions API random reveals (circle/fade/slide/iris from click point), anime.js cross-fade fallback, instant on reduced-motion; toggle in layout
- [x] 10.4 i18n via `nuxt-i18n-micro` (en + sw), localeCookie persisted, locale switcher in layout + settings; UI translated (home/settings/layout/play key strings); authentic Albastini Swahili surfaced (Dume/Jike/Mzungu/Ngarasha/Kula/Otea/Ndoa); trump = "Mchezo" (user choice). Resolved h3/@nuxt/test-utils build conflict.

## 11. Cross-cutting polish & verification

- [x] 11.1 Responsive pass: mobile-first layouts throughout — `CardHand` overlap adapts via useElementSize, grids stack (`md:` breakpoints), nav links hide on small screens, no horizontal overflow
- [x] 11.2 Animation/memory budget: transform/opacity only, sprite symbols injected once + reused via `<use>`, reduced-motion gates all motion (`usePreferredReducedMotion` + global CSS + `anim.ts` no-op)
- [x] 11.2a Animation engine decision record written (`docs/decisions/animation-library.md`): @vueuse/motion (transitions) + Anime.js v4 (events) + View Transitions (theme); Three.js rejected (3D/memory); integrated behind `app/utils/anim.ts`
- [x] 11.2b Anime.js polish integrated: `celebrate` (win), `suitFlourish` (suit change) wired in tables; `dealIn`/`sweepTrick`/`playCard` helpers available; all reduced-motion aware
- [x] 11.3 Reconnection/disconnection: hub keeps seat on disconnect for grace-period reconnect, host reassignment; spectator-cannot-move enforced (verified live: spectators denied moves, locked spectators get no state)
- [x] 11.4 Full suite green: 71 tests (engine 27, Last Card 15, Albastini 14, transport 6, room-hub 7, playthrough 2) + standalone type-check + live online E2E
- [x] 11.5 README updated (features, online play, Conduit env flags, i18n); `openspec validate` passes
