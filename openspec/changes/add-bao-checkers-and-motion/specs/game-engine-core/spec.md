# Spec Delta

## ADDED Requirements

### Requirement: Declared rule variants and difficulties
Game metadata SHALL declare the selectable rule variants (each with an id and display name), the variant default, and the supported difficulty tiers with their default. Game creation SHALL accept a partial config, merge it over the declared defaults, persist the resolved variant in state, and reject unknown variant or difficulty values.

#### Scenario: Defaults resolved from one contract
- **WHEN** a game is created with an empty config
- **THEN** the state SHALL use the variant and difficulty declared as defaults by that game module

#### Scenario: Unknown variant rejected
- **WHEN** a game is created with a variant id the module does not declare
- **THEN** creation SHALL fail with an error naming the unsupported variant and SHALL NOT produce a state

#### Scenario: Unknown difficulty rejected
- **WHEN** a game setup requests a difficulty outside the declared tiers
- **THEN** the system SHALL reject it rather than silently substituting another tier

#### Scenario: Variant travels with the match
- **WHEN** a game state is serialized and rehydrated
- **THEN** its rule variant SHALL be preserved and SHALL govern every later legal-move and reducer decision

#### Scenario: Non-variant games unchanged
- **WHEN** a game module that declares no variants is created
- **THEN** it SHALL behave exactly as before this change
