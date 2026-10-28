/**
 * The product's public identity, declared once. Build-time metadata (PWA
 * manifest, Apple title) reads this; in-app surfaces read the localized
 * `app.title` string, which must agree with `name` in English.
 */
export const siteConfig = {
  /** Public product name. */
  name: "Games",
  /** Installed-app short name (fits home-screen label limits). */
  shortName: "Games",
  /** Manifest / meta description. */
  description:
    "Play card and board games — offline, on your local network, or online with friends.",
} as const;

export type SiteConfig = typeof siteConfig;
