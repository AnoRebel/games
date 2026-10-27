import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // Component tests mount SFCs directly (they opt into a DOM per file with
  // `@vitest-environment happy-dom`); everything else stays node-only.
  plugins: [vue()],
  resolve: {
    alias: {
      "@games/engine-core": r("./packages/engine-core/src/index.ts"),
      "@games/game-last-card": r("./packages/game-last-card/src/index.ts"),
      "@games/game-albastini": r("./packages/game-albastini/src/index.ts"),
      "@games/game-bao": r("./packages/game-bao/src/index.ts"),
      "@games/game-checkers": r("./packages/game-checkers/src/index.ts"),
      "@games/game-ai": r("./packages/game-ai/src/index.ts"),
      "~/": r("./app/"),
      "@/": r("./app/"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/test/**/*.{test,spec}.ts", "test/**/*.{test,spec}.ts"],
    globals: true,
  },
});
