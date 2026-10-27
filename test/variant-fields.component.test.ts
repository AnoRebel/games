// @vitest-environment happy-dom
/**
 * The setup's variant/difficulty fields render the game's declared choices,
 * preselect the defaults, switch variants, and stay out of the way for games
 * without variants.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { mount } from "@vue/test-utils";
import { registerBao } from "@card-games/game-bao";
import { registerCheckers } from "@card-games/game-checkers";
import { registerLastCard } from "@card-games/game-last-card";
import GameVariantFields from "../app/components/GameVariantFields.vue";

beforeAll(() => {
  registerBao();
  registerCheckers();
  registerLastCard();
});

/** Minimal stand-ins for the Nuxt UI form controls. */
const UFormField = defineComponent({
  props: { label: String, help: String },
  setup:
    (p, { slots }) =>
    () =>
      h("label", [p.label, slots.default?.(), p.help]),
});
const USelect = defineComponent({
  props: { modelValue: [String, Number], items: Array },
  emits: ["update:modelValue"],
  setup:
    (p, { emit, attrs }) =>
    () =>
      h(
        "select",
        {
          ...attrs,
          value: p.modelValue,
          onChange: (e: Event) =>
            emit("update:modelValue", (e.target as HTMLSelectElement).value),
        },
        (p.items as { label: string; value: string }[]).map((i) =>
          h("option", { value: i.value, selected: i.value === p.modelValue }, i.label),
        ),
      ),
});

const mountFields = (gameId: string, withBots = true, variant: string | null = null) =>
  mount(GameVariantFields, {
    props: { gameId, withBots, t: (k: string) => k, variant, difficulty: "normal" },
    global: { stubs: { UFormField, USelect } },
  });

describe("GameVariantFields", () => {
  it("lists the declared checkers variants with the default preselected", () => {
    const w = mountFields("checkers", true, "drafti");
    const select = w.get('[data-testid="variant-select"]');
    expect(select.findAll("option").map((o) => o.text())).toEqual([
      "Drafti",
      "English/American",
      "International",
    ]);
    expect((select.element as HTMLSelectElement).value).toBe("drafti");
    const tiers = w.get('[data-testid="difficulty-select"]');
    expect(tiers.findAll("option").map((o) => o.attributes("value"))).toEqual([
      "easy",
      "normal",
      "hard",
    ]);
    expect((tiers.element as HTMLSelectElement).value).toBe("normal");
    expect(w.text()).toContain("setup.diffNormalHelp");
  });

  it("emits a variant switch", async () => {
    const w = mountFields("bao", true, "bao-la-kiswahili");
    await w.get('[data-testid="variant-select"]').setValue("bao-la-kujifunza");
    await nextTick();
    expect(w.emitted("update:variant")?.at(-1)).toEqual(["bao-la-kujifunza"]);
  });

  it("shows no variant choice for a game without variants", () => {
    const w = mountFields("last-card");
    expect(w.find('[data-testid="variant-select"]').exists()).toBe(false);
    expect(w.find('[data-testid="difficulty-select"]').exists()).toBe(true);
  });

  it("hides difficulty when no seat is a bot", () => {
    const w = mountFields("bao", false, "bao-la-kiswahili");
    expect(w.find('[data-testid="difficulty-select"]').exists()).toBe(false);
  });
});
