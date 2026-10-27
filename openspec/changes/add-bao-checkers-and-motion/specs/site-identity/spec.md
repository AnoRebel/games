# Spec Delta

## Purpose

Defines the public identity of the site now that it hosts board games as well as card games: one product name, consistent install and metadata naming, and game-agnostic brand copy in every supported locale.

## ADDED Requirements

### Requirement: Public product name
The site's public name SHALL be **Games**. Every user-visible surface that names the product — header, home title, document title, share dialogs, install prompt, and metadata — SHALL show that name and SHALL NOT show **Card Games**.

#### Scenario: Home and header
- **WHEN** a player opens the site
- **THEN** the browser title and header SHALL show **Games**, not **Card Games**

#### Scenario: No stale product name
- **WHEN** the shipped user-visible strings are scanned
- **THEN** none SHALL contain **Card Games** as the product name

#### Scenario: Game names unchanged
- **WHEN** the rename ships
- **THEN** individual game names such as Last Card, Albastini, Bao, and Checkers SHALL remain unchanged

### Requirement: Single source for the product name
The product name SHALL come from one shared declaration used by the app shell, share defaults, install prompt, and build-time metadata, so a future rename does not require hunting hard-coded strings.

#### Scenario: Surfaces agree
- **WHEN** the header, share default title, install prompt, and manifest are compared
- **THEN** they SHALL all report the same product name

#### Scenario: No hard-coded copy
- **WHEN** a component needs the product name
- **THEN** it SHALL read the shared declaration or its localized string rather than embedding a literal name

### Requirement: Localized product name
The product name SHALL be localized with the rest of the interface: **Games** in English and **Michezo** in Swahili. The localized name SHALL be used consistently in that locale, including metadata where the locale is known.

#### Scenario: Swahili name
- **WHEN** the active locale is Swahili
- **THEN** the header, home title, and share defaults SHALL show **Michezo**

#### Scenario: English name
- **WHEN** the active locale is English
- **THEN** the header, home title, and share defaults SHALL show **Games**

#### Scenario: No mixed-language product name
- **WHEN** a locale is active
- **THEN** the product name SHALL NOT fall back to the other language while its own translation exists

### Requirement: Install and metadata naming
The web app manifest name and short name, the Apple mobile web app title, the document title, and the install prompt SHALL use the product name. The manifest description SHALL describe a multiplayer games platform rather than a card-only platform.

#### Scenario: Installable app name
- **WHEN** the site is installed to a device home screen
- **THEN** the installed app SHALL be named **Games** and its short name SHALL fit the platform limit

#### Scenario: Install prompt
- **WHEN** the install prompt is shown in English
- **THEN** it SHALL say **Install Games** rather than **Install Card Games**

#### Scenario: Manifest description
- **WHEN** the manifest description is read
- **THEN** it SHALL describe a games platform and SHALL NOT claim the site is card games only

### Requirement: Game-agnostic brand copy
Taglines, subtitles, invitation text, and empty-state copy SHALL refer to games generally and SHALL NOT describe the product as card-only, because the site now hosts board games.

#### Scenario: Home subtitle
- **WHEN** a player opens the home page
- **THEN** the tagline and subtitle SHALL describe multiplayer games without calling them card games

#### Scenario: Invitation copy
- **WHEN** a player shares an invite
- **THEN** the default share text SHALL invite the recipient to a game, not specifically a card game

#### Scenario: Swahili brand copy
- **WHEN** the active locale is Swahili
- **THEN** the tagline, subtitle, and invitation copy SHALL use general game wording rather than card-only wording

### Requirement: Consistent internal identifiers
The root package SHALL be `games`, workspace packages and aliases SHALL use `@games/*`, the client database/class SHALL be `games`/`GamesDB`, and the default server database SHALL be `data/games.db`. Application keys, CSS variables, classes, and attributes SHALL use `games` rather than `cg` or `card-games`. Explicit database connection settings SHALL remain authoritative.

#### Scenario: Existing data still loads
- **WHEN** the renamed build starts against an existing database and existing local storage
- **THEN** rooms, leaderboard results, profiles, and preferences SHALL survive a verified migration to the new identifiers

#### Scenario: Workspace imports unchanged
- **WHEN** the renamed build is type-checked and built
- **THEN** every workspace import SHALL resolve through `@games/*`, including tests, server registration, transpile configuration, and the lockfile

#### Scenario: Storage keys migrate
- **WHEN** a returning player opens the site
- **THEN** their stored identity and settings SHALL be copied once from legacy keys to `games:*` keys without overwriting newer values

### Requirement: Safe identifier migration
Migration SHALL preserve legacy data until destination writes are verified, SHALL be idempotent, and SHALL refuse ambiguous merges rather than overwrite data. Existing uploads and saved games SHALL migrate with results and identity. Failures SHALL be reported and SHALL NOT silently start an empty database. Deployment SHALL retain the current origin until browser data migration is complete.

#### Scenario: Retry after interruption
- **WHEN** migration is interrupted and retried
- **THEN** records SHALL not be duplicated or lost and completion SHALL be marked only after verification

#### Scenario: Both server databases exist
- **WHEN** both legacy and renamed server database files already exist
- **THEN** startup SHALL report the conflict rather than replace either database

### Requirement: Deferred infrastructure rename
The target repository name SHALL be `AnoRebel/games`. This planning checkpoint SHALL use the existing GitHub remote; renaming GitHub, domains, and Dokploy SHALL be a separate authorized operation. Source links SHALL not point to a nonexistent repository.

#### Scenario: Checkpoint push
- **WHEN** these planning artifacts are committed
- **THEN** they SHALL be pushed to the current repository without changing live deployment identifiers
