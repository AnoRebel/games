/**
 * Nuxt UI theme overrides so components follow the Crystal Neuo material,
 * platform style and density (tokens: see assets/css/crystal-neuo.css).
 *
 *  - Control heights come from the platform style × density and never drop
 *    below the platform's touch target (44px on iOS, 48px on Android).
 *  - The primary button takes the platform's primary shape (a pill on iOS
 *    and Android) and the accent's verified label colour.
 *  - Overlays sit on the opaque overlay surface with the material's border,
 *    shadow and corners; labels use the material's weight.
 */
const control = {
  xs: "min-h-[max(calc(var(--size-control-sm)*0.85),var(--platform-touch-min))]",
  sm: "min-h-[max(var(--size-control-sm),var(--platform-touch-min))]",
  md: "min-h-[max(var(--size-control-md),var(--platform-touch-min))]",
  lg: "min-h-[max(var(--size-control-lg),var(--platform-touch-min))]",
  xl: "min-h-[max(calc(var(--size-control-lg)*1.15),var(--platform-touch-min))]",
};
const square = {
  xs: "min-w-[max(calc(var(--size-control-sm)*0.85),var(--platform-touch-min))] justify-center",
  sm: "min-w-[max(var(--size-control-sm),var(--platform-touch-min))] justify-center",
  md: "min-w-[max(var(--size-control-md),var(--platform-touch-min))] justify-center",
  lg: "min-w-[max(var(--size-control-lg),var(--platform-touch-min))] justify-center",
  xl: "min-w-[max(calc(var(--size-control-lg)*1.15),var(--platform-touch-min))] justify-center",
};
const sizes = ["xs", "sm", "md", "lg", "xl"] as const;

const overlay = {
  content:
    "bg-[var(--surface-overlay)] text-[var(--content-primary)] border-[length:var(--border-width-default)] border-[var(--border-glass-rim)] shadow-[var(--shadow-lg)] divide-[var(--border-subtle)]",
  title: "font-display text-lg tracking-tight",
  overlay: "bg-[var(--surface-scrim)]",
};

export default defineAppConfig({
  ui: {
    button: {
      slots: {
        base: "font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-(--motion-duration-fast) active:translate-y-px",
      },
      variants: {
        size: Object.fromEntries(sizes.map((s) => [s, { base: control[s] }])),
      },
      compoundVariants: [
        {
          color: "primary",
          variant: "solid",
          class:
            "text-[var(--content-on-accent)] rounded-[var(--radius-primary)] shadow-[var(--shadow-offset-sm)] hover:bg-[var(--accent-primary-strong)] active:bg-[var(--accent-primary-strong)] active:shadow-[var(--shadow-offset-pressed)]",
        },
        {
          variant: "outline",
          class: "border-[length:var(--border-width-default)]",
        },
        ...sizes.map((size) => ({ square: true, size, class: square[size] })),
      ],
    },
    input: {
      slots: { base: "rounded-[var(--radius-sm)]" },
      variants: {
        size: Object.fromEntries(sizes.map((s) => [s, { base: control[s] }])),
      },
    },
    select: {
      slots: { base: "rounded-[var(--radius-sm)]" },
      variants: {
        size: Object.fromEntries(sizes.map((s) => [s, { base: control[s] }])),
      },
    },
    selectMenu: {
      slots: { base: "rounded-[var(--radius-sm)]" },
      variants: {
        size: Object.fromEntries(sizes.map((s) => [s, { base: control[s] }])),
      },
    },
    modal: {
      slots: {
        ...overlay,
        content: `${overlay.content} sm:rounded-[var(--radius-xl)]`,
      },
    },
    slideover: { slots: overlay },
    drawer: { slots: overlay },
    popover: {
      slots: {
        content:
          "bg-[var(--surface-overlay)] border-[length:var(--border-width-hairline)] border-[var(--border-glass-rim)] shadow-[var(--shadow-md)] rounded-[var(--radius-md)]",
      },
    },
    dropdownMenu: {
      slots: {
        content:
          "bg-[var(--surface-overlay)] border-[length:var(--border-width-hairline)] border-[var(--border-glass-rim)] shadow-[var(--shadow-md)] rounded-[var(--radius-md)]",
        item: "min-h-[max(var(--size-control-sm),var(--platform-touch-min))]",
      },
    },
    toast: {
      slots: {
        root: "bg-[var(--surface-overlay)] border-[length:var(--border-width-default)] border-[var(--border-glass-rim)] shadow-[var(--shadow-lg)] rounded-[var(--radius-lg)] ring-0",
      },
    },
    card: {
      slots: {
        root: "bg-[var(--surface-raised-1)] border-[length:var(--border-width-default)] border-[var(--border-default)] shadow-[var(--shadow-sm)] rounded-[var(--radius-lg)]",
      },
    },
    badge: {
      slots: { base: "font-semibold" },
    },
  },
});
