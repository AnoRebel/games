## ADDED Requirements

### Requirement: Interactive in-game tutorial
Each game SHALL provide an interactive in-game tutorial built with the `v-tour-guide` package that walks a new player through the interface and core actions (e.g. seating, the table layout, making a move, special cards/tricks, ending a turn). The tutorial SHALL be launchable on demand and offered to first-time players, and SHALL be dismissible/skippable at any step.

#### Scenario: First-time player offered the tutorial
- **WHEN** a player opens a game they have not played before
- **THEN** the system SHALL offer to start the interactive `v-tour-guide` tutorial for that game

#### Scenario: Tutorial launchable on demand
- **WHEN** a player triggers the tutorial control during a game
- **THEN** the `v-tour-guide` walkthrough SHALL start and guide them step-by-step through the interface and core actions

#### Scenario: Tutorial skippable
- **WHEN** a player chooses to skip or close the tutorial at any step
- **THEN** the tutorial SHALL end immediately and return the player to normal play

### Requirement: Easy-access rules / how-to-play
Each game SHALL expose an always-accessible "Rules / How to Play" panel reachable from within the game and the lobby, summarizing setup, turn flow, special cards/tricks, scoring, and win conditions for that specific game. The panel SHALL be openable without leaving or disrupting the current game.

#### Scenario: Open rules without leaving the game
- **WHEN** a player opens the "Rules / How to Play" panel mid-game
- **THEN** the rules for the current game SHALL be displayed in an overlay and the game state SHALL be preserved when it is closed

#### Scenario: Rules available in the lobby
- **WHEN** a player is in a room lobby before the game starts
- **THEN** the "Rules / How to Play" panel for that game SHALL be accessible

### Requirement: Per-game learnability content
Tutorial steps and rules content SHALL be defined per game module so each game ships its own accurate tutorial and rules, and adding a new game includes adding its learnability content.

#### Scenario: Game ships its own rules
- **WHEN** the Albastini game is loaded
- **THEN** the rules panel and tutorial SHALL present Albastini-specific content (trick-taking, bidding, trump, scoring), not generic or Last Card content
