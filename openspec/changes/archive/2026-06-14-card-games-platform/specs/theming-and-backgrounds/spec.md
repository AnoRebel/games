## ADDED Requirements

### Requirement: Built-in themes
The system SHALL ship built-in card-back and table/background themes derived from the provided SVG assets (the three card-back SVGs in `dev_materials/` as card-back themes, plus default table backgrounds). Card faces SHALL render from the `DeckCards.svg` sprite. Users SHALL be able to switch themes at runtime.

#### Scenario: Switch built-in theme at runtime
- **WHEN** a user selects a different built-in card-back theme
- **THEN** the card backs SHALL update immediately without reloading the game

### Requirement: User-uploaded themes
The system SHALL allow users to upload their own card-back image and table/background image to use as custom themes. Uploaded assets SHALL be validated (type and size) and applied like built-in themes.

#### Scenario: Apply an uploaded card back
- **WHEN** a user uploads a valid image as a card back and selects it
- **THEN** the game SHALL render card backs using the uploaded image

#### Scenario: Reject invalid upload
- **WHEN** a user uploads a file that is not a supported image type or exceeds the size limit
- **THEN** the system SHALL reject it and report why, leaving the current theme unchanged

### Requirement: Theme persistence
The system SHALL persist a user's selected theme and backgrounds (e.g. via local storage) so the choice is restored on return.

#### Scenario: Theme restored on return
- **WHEN** a user who previously selected a theme returns to the app
- **THEN** their selected card back and background SHALL be restored automatically
