import type { Platform } from "./axes";

interface UADataLike {
  platform?: string;
  mobile?: boolean;
}

/**
 * The platform whose conventions best fit the current device, from
 * User-Agent Client Hints where the browser offers them and the user agent
 * string otherwise. Detection never applies itself: call
 * `setPlatform(detectPlatform())` to opt in.
 *
 * iPadOS reports a desktop Mac user agent; a Mac with touch points is treated
 * as iOS. Linux and ChromeOS map to `web`.
 */
export function detectPlatform(nav: Navigator | undefined = globalThis.navigator): Platform {
  if (!nav) return "web";
  const uaData = (nav as Navigator & { userAgentData?: UADataLike }).userAgentData;
  const hint = uaData?.platform?.toLowerCase() ?? "";
  if (hint) {
    if (hint === "android") return "android";
    if (hint === "ios") return "ios";
    if (hint === "windows") return "windows";
    if (hint === "macos") return "macos";
    return "web";
  }
  const ua = nav.userAgent ?? "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/macintosh|mac os x/i.test(ua)) return (nav.maxTouchPoints ?? 0) > 1 ? "ios" : "macos";
  if (/windows/i.test(ua)) return "windows";
  return "web";
}
