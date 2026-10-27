# Spec Delta

## ADDED Requirements

### Requirement: Room variant and difficulty configuration
Room creation SHALL accept a game id, rule variant, and difficulty, SHALL validate them against the game module's declared variants and tiers, and SHALL reject unsupported combinations with an error naming the invalid value. A missing variant or difficulty SHALL resolve to the game's declared default. The resolved values SHALL be stored in the room config.

#### Scenario: Valid configuration stored
- **WHEN** a host creates a Bao room with `bao-la-kujifunza` and `hard`
- **THEN** the room SHALL store those values and use them when the game starts

#### Scenario: Defaults applied
- **WHEN** a host creates a checkers room without choosing a variant
- **THEN** the room SHALL use `drafti` and the default difficulty

#### Scenario: Unsupported variant rejected
- **WHEN** a room is requested with a variant the game does not declare
- **THEN** creation SHALL fail with an error naming the unsupported variant and SHALL NOT create the room

#### Scenario: Unsupported difficulty rejected
- **WHEN** a room is requested with a difficulty outside the game's declared tiers
- **THEN** creation SHALL fail with an error naming the invalid difficulty

### Requirement: Variant visibility and immutability
The room SHALL show its selected game and rule variant in the lobby, SHALL apply the stored variant for the entire match, and SHALL preserve it across reconnection, server rehydration, and rematch. Changing the variant SHALL require creating a new room or a rematch from the lobby.

#### Scenario: Lobby shows variant
- **WHEN** a player is in a room lobby
- **THEN** the lobby SHALL display the game name and selected rule variant

#### Scenario: Variant survives rehydration
- **WHEN** a persisted room is reloaded on the server
- **THEN** the match SHALL resume with the same rule variant and difficulty

#### Scenario: Rematch keeps variant
- **WHEN** the host starts a rematch
- **THEN** the new game SHALL use the same rule variant and difficulty unless the host changes them from the lobby

#### Scenario: Mid-game change refused
- **WHEN** a request tries to change the rule variant of an in-progress room
- **THEN** the system SHALL reject the change and keep the current variant

### Requirement: Seat limits follow the game module
Room capacity and start requirements SHALL come from the game module's declared player counts. Bao and Checkers rooms SHALL allow exactly two seated players, and spectator limits SHALL remain independent of seat limits.

#### Scenario: Two-seat room is full
- **WHEN** two players have taken the seats in a Bao or Checkers room and a third tries to join as a player
- **THEN** the third SHALL be rejected as a player and offered spectating where allowed

#### Scenario: Start requires both seats
- **WHEN** a Bao or Checkers host tries to start with fewer than two seated players
- **THEN** the room SHALL refuse to start and report the unmet requirement

### Requirement: Difficulty applies only to bot seats
The room's difficulty SHALL govern only seats filled by a bot. Human seats SHALL always be human-controlled, and a room with no bot seats SHALL be unaffected by the difficulty setting.

#### Scenario: Human room ignores difficulty
- **WHEN** a room with two human players starts at `easy`
- **THEN** neither player's moves SHALL be assisted or altered

#### Scenario: Bot seat uses room difficulty
- **WHEN** a room starts with a seat filled by a bot
- **THEN** that bot SHALL play at the room's selected difficulty

### Requirement: Offline and online setup parity
The same game, variant, and difficulty choices SHALL be available offline and online, and the setup UI SHALL present them identically. A game started offline with a configuration SHALL be replayable with the same configuration online.

#### Scenario: Identical choices
- **WHEN** a player opens setup for Bao or Checkers offline and online
- **THEN** both SHALL offer the same rule variants and difficulty tiers with the same defaults

#### Scenario: Same configuration replays
- **WHEN** the same game, variant, seed, and move sequence are played offline and online
- **THEN** both paths SHALL produce the same final state
