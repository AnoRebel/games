# realtime-multiplayer Specification

## Purpose

Defines the realtime multiplayer infrastructure: Conduit realtime transport with relay fallback, server-authoritative state, move broadcast and presence, reconnection and resync, and an offline local transport with parity to the online path.

## Requirements

### Requirement: Conduit realtime transport
Online multiplayer SHALL use Conduit (WebRTC DataChannels with automatic WebSocket relay fallback) for realtime communication. The system SHALL host a Conduit signaling/relay server via the Nitro server layer and connect clients through the Conduit client, selecting WebRTC when possible and falling back to relay otherwise.

#### Scenario: Connection established with fallback
- **WHEN** two clients in the same room cannot establish a direct WebRTC connection
- **THEN** the system SHALL transparently fall back to the WebSocket relay so realtime messaging still works

### Requirement: Server-authoritative state
The authoritative game state SHALL live on the server (Nitro), which validates every move through the engine reducer before broadcasting the resulting state delta. Clients SHALL treat their local state as a projection of server state and MUST NOT be trusted to compute outcomes. Hidden information (other players' hands) SHALL NOT be sent to clients not entitled to it.

#### Scenario: Server rejects illegal move
- **WHEN** a client submits a move that the engine deems illegal
- **THEN** the server SHALL reject it, leave authoritative state unchanged, and not broadcast a state change for it

#### Scenario: Hidden hands not leaked
- **WHEN** the server broadcasts a state update
- **THEN** each recipient SHALL receive only the information their seat/role is entitled to see

### Requirement: Move broadcast and presence
The system SHALL broadcast applied moves / state deltas to all room participants in realtime and SHALL track participant presence (joined, active, disconnected), reflecting it in the room UI.

#### Scenario: Move propagates to all
- **WHEN** a seated player makes a legal move
- **THEN** all players and spectators in the room SHALL receive the resulting state update in realtime

#### Scenario: Presence reflects disconnect
- **WHEN** a participant disconnects
- **THEN** the room SHALL mark them as disconnected for the other participants

### Requirement: Reconnection and resync
On transient disconnect, the system SHALL allow a participant to reconnect to their seat within a grace period and resync to the current authoritative state.

#### Scenario: Reconnect within grace period
- **WHEN** a player reconnects to a room within the grace period after a drop
- **THEN** they SHALL be restored to their seat and receive the current authoritative state

### Requirement: Offline local transport
The system SHALL provide a local in-memory transport that drives the same engine for offline play (hotseat / pass-and-play and bot-fillable seats), requiring no network or Conduit connection and exposing the same client-facing interface as the online transport.

#### Scenario: Offline play with no network
- **WHEN** a user starts a local game with networking unavailable
- **THEN** the game SHALL run fully via the local transport using the same engine, with no Conduit connection required

#### Scenario: Transport parity
- **WHEN** a game is played online versus locally with identical seed and moves
- **THEN** the resulting game states SHALL be identical because both use the same engine behind a common transport interface
