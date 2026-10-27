import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@card-games/engine-core": r("./packages/engine-core/src/index.ts"),
      "@card-games/game-last-card": r("./packages/game-last-card/src/index.ts"),
      "@card-games/game-albastini": r("./packages/game-albastini/src/index.ts"),
      "@card-games/game-bao": r("./packages/game-bao/src/index.ts"),
      "@card-games/game-checkers": r("./packages/game-checkers/src/index.ts"),
      "@card-games/game-ai": r("./packages/game-ai/src/index.ts"),
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
