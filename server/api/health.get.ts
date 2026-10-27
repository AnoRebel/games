/**
 * GET /api/health — liveness/readiness probe + basic live metrics.
 * Dokploy/Traefik can hit this for health checks, and it doubles as a cheap
 * window into the in-memory room hub (room/peer counts) to spot memory drift.
 */
import { defineEventHandler, useRuntimeConfig } from "nuxt/server";
import { getRoomHub } from "../utils/roomHub";

export default defineEventHandler(() => {
  const hub = getRoomHub();
  return {
    ok: true,
    version: useRuntimeConfig().public.appVersion,
    uptime: Math.round(process.uptime()),
    ...hub.stats(),
  };
});
