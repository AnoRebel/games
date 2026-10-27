import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { siteConfig } from "./site.config.ts";

/**
 * Automated version string, resolved ONCE at build time:
 *   <pkg-version>+<git-short-sha>[-dirty]
 * Prefers CI-provided values (NUXT_PUBLIC_APP_VERSION / GIT_SHA) so container
 * builds without a .git dir still stamp a real version; falls back to git.
 */
function resolveVersion(): string {
  if (process.env.NUXT_PUBLIC_APP_VERSION) return process.env.NUXT_PUBLIC_APP_VERSION;
  let pkgVersion = "0.0.0";
  try {
    pkgVersion = JSON.parse(readFileSync("./package.json", "utf8")).version || pkgVersion;
  } catch {
    /* keep default */
  }
  const sha = process.env.GIT_SHA?.slice(0, 7) || tryGit("git rev-parse --short HEAD");

  // `-dirty` means "built from uncommitted local edits", which is only ever
  // meaningful for a developer's working tree. A deploy checks out a commit, so
  // it is pristine by construction — yet production stamped `-dirty` on every
  // build: the builder writes its own scratch files (Railpack drops a
  // `railpack-plan.json` into the build context) which are untracked, so
  // `git status --porcelain` reported `?? railpack-plan.json`.
  //
  // Fix both halves: ignore untracked files when judging dirtiness (they are
  // never "uncommitted edits" to the source we built from), and skip the check
  // entirely for automated builds. A false `-dirty` is worse than none — it
  // makes the marker unable to flag the case it exists for.
  const isAutomatedBuild = Boolean(process.env.GIT_SHA || process.env.CI);
  const dirty =
    !isAutomatedBuild && tryGit("git status --porcelain --untracked-files=no")
      ? "-dirty"
      : "";
  return sha ? `${pkgVersion}+${sha}${dirty}` : pkgVersion;
}
function tryGit(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}
const APP_VERSION = resolveVersion();

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  future: {
    compatibilityVersion: 5,
  },

  compatibilityDate: "2026-06-01",

  experimental: {
    // Compat v5 turns Nitro auto-imports off. nuxt-i18n-micro 3.30.1 still
    // imports `useRuntimeConfig` from virtual #imports, so keep the compatibility
    // layer until that module switches to direct imports. Our own server code
    // imports h3/nitropack helpers explicitly.
    nitroAutoImports: true,
  },

  modules: [
    "@nuxt/ui",
    "@vueuse/nuxt",
    "@vueuse/motion/nuxt",
    "@nuxt/eslint",
    "@nuxt/icon",
    "@nuxt/image",
    "@nuxt/fonts",
    "@vite-pwa/nuxt",
    "nuxt-i18n-micro",
    "nuxt-umami",
  ],

  // PWA — installable + offline-capable. Offline/LAN play is fully client-side
  // (IndexedDB + the local engine), so we precache the app shell, card art and
  // fonts. The realtime API/WebSocket paths are never cached (they need the
  // network); the SPA navigate fallback is denied for them.
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: siteConfig.name,
      short_name: siteConfig.shortName,
      description: siteConfig.description,
      lang: "en",
      theme_color: "#1b3a2c",
      background_color: "#0f2419",
      display: "standalone",
      orientation: "any",
      categories: ["games", "entertainment"],
      icons: [
        { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
        { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/maskable-icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    workbox: {
      navigateFallback: "/",
      // Realtime paths must hit the network, never the offline app shell.
      navigateFallbackDenylist: [/^\/api\//, /^\/_ws/],
      // Precache the shell + assets needed to play offline (card art is large).
      globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,json}"],
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      cleanupOutdatedCaches: true,
    },
    client: {
      // Intercept the browser install prompt so we can show our own button.
      installPrompt: true,
      // Re-check for a new service worker hourly (cheap; autoUpdate applies it).
      periodicSyncForUpdates: 3600,
    },
    devOptions: {
      enabled: false,
      type: "module",
    },
  },

  // Privacy-friendly, self-hosted analytics (same stack as other side projects).
  // Both are no-ops until their site ids are provided via env, so local/dev runs
  // don't phone home.
  umami: {
    id: process.env.NUXT_UMAMI_SITE_ID || "",
    host: "https://umami.anorebel.net",
    autoTrack: true,
    proxy: "cloak",
  },

  // Rybbit (self-hosted) injected DIRECTLY via app.head — the docs' alternative
  // method. We deliberately avoid @nuxt/scripts here: its registry proxies the
  // script through /_scripts/p/... and rewrites the SDK's API host to the SaaS
  // default app.rybbit.io, so tracking POSTed to
  // /_scripts/p/app.rybbit.io/api/track → 404 "Site not found". Loading the
  // script straight from the instance makes the SDK derive its API host from its
  // own origin (rybbit.anorebel.net) and POST there. Only inject when a site id
  // is present; the script handles SPA route tracking itself.
  app: {
    head: {
      // viewport-fit=cover so env(safe-area-inset-*) resolves on notched phones.
      viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
      meta: [
        // Matches the PWA manifest theme_color so the browser/OS chrome tints
        // to the felt-green brand when installed.
        { name: "theme-color", content: "#1b3a2c" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: siteConfig.shortName },
        { name: "description", content: siteConfig.description },
      ],
      link: [{ rel: "apple-touch-icon", href: "/apple-touch-icon-180x180.png" }],
      script: process.env.NUXT_RYBBIT_SITE_ID
        ? [
            {
              src: "https://rybbit.anorebel.net/api/script.js",
              defer: true,
              "data-site-id": process.env.NUXT_RYBBIT_SITE_ID,
            },
          ]
        : [],
    },
  },

  // i18n: English + Swahili (sw). Albastini's East-African roots make sw a
  // natural fit (Dume/Jike/Mzungu surface in translations).
  i18n: {
    locales: [
      { code: "en", iso: "en-US", dir: "ltr" },
      { code: "sw", iso: "sw-TZ", dir: "ltr" },
    ],
    defaultLocale: "en",
    translationDir: "locales",
    meta: true,
    // Remember the chosen locale across reloads.
    localeCookie: "games-locale",
  },

  // Prettier owns formatting; keep ESLint focused on code-quality rules only.
  eslint: {
    config: {
      stylistic: false,
    },
  },

  // Nitro native WebSockets (crossws) carry the room/game protocol with pub/sub.
  nitro: {
    experimental: {
      websocket: true,
    },
  },

  devtools: { enabled: true },

  // Register nested component dirs without a path prefix so e.g.
  // components/games/LastCardTable.vue is usable as <LastCardTable>.
  components: [{ path: "~/components", pathPrefix: false }],

  css: ["~/assets/css/main.css"],

  // Self-hosted fonts only. Files live in /public/fonts using the @nuxt/fonts
  // auto-discovery pattern (<family>-<weight>-<style>.woff2); the module
  // generates @font-face + fallback metrics. No remote provider is fetched.
  //   Bricolage Grotesque → brand/display   Inter → UI/body
  //   Outfit → Last Card accent             Fraunces → Albastini accent
  fonts: {
    defaults: {
      weights: ["400", "500", "600", "700"],
      styles: ["normal"],
      subsets: ["latin"],
    },
    families: [
      {
        name: "Inter",
        provider: "local",
        weights: ["400", "500", "600", "700"],
      },
      {
        name: "Bricolage Grotesque",
        provider: "local",
        weights: ["600", "700", "800"],
      },
      { name: "Outfit", provider: "local", weights: ["500", "600", "700"] },
      {
        // Fraunces ships expressive italics — kept for Albastini's heritage feel.
        name: "Fraunces",
        provider: "local",
        weights: ["500", "600", "700"],
        styles: ["normal", "italic"],
      },
    ],
  },

  // Transpile the workspace engine/game packages (shipped as TS source).
  build: {
    transpile: [
      "@games/engine-core",
      "@games/game-last-card",
      "@games/game-albastini",
      "@games/game-bao",
      "@games/game-checkers",
      "@games/game-ai",
    ],
  },

  // All overridable via env vars (NUXT_* for private, NUXT_PUBLIC_* for public),
  // e.g. NUXT_PUBLIC_CONDUIT_PATH, NUXT_CONDUIT_AUTH_MODE, NUXT_CONDUIT_KEY.
  runtimeConfig: {
    // Server-only Conduit signaling settings. Conduit is an OPTIONAL WebRTC P2P
    // enhancement; the Nitro-native WS path is the default carrier, so this is
    // off unless explicitly enabled (NUXT_CONDUIT_ENABLED=true).
    conduit: {
      enabled: false,
      authMode: "none", // 'none' | 'key'
      key: "conduit", // required when authMode === 'key'
      relayMaxMessageBytes: 65536,
      allowedOrigins: "", // comma-separated; empty = allow all (dev)
    },
    // Analytics site ids (overridable via NUXT_RYBBIT_SITE_ID / NUXT_UMAMI_SITE_ID).
    rybbit: {
      siteId: process.env.NUXT_RYBBIT_SITE_ID || "",
    },
    umami: {
      id: process.env.NUXT_UMAMI_SITE_ID || "",
    },
    public: {
      // Build-stamped app version (overridable via NUXT_PUBLIC_APP_VERSION).
      appVersion: APP_VERSION,
      conduit: {
        // Signaling/relay endpoint path (same Nitro server by default).
        path: "/api/conduit",
        // Preferred transport: 'auto' | 'webrtc' | 'websocket'.
        transport: "auto",
      },
    },
  },

  typescript: {
    strict: true,
  },
});
