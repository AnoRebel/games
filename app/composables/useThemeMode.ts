/**
 * Dark/light color mode with smooth, randomly-chosen animated transitions.
 *
 * Uses the View Transitions API for a different reveal each toggle (circular
 * wipe from the click point, fade, slide, iris). Honors prefers-reduced-motion
 * by switching instantly. Falls back to an instant switch where unsupported.
 */
type TransitionKind = "circle" | "fade" | "slide-up" | "iris";

const KINDS: TransitionKind[] = ["circle", "fade", "slide-up", "iris"];

export function useThemeMode() {
  const colorMode = useColorMode(); // from @nuxt/ui
  const reduced = usePreferredReducedMotion();

  const isDark = computed({
    get: () => colorMode.value === "dark",
    set: (v) => (colorMode.preference = v ? "dark" : "light"),
  });

  // Vary the transition deterministically-ish by a rotating counter so each
  // toggle differs without ambient randomness concerns in app logic.
  let tick = 0;

  function pickKind(): TransitionKind {
    tick = (tick + 1 + (Date.now() % KINDS.length)) % KINDS.length;
    return KINDS[tick]!;
  }

  async function toggle(ev?: MouseEvent) {
    const next = !isDark.value;

    const supportsVT =
      import.meta.client &&
      "startViewTransition" in document &&
      reduced.value !== "reduce";

    if (!supportsVT) {
      isDark.value = next;
      // GSAP cross-fade fallback where View Transitions are unavailable
      // (and not reduced-motion) so the switch still feels smooth.
      if (import.meta.client && reduced.value !== "reduce") {
        crossFade(document.body);
      }
      return;
    }

    const kind = pickKind();
    const x = ev?.clientX ?? window.innerWidth / 2;
    const y = ev?.clientY ?? window.innerHeight / 2;

    document.documentElement.dataset.vtKind = kind;
    const transition = document.startViewTransition(() => {
      isDark.value = next;
    });

    if (kind === "circle" || kind === "iris") {
      await transition.ready;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      const clip = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];
      document.documentElement.animate(
        { clipPath: kind === "iris" ? [...clip].reverse() : clip },
        {
          duration: 450,
          easing: "ease-in-out",
          pseudoElement:
            kind === "iris"
              ? "::view-transition-old(root)"
              : "::view-transition-new(root)",
        },
      );
    }
    await transition.finished.catch(() => {});
    delete document.documentElement.dataset.vtKind;
  }

  return { isDark, toggle };
}
