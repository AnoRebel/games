/**
 * Register all game modules with the engine registry at app startup, so the
 * registry is the single lookup point for game logic (no game-specific imports
 * scattered through the UI).
 */
import { registerLastCard } from "@games/game-last-card";
import { registerAlbastini } from "@games/game-albastini";
import { registerBao } from "@games/game-bao";
import { registerCheckers } from "@games/game-checkers";

export default defineNuxtPlugin(() => {
  registerLastCard();
  registerAlbastini();
  registerBao();
  registerCheckers();
});
