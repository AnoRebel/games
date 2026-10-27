/**
 * Nitro plugin: optional Conduit (WebRTC P2P) signaling.
 *
 * The room/game protocol runs over Nitro-native WebSockets (`server/routes/_ws.ts`)
 * by default. Conduit is an OPTIONAL enhancement that adds WebRTC peer-to-peer
 * data channels (with relay fallback) for lower latency. It is OFF unless
 * `NUXT_CONDUIT_ENABLED=true`, so we never fight crossws for the HTTP upgrade in
 * the default setup.
 *
 * When enabled, Conduit's signaling core attaches a `ws` WebSocketServer (in
 * noServer mode) to Nitro's HTTP server, routing only its own path so it
 * coexists with the crossws endpoint and Vite HMR.
 */
import type { Server } from "node:http";
import { defineNitroPlugin } from "nitropack/runtime";
import { useRuntimeConfig } from "nuxt/server";

export default defineNitroPlugin(async (nitroApp) => {
  if (import.meta.prerender) return;

  const rc = useRuntimeConfig();
  if (!rc.conduit.enabled) return; // default: Nitro WS only

  const { createConduitServerCore } = await import("@conduit/server");
  const { WebSocketServer } = await import("ws");

  const signalingPath = rc.public.conduit.path;
  const allowed = rc.conduit.allowedOrigins
    ? rc.conduit.allowedOrigins
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const core = createConduitServerCore({
    config: {
      path: signalingPath,
      auth: { mode: rc.conduit.authMode as "none" | "key" },
      key: rc.conduit.key,
      ...(allowed ? { allowedOrigins: allowed } : {}),
      relay: { enabled: true, maxMessageSize: rc.conduit.relayMaxMessageBytes },
    } as never,
  });
  core.start();

  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const id = url.searchParams.get("id") ?? core.generateClientId();
    const token = url.searchParams.get("token") ?? "";
    const key = url.searchParams.get("key") ?? rc.conduit.key;
    const client = core.handleConnection(socket as never, id, token, key);
    if (!client) return;
    socket.on("message", (data) => core.handleMessage(client, data as never));
    socket.on("close", () => core.handleDisconnect(client));
  });

  let attached = false;
  nitroApp.hooks.hook("listen" as never, (server: Server) => {
    if (attached || typeof server?.on !== "function") return;
    attached = true;
    server.on("upgrade", (request, socket, head) => {
      const url = request.url ?? "";
      // Only claim Conduit's own path; leave crossws (_ws) + HMR alone.
      if (!url.startsWith(signalingPath)) return;
      wss.handleUpgrade(request, socket as never, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });
  });

  nitroApp.hooks.hook("close", () => {
    core.stop();
    wss.close();
  });
});
