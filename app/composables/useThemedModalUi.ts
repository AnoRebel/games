/**
 * `:ui` overrides for @nuxt/ui overlays (UModal / USlideover). The material
 * look itself comes from app.config.ts; this keeps header and footer rules on
 * the material's subtle divider and the title in its display face.
 */
export function useThemedModalUi() {
  return {
    header: "border-b border-[var(--border-subtle)]",
    footer: "border-t border-[var(--border-subtle)]",
    title: "text-[var(--content-primary)] font-display",
  };
}
