# Spec Delta

## ADDED Requirements

### Requirement: Per-game ranking metric
The system SHALL declare one explicit ranking metric per game and use it for aggregation and ordering: Last Card by lowest cumulative penalty, Albastini by victory points, and Bao and Checkers by match wins. All rule variants of a game SHALL share that game's leaderboard. Difficulty SHALL NOT affect any leaderboard value.

#### Scenario: Bao win recorded
- **WHEN** a Bao match finishes with a winning seat
- **THEN** the winner SHALL gain a win for Bao and both players SHALL gain a game played

#### Scenario: Checkers win recorded
- **WHEN** a checkers match finishes with a winning seat
- **THEN** the winner SHALL gain a win for Checkers and both players SHALL gain a game played

#### Scenario: Variants share one board
- **WHEN** a player wins Drafti and later an International draughts match
- **THEN** both results SHALL count on the same Checkers leaderboard

#### Scenario: Difficulty does not affect standing
- **WHEN** a player wins against a `hard` bot and later against an `easy` bot
- **THEN** both wins SHALL count equally

#### Scenario: Existing games unchanged
- **WHEN** Last Card and Albastini results are recorded after this change
- **THEN** their existing penalty and victory-point metrics SHALL apply exactly as before

### Requirement: Draw and result attribution
A drawn match SHALL count as a draw for both players and as a game played, without crediting a win. A match ended by the host without a natural result SHALL NOT change any standing. Only matches finished under the game's own win or draw rules SHALL be recorded.

#### Scenario: Draw recorded
- **WHEN** a checkers match ends by a draw rule
- **THEN** both players SHALL receive a draw and a game played, and neither SHALL receive a win

#### Scenario: Host-ended match excluded
- **WHEN** a host ends a game before a natural result
- **THEN** no player's leaderboard SHALL change

#### Scenario: Winner attribution
- **WHEN** a match finishes under the engine's win condition
- **THEN** the leaderboard SHALL credit exactly the winning seat or seats returned by the engine

### Requirement: Recorded match provenance
Every recorded result SHALL store the game id, the rule variant id, and the bot difficulty used, with an explicit `none` when no bot was present. Values SHALL come from the room or offline setup that produced the match and SHALL NOT be editable after the match.

#### Scenario: Offline bot match provenance
- **WHEN** a player finishes an offline Drafti match against a hard bot
- **THEN** the recorded result SHALL store the Checkers game id, the `drafti` variant, and the `hard` difficulty

#### Scenario: Human-only match provenance
- **WHEN** a match finishes with no bot seats
- **THEN** the recorded difficulty SHALL be `none` and the variant SHALL still be recorded

#### Scenario: Provenance is not client-editable
- **WHEN** a client submits a finished match result
- **THEN** the stored variant and difficulty SHALL be those of the actual match, not values supplied after the fact

### Requirement: Leaderboard ordering for win-based games
Bao and Checkers leaderboards SHALL rank players by wins descending, then by win rate descending, then by games played ascending. Ties after those keys SHALL be ordered by player name for stable display.

#### Scenario: More wins ranks higher
- **WHEN** one player has more wins than another on the same game
- **THEN** the player with more wins SHALL rank higher

#### Scenario: Win rate breaks a win tie
- **WHEN** two players have the same number of wins
- **THEN** the higher win rate SHALL rank higher

#### Scenario: Stable tie order
- **WHEN** two players are equal on wins, win rate, and games played
- **THEN** they SHALL be ordered by name so the display is stable

### Requirement: Leaderboard shows the active metric
The leaderboard UI SHALL label which metric the game ranks by, SHALL show wins, draws, losses, and games played for win-based games, and SHALL keep the existing penalty and victory-point columns for the card games.

#### Scenario: Checkers columns
- **WHEN** a user opens the Checkers leaderboard
- **THEN** it SHALL label the ranking as wins and show wins, draws, losses, and games played

#### Scenario: Card-game columns
- **WHEN** a user opens the Last Card or Albastini leaderboard
- **THEN** it SHALL keep that game's existing metric and columns

#### Scenario: Mobile display
- **WHEN** a leaderboard with the new columns is opened on a small screen
- **THEN** it SHALL remain readable without horizontal overflow

### Requirement: Leaderboard shows game, variant, and difficulty
The leaderboard SHALL show the game name, rule variant, and difficulty used for each recorded play in a per-play history displayed with the aggregated standings. Results recorded before this change SHALL show unknown provenance rather than being dropped or misattributed.

#### Scenario: History row labels
- **WHEN** a user opens the Checkers leaderboard after an offline Drafti match against a hard bot
- **THEN** the play history SHALL show `Checkers`, `Drafti`, and `Hard` for that play

#### Scenario: Human-only play
- **WHEN** a recorded play had no bot seats
- **THEN** its history row SHALL show the game and variant and SHALL display the difficulty as not applicable

#### Scenario: Legacy results
- **WHEN** a result recorded before this change is displayed
- **THEN** its missing variant or difficulty SHALL be shown as unknown and the result SHALL still count in the standings

#### Scenario: Mobile history
- **WHEN** the play history is opened on a small screen
- **THEN** the game, variant, difficulty, result, and date SHALL remain readable without horizontal overflow

### Requirement: Per-game experience tiers
The leaderboard SHALL show both bot difficulty and a player's per-game experience tier: New for 0–9 completed plays, Regular for 10–49, and Veteran for 50 or more. Tiers SHALL measure experience, not skill, and SHALL NOT affect standings. History SHALL snapshot the tier after recording the completed play; legacy snapshots SHALL be shown as unknown.

#### Scenario: Tier boundary
- **WHEN** a player completes their tenth Checkers match
- **THEN** their Checkers tier and that result's snapshot SHALL be Regular, independently of their Bao play count

#### Scenario: Independent level fields
- **WHEN** a Veteran plays Drafti against a hard bot
- **THEN** the history SHALL show both Veteran and Hard, without treating one as the other

#### Scenario: Historical stability
- **WHEN** a player later reaches Veteran
- **THEN** earlier history rows SHALL retain their recorded tier snapshots
