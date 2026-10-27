# game-rooms Specification

## Purpose

Defines room lifecycle and management: room creation and joining, host assignment and controls, spectator mode and access control, and game time tracking.

## Requirements

### Requirement: Room creation and joining
The system SHALL let a player create a room for a chosen game with selected variant/config, producing a shareable room id/code. Other players SHALL be able to join an open room as a player up to the game's seat limit, or join as a spectator. Joining a full or in-progress room as a player SHALL be rejected (with a fallback to spectate where allowed).

#### Scenario: Create and share a room
- **WHEN** a player creates a Last Card room with a chosen variant
- **THEN** the system SHALL create the room in a "lobby" state and return a shareable room code

#### Scenario: Join up to seat limit
- **WHEN** a room already has the maximum number of seated players and another player tries to join as a player
- **THEN** the system SHALL reject the player seat and offer spectator entry instead

### Requirement: Host assignment and controls
Each room SHALL have a host (default: the creator). The host SHALL be able to start the game (only from lobby, only when seat/minimum requirements are met) and end the game at any time. If the host leaves, the system SHALL reassign the host to another seated player.

#### Scenario: Host starts the game
- **WHEN** the host presses Start in a room that meets the minimum player count
- **THEN** the room SHALL transition from "lobby" to "in-progress" and the engine SHALL deal the initial state

#### Scenario: Start blocked below minimum
- **WHEN** the host presses Start but fewer than the game's minimum players are seated
- **THEN** the system SHALL refuse to start and report the unmet requirement

#### Scenario: Host ends the game
- **WHEN** the host ends the game
- **THEN** the room SHALL transition to "finished", final scores SHALL be recorded, and the result SHALL be eligible for the leaderboard

#### Scenario: Host reassignment on leave
- **WHEN** the host leaves a room that still has seated players
- **THEN** the system SHALL assign host to another seated player

### Requirement: Spectator mode
The system SHALL allow spectators to watch a room in realtime without affecting play. Spectators SHALL receive the public game state (no hidden hands of other players) and SHALL NOT be able to submit game moves.

#### Scenario: Spectator sees public state only
- **WHEN** a spectator views an in-progress game
- **THEN** they SHALL see the table, discards/tricks, and counts but SHALL NOT see other players' hidden hands, and SHALL be unable to make moves

### Requirement: Spectator access control
When creating a room, the host SHALL configure spectator visibility as either **public** (anyone with the spectator link may watch) or **locked** (watching requires authorization). For a locked room, the system SHALL gate spectator entry behind authorization — a spectator passcode carried by the spectator link and/or per-request host approval. The server SHALL reject unauthorized spectator connections to a locked room and MUST NOT stream any game state to them. The player invite link and the spectator link SHALL be distinct, and the host SHALL be able to change spectator visibility while the room is open.

#### Scenario: Public room lets anyone spectate
- **WHEN** a room is configured public and a user opens its spectator link
- **THEN** they SHALL be admitted as a spectator and receive the public game state

#### Scenario: Locked room rejects unauthorized spectators
- **WHEN** a room is configured locked and a user attempts to spectate without valid authorization (no/incorrect passcode and no host approval)
- **THEN** the system SHALL deny entry and SHALL NOT send them any game state

#### Scenario: Locked room admits authorized spectators
- **WHEN** a user opens a locked room's spectator link carrying the correct passcode (or is approved by the host)
- **THEN** they SHALL be admitted as a spectator with public-state-only access

#### Scenario: Host changes visibility
- **WHEN** the host switches a room from public to locked while it is open
- **THEN** new spectator connections SHALL require authorization from that point on

### Requirement: Game time tracking
Each room SHALL track timing: game start time, end time, and total elapsed duration, using date-fns and `@date-fns/tz` for all time computation and timezone handling.

#### Scenario: Duration recorded
- **WHEN** a game ends
- **THEN** the room SHALL record start time, end time, and elapsed duration computed via date-fns
