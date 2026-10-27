# Spec Delta

## MODIFIED Requirements

### Requirement: Per-game learnability content
Tutorial steps and rules content SHALL be defined per game module and per declared rule variant, so each game ships its own accurate tutorial and rules, and adding a new game or variant includes adding its learnability content.

#### Scenario: Game ships its own rules
- **WHEN** the Albastini game is loaded
- **THEN** the rules panel and tutorial SHALL present Albastini-specific content (trick-taking, bidding, trump, scoring), not generic or Last Card content

#### Scenario: Variant ships its own content
- **WHEN** a player switches a game from one rule variant to another
- **THEN** the rules panel and tutorial SHALL present that variant's content rather than the previous variant's or generic content

## ADDED Requirements

### Requirement: Variant-aware rules content
The rules panel SHALL describe the currently selected rule variant, including its board, setup, turn flow, compulsory-move rules, promotion or nyumba rules, draw/win conditions, and how it differs from the game's other variants. Content SHALL update when the variant changes and SHALL NOT require leaving the game.

#### Scenario: Bao default rules
- **WHEN** a player opens the rules panel for Bao la Kiswahili
- **THEN** it SHALL describe the 4×8 board, reserve seeds, namua and mtaji phases, compulsory captures, the nyumba, and the two win conditions

#### Scenario: Bao learner rules
- **WHEN** a player opens the rules panel for Bao la Kujifunza
- **THEN** it SHALL state that every pit starts with two seeds and that there is no reserve, no nyumba, and no namua phase

#### Scenario: Checkers variant differences
- **WHEN** a player opens the rules panel for Drafti, English/American, or International
- **THEN** it SHALL state that variant's board size, king behaviour, capture directions, maximal-capture rule, promotion timing, and draw rules

#### Scenario: Difficulty explained
- **WHEN** a player opens the rules or setup help for a game with bots
- **THEN** the difference between `easy`, `normal`, and `hard` SHALL be explained in player terms

### Requirement: Variant-aware interactive tutorial
Each game and variant SHALL provide tutorial steps that teach its own board and core actions. Bao tutorials SHALL cover sowing, relay, compulsory capture, reserve placement, and the nyumba; checkers tutorials SHALL cover forward movement, compulsory capture, multi-capture, kings, and promotion. Switching variants SHALL restart the tutorial with the new variant's steps.

#### Scenario: Bao tutorial
- **WHEN** a first-time player starts the Bao tutorial
- **THEN** the walkthrough SHALL teach sowing around the player's own rows, relay sowing, and compulsory capture on the actual board

#### Scenario: Checkers tutorial
- **WHEN** a first-time player starts a checkers tutorial
- **THEN** the walkthrough SHALL teach forward movement, capture selection, multi-capture, and promotion on that variant's board

#### Scenario: Variant switch resets tutorial content
- **WHEN** a player changes the rule variant and starts the tutorial
- **THEN** the steps SHALL match the newly selected variant

### Requirement: Bilingual learnability content
Rules and tutorial content for every game and variant SHALL be available in English and Swahili, and SHALL use the active locale without falling back to the other language for game-specific rules.

#### Scenario: Swahili rules
- **WHEN** the active locale is Swahili and a player opens the rules panel
- **THEN** the game and variant rules SHALL be shown in Swahili

#### Scenario: English rules
- **WHEN** the active locale is English and a player opens the rules panel
- **THEN** the game and variant rules SHALL be shown in English

#### Scenario: No mixed-language fallback
- **WHEN** a locale is missing a specific rule line
- **THEN** the panel SHALL report the missing content rather than silently showing the other language for that line
