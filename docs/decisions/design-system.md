# Decision: Interface design system

**Status:** Accepted · **Date:** 2026-11-01

## Context

The interface was styled with Nuxt UI defaults plus three app-wide palettes
(Felt, Arcade, Neon) that set both the page chrome and the game tables. Type,
corners, spacing and control sizes were fixed, dialogs used the stock neutral
surface, and there was no way to adapt the interface to a device's
conventions or to a player's need for higher contrast or less translucency.

[Crystal Neuo](https://github.com/AnoRebel/crystal-neuo) is our own design
system: one token source with four axes — material, platform style, theme and
density — whose contrast is verified for every material × theme combination
at build time, plus a framework-free runtime that sets and remembers them.

## Decision

- **The interface follows Crystal Neuo.** Players choose a material,
  platform style, density, light/dark/system, high contrast and glass
  settings in **Customize**. Each is an attribute on `<html>`; every token
  resolves from it.
- **Nuxt UI stays as the component layer**, re-pointed at the tokens instead
  of being replaced: `app/assets/css/crystal-neuo.css` maps Nuxt UI's
  `--ui-*` variables, Tailwind's spacing step and font tokens, and the app's
  `--games-*` chrome tokens onto Crystal Neuo's semantic tokens.
  `app/app.config.ts` gives buttons, inputs and selects the platform's control
  height and touch target, the primary button the platform's primary shape,
  and overlays the material's overlay surface, border, shadow and corners.
- **Game scenes keep their own palettes.** Card tables and boards are the
  game's look, not the interface's, so Felt / Arcade / Neon and custom scene
  themes still dress them; the controls that float on a scene (zoom, chips)
  use the interface tokens.
- **Light/dark stays with Nuxt color mode**, so the header toggle and its
  animated transition keep working and saved preferences carry over. A
  separate contrast setting selects Crystal Neuo's high-contrast theme.
- **The design system's base layer is not imported.** Its element margins
  and link underlines would fight the app's utility classes; the parts we
  want (interface face, heading face, focus ring, selection, numeric and
  label styles) are reproduced in `crystal-neuo.css`.
- **Fonts are self-hosted.** Each material's faces (Geist, Bricolage
  Grotesque, JetBrains Mono, Doto, IBM Plex Sans and Mono, Figtree) live in
  `/public/fonts` and only download when the active material uses them. Inter
  is no longer used and was removed.

## Distribution

Crystal Neuo is not published to a package registry. The app keeps a copy:
the built `tokens.css`, `components.css` and the runtime's TypeScript source,
with the source version recorded in `app/vendor/crystal-neuo/VERSION`.
`scripts/sync-crystal-neuo.ts` refreshes it from a built checkout. A test
checks that every design token the app references exists in the copy and
that every material, platform and density the runtime offers is styled, so a
sync that drops or renames a token fails the suite.

## Consequences

- Six materials' worth of tokens ship in one stylesheet. Measured on the
  production build, the main stylesheet grows from 30.5 KB to 47.0 KB gzip
  (233 KB to 371 KB raw). Fonts are separate and load per material.
- Settings are per browser (`crystal-neuo:*` and `games:contrast` in local
  storage) and are applied by an inline script before first paint.
- Live refraction renders only in Chromium; elsewhere glass stays frosted.
  It is off by default and turns itself off for reduced motion, reduced
  transparency, high contrast and forced colours.
