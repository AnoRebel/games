/**
 * `:ui` overrides so @nuxt/ui overlays (UModal / USlideover) adopt the active
 * app theme (--games-* tokens) instead of the default neutral surface.
 */
export function useThemedModalUi() {
  return {
    content:
      "bg-[var(--games-surface-solid)] text-[var(--games-text)] ring-1 ring-[var(--games-border)] divide-[var(--games-border)]",
    header: "border-b border-[var(--games-border)]",
    footer: "border-t border-[var(--games-border)]",
    title: "text-[var(--games-text)] font-display",
    overlay: "bg-black/60",
  };
}
