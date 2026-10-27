/**
 * Internal identifiers use the `games` name everywhere: `@games/*` packages,
 * the `games` root package and Dexie database, `games.db`, `games:*` storage
 * keys and `--games-*` / `games-*` CSS names. The old `card-games` / `cg`
 * identifiers may only appear in the migration code that moves data off them
 * and in historical documents.
 */
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const LEGACY = [
  /@card-games\//,
  /["'`]card-games["'`]/,
  /card-games\.db/,
  /CardGamesDB/,
  /--cg-/,
  /(?<![\w-])cg-[a-z]/,
  /["'`]cg:/,
];
// Migration code keeps the legacy literals it migrates from; historical
// documents are not rewritten.
const ALLOWED = [
  /^openspec\//,
  /migrat/i,
  /^\.impeccable\.md$/,
  /identifier-scan\.test\.ts$/,
];

describe("internal identifiers", () => {
  it("no tracked source uses a legacy identifier", () => {
    const files = execSync("git ls-files", { cwd: ROOT })
      .toString()
      .split("\n")
      .filter(
        (f) =>
          f &&
          /\.(ts|vue|css|json|mjs|yml|md)$/.test(f) &&
          !ALLOWED.some((a) => a.test(f)),
      );
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(join(ROOT, f), "utf8");
      for (const re of LEGACY) {
        if (re.test(text)) offenders.push(`${f} ${re}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("names the root package and workspace scope games", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.name).toBe("games");
    const workspace = Object.keys(pkg.dependencies).filter((d) =>
      d.startsWith("@games/"),
    );
    expect(workspace.sort()).toEqual([
      "@games/engine-core",
      "@games/game-ai",
      "@games/game-albastini",
      "@games/game-bao",
      "@games/game-checkers",
      "@games/game-last-card",
    ]);
  });
});
