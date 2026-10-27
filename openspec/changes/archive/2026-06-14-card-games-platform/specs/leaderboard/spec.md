## ADDED Requirements

### Requirement: Per-game leaderboard
The system SHALL maintain a leaderboard per game that aggregates finished-match results (wins, games played, and game-appropriate scoring such as victory points or lowest cumulative score) and ranks players accordingly.

#### Scenario: Result recorded on game end
- **WHEN** a game finishes with recorded final scores
- **THEN** the system SHALL update each participating player's leaderboard entry for that game

#### Scenario: Ranking reflects results
- **WHEN** a user views a game's leaderboard
- **THEN** players SHALL be listed in ranked order according to that game's leaderboard metric

### Requirement: Leaderboard display
The leaderboard SHALL be viewable in the UI per game, showing rank, player, and key stats, and SHALL be responsive on mobile.

#### Scenario: Mobile leaderboard
- **WHEN** a user opens a leaderboard on a small screen
- **THEN** it SHALL render readably without horizontal overflow
