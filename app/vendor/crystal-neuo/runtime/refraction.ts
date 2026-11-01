/**
 * Live glass refraction: content behind a glass surface bends near its rim.
 *
 * Technique: an SVG filter applied through `backdrop-filter: url(#…)`, whose
 * displacement map is drawn on a canvas from the element's own size and corner
 * radius (neutral in the middle, a bevel near the rim that samples further
 * inward). An optional colour fringe displaces red, green, and blue by slightly
 * different amounts.
 *
 * Support: only Chromium renders SVG filters in `backdrop-filter`. Safari
 * parses `backdrop-filter: url(#f)` and renders nothing, so `@supports` cannot
 * detect it; Firefox does not support it. The engine is therefore enabled by
 * engine identification (User-Agent Client Hints, which only Chromium
 * implements). Everywhere else the frosted CSS glass stays as it is.
 *
 * The engine only supplies the filter. Whether a subtree refracts is decided
 * in CSS by the nearest ancestor's `data-refraction` ("on" or "off"), and accessibility
 * preferences (reduced motion or transparency, high contrast, forced colours)
 * switch it off there too.
 */

/** Glass surfaces the engine attaches to. */
export const GLASS_SELECTOR =
  ".cn-glass, .cn-nav--glass, .cn-card--glass, .cn-card--feature, .cn-tabbar, .cn-sheet, .cn-menu";

export interface RefractionOptions {
  /** How far light bends at the rim, 0–1. Default 0.5. */
  thickness?: number;
  /** Width of the bending band at the rim, in CSS pixels. Default 18. */
  bevel?: number;
  /** Split light into colour fringes at the rim. Default false. */
  fringe?: boolean;
  /** Elements to refract. Default: every Crystal Neuo glass surface. */
  selector?: string;
  /** Where to look for glass surfaces. Default: the document. */
  root?: ParentNode;
}

interface NavigatorUAData {
  brands?: Array<{ brand: string }>;
}

/** Whether this engine renders SVG filters in `backdrop-filter`. */
export function refractionSupported(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  return Boolean(uaData?.brands?.some((b) => b.brand === "Chromium"));
}

const SVG_NS = "http://www.w3.org/2000/svg";
const DEFS_ID = "cn-refraction-defs";

/**
 * Displacement map for a rounded rectangle of w × h CSS px. Red encodes x and
 * green y; 128 is no displacement. Inside the bevel the offset grows toward
 * the rim along the inward normal, so the rim samples from further inside,
 * like light through a thick lens edge.
 */
function drawMap(w: number, h: number, radius: number, bevel: number): string {
  // The filter works in bounding-box units (user-space units misplace the
  // backdrop under backdrop-filter in Chromium), where the displacement scale
  // is relative to each axis. Shrink the longer axis's amplitude so the bend
  // is the same number of pixels on both axes.
  const short = Math.min(w, h);
  const ax = short / w;
  const ay = short / h;
  // Half resolution is plenty for a smooth gradient and keeps generation fast.
  const cw = Math.max(2, Math.round(w / 2));
  const ch = Math.max(2, Math.round(h / 2));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(cw, ch);
  const hx = w / 2;
  const hy = h / 2;
  const r = Math.min(radius, hx, hy);
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      // Position relative to the centre, in CSS px.
      const px = ((i + 0.5) / cw) * w - hx;
      const py = ((j + 0.5) / ch) * h - hy;
      // Signed distance to the rounded rectangle (negative inside).
      const qx = Math.abs(px) - (hx - r);
      const qy = Math.abs(py) - (hy - r);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const dist = outside + Math.min(Math.max(qx, qy), 0) - r;
      let dx = 0;
      let dy = 0;
      const depth = -dist;
      if (depth > 0 && depth < bevel) {
        const t = 1 - depth / bevel;
        const k = t * t;
        // Outward normal of the nearest edge or corner.
        let nx: number;
        let ny: number;
        if (qx > 0 && qy > 0) {
          const l = Math.hypot(qx, qy) || 1;
          nx = (Math.sign(px) * qx) / l;
          ny = (Math.sign(py) * qy) / l;
        } else if (qx > qy) {
          nx = Math.sign(px);
          ny = 0;
        } else {
          nx = 0;
          ny = Math.sign(py);
        }
        dx = -nx * k;
        dy = -ny * k;
      }
      const o = (j * cw + i) * 4;
      img.data[o] = Math.round(128 + dx * ax * 127);
      img.data[o + 1] = Math.round(128 + dy * ay * 127);
      img.data[o + 2] = 128;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function defs(): SVGDefsElement {
  let svg = document.getElementById(DEFS_ID) as SVGSVGElement | null;
  if (!svg) {
    svg = el("svg", { id: DEFS_ID, width: 0, height: 0, "aria-hidden": "true", focusable: "false" });
    svg.style.position = "absolute";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.style.overflow = "hidden";
    svg.appendChild(el("defs", {}));
    document.body.appendChild(svg);
  }
  return svg.querySelector("defs")!;
}

function buildFilter(id: string, map: string, scale: number, fringe: boolean): SVGFilterElement {
  const filter = el("filter", {
    id,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    primitiveUnits: "objectBoundingBox",
    "color-interpolation-filters": "sRGB",
  });
  filter.appendChild(
    el("feImage", { href: map, x: 0, y: 0, width: 1, height: 1, preserveAspectRatio: "none", result: "map" }),
  );
  const displace = (s: number, result: string) =>
    el("feDisplacementMap", {
      in: "SourceGraphic",
      in2: "map",
      scale: s,
      xChannelSelector: "R",
      yChannelSelector: "G",
      result,
    });
  if (!fringe) {
    filter.appendChild(displace(scale, "out"));
    return filter;
  }
  const channel = (input: string, row: number, result: string) => {
    const m = Array.from({ length: 4 }, (_, r) =>
      r === 3 ? "0 0 0 1 0" : r === row ? ["1 0 0 0 0", "0 1 0 0 0", "0 0 1 0 0"][r] : "0 0 0 0 0",
    ).join(" ");
    return el("feColorMatrix", { in: input, type: "matrix", values: m, result });
  };
  filter.append(
    displace(scale * 1.14, "dr"),
    displace(scale, "dg"),
    displace(scale * 0.86, "db"),
    channel("dr", 0, "r"),
    channel("dg", 1, "g"),
    channel("db", 2, "b"),
    el("feBlend", { in: "r", in2: "g", mode: "screen", result: "rg" }),
    el("feBlend", { in: "rg", in2: "b", mode: "screen" }),
  );
  return filter;
}

/**
 * Start the refraction engine. Returns a function that stops it and removes
 * everything it added. Safe to call during SSR or in unsupported engines: it
 * then does nothing and returns a no-op.
 */
export function startRefraction(options: RefractionOptions = {}): () => void {
  if (!refractionSupported()) return () => {};
  const thickness = Math.min(1, Math.max(0, options.thickness ?? 0.5));
  const bevel = Math.max(4, options.bevel ?? 18);
  const fringe = options.fringe ?? false;
  const selector = options.selector ?? GLASS_SELECTOR;
  const root = options.root ?? document;
  const scale = Math.round(8 + thickness * 48);
  const made = new Map<string, string>();
  const tracked = new Set<HTMLElement>();
  document.documentElement.dataset.refractionEngine = "svg";

  function filterFor(node: HTMLElement): string | null {
    const rect = node.getBoundingClientRect();
    // Round so near-identical sizes share one filter.
    const w = Math.round(rect.width / 4) * 4;
    const h = Math.round(rect.height / 4) * 4;
    if (w < 8 || h < 8) return null;
    const radius = Math.round(parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0);
    const key = `${w}x${h}r${radius}${fringe ? "f" : ""}t${scale}b${bevel}`;
    const hit = made.get(key);
    if (hit) return hit;
    const id = `cn-refraction-${made.size}`;
    // `scale` is in CSS px; the filter's units are fractions of the shorter side.
    defs().appendChild(buildFilter(id, drawMap(w, h, radius, bevel), scale / Math.min(w, h), fringe));
    made.set(key, id);
    return id;
  }

  function update(node: HTMLElement) {
    const id = filterFor(node);
    if (id) node.style.setProperty("--cn-refraction", `url(#${id})`);
    else node.style.removeProperty("--cn-refraction");
  }

  const resize = new ResizeObserver((entries) => {
    for (const e of entries) update(e.target as HTMLElement);
  });
  function track(node: HTMLElement) {
    if (tracked.has(node)) return;
    tracked.add(node);
    resize.observe(node);
  }
  function scan() {
    root.querySelectorAll<HTMLElement>(selector).forEach(track);
  }
  scan();
  const mutations = new MutationObserver(scan);
  mutations.observe(root instanceof Document ? root.body : (root as Node), {
    childList: true,
    subtree: true,
  });

  return () => {
    mutations.disconnect();
    resize.disconnect();
    for (const node of tracked) node.style.removeProperty("--cn-refraction");
    tracked.clear();
    for (const id of made.values()) document.getElementById(id)?.remove();
    made.clear();
    delete document.documentElement.dataset.refractionEngine;
  };
}
