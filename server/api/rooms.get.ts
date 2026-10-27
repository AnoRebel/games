/**
 * GET /api/rooms — list public, joinable rooms for the spectate lobby.
 *
 * Returns only public (non-locked), non-finished rooms with counts. Locked rooms
 * and the passcode are never exposed here.
 */
import { defineEventHandler } from "nuxt/server";
import { getRoomHub } from "../utils/roomHub";

export default defineEventHandler(() => {
  const hub = getRoomHub();
  return { rooms: hub.listPublicRooms() };
});
