# Spec Delta

## ADDED Requirements

### Requirement: Scene theme roles and coverage
The system SHALL apply one scene theme to every game scene, including card tables and 4×8, 8×8, and 10×10 boards. A scene theme SHALL define values for the scene surface, board light and dark cells, pit and cell borders, own and opponent pieces or seeds, accent and highlight, and scene text, for both light and dark color modes.

#### Scenario: Every game is themed
- **WHEN** any game table, Bao board, or checkers board is displayed
- **THEN** every scene surface and board element SHALL take its colors from the active scene theme

#### Scenario: Light and dark coverage
- **WHEN** the active color mode switches between light and dark
- **THEN** the scene SHALL use that mode's theme values without unthemed elements

#### Scenario: New game inherits theming
- **WHEN** a new game board is added
- **THEN** it SHALL render with the active scene theme using the shared roles and SHALL NOT require a bespoke palette in every theme

### Requirement: Built-in scene themes
The system SHALL ship at least three complete built-in scene themes — Felt, Arcade, and Neon — each with a full palette for every role and both color modes. Users SHALL switch built-in themes at runtime and the scene SHALL update without reloading or losing game state. Felt SHALL be the default for new users.

#### Scenario: Complete built-in themes
- **WHEN** each built-in theme is activated
- **THEN** it SHALL provide a value for every scene role in both color modes

#### Scenario: Runtime switch
- **WHEN** a player switches from one built-in theme to another mid-game
- **THEN** the table and board SHALL update immediately with the game still in progress

#### Scenario: Default theme
- **WHEN** a user with no saved theme opens a game
- **THEN** the Felt scene theme SHALL be active

### Requirement: Custom scene theme editor
Users SHALL be able to create, name, preview, save, edit, and delete custom scene themes. The editor SHALL expose every scene role, SHALL preview the theme on both a card table and a board before saving, and SHALL allow activating a saved theme at any time.

#### Scenario: Create with live preview
- **WHEN** a user changes a scene role in the custom theme editor
- **THEN** the preview SHALL update immediately for the current color mode

#### Scenario: Edit an active theme
- **WHEN** a user edits the currently active custom theme and saves
- **THEN** the open game scene SHALL update without a reload

#### Scenario: Multiple custom themes
- **WHEN** a user saves several custom themes
- **THEN** each SHALL keep its name and palette and SHALL be individually selectable

#### Scenario: Delete a theme
- **WHEN** a user deletes a saved custom theme
- **THEN** it SHALL disappear from the list and the active scene SHALL fall back to Felt if that theme was active

### Requirement: Custom theme validation
Custom themes SHALL be validated before saving. Colors SHALL be valid CSS colors, names SHALL be non-empty and unique, at most 20 custom themes SHALL be stored, and text, highlight, and piece pairings SHALL meet WCAG AA contrast — at least 4.5:1 for text and 3:1 for graphical objects — in every color mode the theme renders in. A rejected save SHALL report the reason and SHALL leave the previous theme active.

#### Scenario: Invalid color rejected
- **WHEN** a user enters a value that is not a valid CSS color
- **THEN** the save SHALL be rejected and the role SHALL keep its previous value

#### Scenario: Low contrast rejected
- **WHEN** a palette would render text or pieces below the required contrast in one color mode
- **THEN** the save SHALL be rejected with the failing pairing identified

#### Scenario: Duplicate name rejected
- **WHEN** a user saves a custom theme with an existing theme name
- **THEN** the save SHALL be rejected and the existing theme SHALL be unchanged

#### Scenario: Storage limit
- **WHEN** a user tries to exceed the custom theme limit
- **THEN** the system SHALL refuse the new theme and explain that an existing theme must be deleted first

### Requirement: Theme persistence and viewer locality
Custom scene themes, a global default, and per-game selections SHALL persist locally per user and restore on return. A game's selection SHALL override the global default. In online rooms, themes SHALL remain viewer-local and SHALL NOT be sent to other players or the server.

#### Scenario: Theme restored
- **WHEN** a returning user opens the site
- **THEN** their saved custom themes and previously active scene theme SHALL be restored

#### Scenario: Themes are not shared
- **WHEN** a player changes their scene theme during an online game
- **THEN** only that player's view SHALL change and no theme data SHALL be broadcast to the room

#### Scenario: Spectator theme
- **WHEN** a spectator watches a room
- **THEN** the board SHALL render with the spectator's own active scene theme

#### Scenario: Per-game selection
- **WHEN** a user assigns Neon to Bao and Felt to Checkers
- **THEN** each game SHALL restore its assigned theme, while unassigned games use the global default

#### Scenario: Remove an assignment
- **WHEN** a user clears a game's theme assignment or deletes its assigned custom theme
- **THEN** that game SHALL use the global default, or Felt if the global default is unavailable

### Requirement: Theme fallback and robustness
If a stored custom theme is corrupt or missing a role, the scene SHALL fall back to the built-in default for that role and remain fully playable. A missing or invalid active theme SHALL never leave a scene unstyled or unreadable.

#### Scenario: Corrupt stored theme
- **WHEN** a stored custom theme cannot be parsed
- **THEN** the scene SHALL render with the built-in default palette and report the theme as unavailable

#### Scenario: Missing role
- **WHEN** a custom theme omits a role
- **THEN** that role SHALL use the built-in default while all other custom roles still apply

#### Scenario: Game stays playable
- **WHEN** a theme fallback occurs mid-game
- **THEN** the game state, moves, and inputs SHALL be unaffected

### Requirement: Theme-safe state cues
Scene themes SHALL NOT be the only carrier of game state. Selection, legal destinations, captures, last move, nyumba, kings, and the active turn SHALL remain distinguishable by shape, icon, pattern, or label as well as color, and SHALL remain distinguishable in grayscale.

#### Scenario: Grayscale cues
- **WHEN** an active scene theme is viewed in grayscale
- **THEN** legal destinations and captures SHALL still be distinguishable from ordinary cells

#### Scenario: King and nyumba cues
- **WHEN** a theme sets unusual colors
- **THEN** kings and the nyumba SHALL still carry their non-color markers

#### Scenario: Contrast for hints
- **WHEN** a custom theme is applied
- **THEN** legal-move and last-move highlights SHALL meet the graphical contrast requirement against their cells

### Requirement: Existing card theming preserved
Card-back themes and uploaded card-back or background images SHALL remain selectable and SHALL compose with scene themes. Upload validation for type and the 3 MB size limit SHALL continue to apply.

#### Scenario: Uploaded background still works
- **WHEN** a user selects an uploaded table background
- **THEN** it SHALL render behind the themed scene as before

#### Scenario: Card backs unchanged
- **WHEN** a scene theme is active
- **THEN** the selected card-back artwork SHALL still render for face-down cards

#### Scenario: Upload rejection preserved
- **WHEN** a user uploads an unsupported or oversized image
- **THEN** it SHALL be rejected with the existing type or size message
