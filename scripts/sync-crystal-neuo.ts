/**
 * Copy the Crystal Neuo design system into this app.
 *
 *   bun run scripts/sync-crystal-neuo.ts <path-to-crystal-neuo-checkout>
 *
 * Crystal Neuo is not published to a registry, so the app keeps a copy:
 *  - app/assets/css/vendor/crystal-neuo/  tokens.css (built) and components.css
 *  - app/vendor/crystal-neuo/runtime/     the framework-free runtime (TypeScript source)
 *  - app/vendor/crystal-neuo/VERSION      the source version and commit
 *
 * Build the checkout first (`bun install && bun run build:tokens`) so
 * packages/tokens/dist/tokens.css exists. The design system's base layer is
 * not copied: its element margins would fight the app's utility classes, so
 * the parts the app wants live in app/assets/css/crystal-neuo.css. Never edit
 * the copied files by hand.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

const src = process.argv[2];
if (!src) {
  console.error("usage: bun run scripts/sync-crystal-neuo.ts <path-to-crystal-neuo>");
  process.exit(1);
}
const root = resolve(src);
const repo = resolve(import.meta.dir, "..");
const cssOut = join(repo, "app/assets/css/vendor/crystal-neuo");
const rtOut = join(repo, "app/vendor/crystal-neuo/runtime");
mkdirSync(cssOut, { recursive: true });
mkdirSync(rtOut, { recursive: true });

const css: [string, string][] = [
  ["packages/tokens/dist/tokens.css", "tokens.css"],
  ["packages/css/src/components.css", "components.css"],
];
for (const [from, to] of css) {
  const path = join(root, from);
  if (!existsSync(path)) {
    console.error(`missing ${from} — build the checkout first (bun run build:tokens)`);
    process.exit(1);
  }
  copyFileSync(path, join(cssOut, to));
}

// The runtime imports siblings with explicit `.ts` extensions; the app's
// bundler resolves extensionless paths, so drop them.
for (const file of ["axes.ts", "index.ts", "platform.ts", "refraction.ts"]) {
  const code = readFileSync(join(root, "packages/tokens/runtime", file), "utf8");
  writeFileSync(join(rtOut, file), code.replace(/from "(\.\/[\w-]+)\.ts"/g, 'from "$1"'));
}

const pkg = JSON.parse(readFileSync(join(root, "packages/tokens/package.json"), "utf8"));
let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
} catch {
  /* not a git checkout */
}
writeFileSync(
  join(repo, "app/vendor/crystal-neuo/VERSION"),
  `crystal-neuo ${pkg.version} (${commit})\nhttps://github.com/AnoRebel/crystal-neuo\n`,
);
console.log(`synced crystal-neuo ${pkg.version} (${commit})`);
