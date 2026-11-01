// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";
import prettier from "eslint-config-prettier";

/**
 * Determinism guard for the pure engine + game-rule packages.
 *
 * The engine core and game modules MUST be deterministic (see the
 * `game-engine-core` spec and design D2/risks): all randomness flows through
 * the seeded PRNG, and time is injected — never `Math.random` / `Date.now` /
 * `new Date()` / `performance.now()`.
 */
const NON_DETERMINISTIC = [
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message:
      "Engine/game code must be deterministic: use the seeded PRNG (rng) instead of Math.random.",
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message:
      "Engine/game code must be deterministic: inject timestamps instead of calling Date.now().",
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message:
      "Engine/game code must be deterministic: inject timestamps instead of `new Date()`.",
  },
  {
    selector:
      "CallExpression[callee.object.name='performance'][callee.property.name='now']",
    message:
      "Engine/game code must be deterministic: do not read wall-clock time in engine logic.",
  },
];

export default withNuxt(
  // Copied from the Crystal Neuo design system (scripts/sync-crystal-neuo.ts).
  { ignores: ["app/vendor/**"] },
  {
    files: ["packages/engine-core/**/*.ts", "packages/game-*/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...NON_DETERMINISTIC],
    },
  },
  // Must come last: disables any ESLint rules that conflict with Prettier.
  prettier,
);
