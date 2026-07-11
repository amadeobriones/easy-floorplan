import { describe, it, expect } from "vitest";
import { renderOpening } from "./render";
import type { OpeningStyle } from "./render";
import type { Opening } from "./types";

/**
 * Serialize a Lit SVGTemplateResult (and its nested templates/arrays) back into
 * markup so we can assert on the structural invariants of renderOpening — the
 * scale wrapper, swing angle, slider panels and partial-open transforms — which
 * are otherwise only exercised in a browser.
 */
function serialize(node: unknown): string {
  if (node == null || node === false) return "";
  if (Array.isArray(node)) return node.map(serialize).join("");
  if (typeof node === "object" && "strings" in (node as Record<string, unknown>)) {
    const { strings, values } = node as { strings: string[]; values: unknown[] };
    let out = strings[0];
    for (let i = 0; i < values.length; i++) out += serialize(values[i]) + strings[i + 1];
    return out;
  }
  return String(node);
}

const base = { id: "x", x: 100, y: 60, length: 90, angle: 0 } as const;
const svgOf = (o: Partial<Opening>, style: Partial<OpeningStyle> = {}) =>
  serialize(renderOpening({ ...base, ...o } as Opening, { color: "#000", ...style }));

describe("renderOpening — orientation mirror", () => {
  it("wraps the body in an identity scale by default (unchanged output)", () => {
    expect(svgOf({ type: "door" })).toContain("scale(1 1)");
  });
  it("mirrors via flipH / flipV", () => {
    expect(svgOf({ type: "door", flipH: true })).toContain("scale(-1 1)");
    expect(svgOf({ type: "door", flipV: true })).toContain("scale(1 -1)");
    expect(svgOf({ type: "door", flipH: true, flipV: true })).toContain("scale(-1 -1)");
  });
});

describe("renderOpening — swing door", () => {
  it("swings the leaf fully open / closed with the binary open flag", () => {
    expect(svgOf({ type: "door" }, { open: true })).toContain("rotate(-90deg)");
    expect(svgOf({ type: "door" }, { open: false })).toContain("rotate(0deg)");
  });
  it("swings partway for a fractional amount and clamps out-of-range", () => {
    expect(svgOf({ type: "door" }, { amount: 0.5 })).toContain("rotate(-45deg)");
    expect(svgOf({ type: "door" }, { amount: 2 })).toContain("rotate(-90deg)"); // clamp high
    expect(svgOf({ type: "door" }, { amount: -1 })).toContain("rotate(0deg)"); // clamp low
  });
});

const sliding = (extra: Partial<Opening> = {}) =>
  ({ type: "door", motion: "slide", ...extra }) as Partial<Opening>;

describe("renderOpening — sliding door", () => {
  it("draws a single panel that slides the full length when open", () => {
    const closed = svgOf(sliding(), { open: false });
    const open = svgOf(sliding(), { open: true });
    expect(closed).toContain("fp-slide-panel");
    expect(closed).toContain("translateX(0px)");
    expect(open).toContain("translateX(90px)"); // length 90
  });
  it("slides partway for a fractional amount", () => {
    expect(svgOf(sliding(), { amount: 0.5 })).toContain("translateX(45px)");
  });
  it("draws two panels for a bypass slider that stack to one side", () => {
    const bypass = svgOf(sliding({ sliderStyle: "bypass" }), { open: true });
    // two half-width (45) panels + moving panel stacks by -half when open
    expect(bypass.match(/width=45/g)?.length).toBe(2);
    expect(bypass).toContain("translateX(-45px)");
  });
  it("parts two panels in opposite directions for a biparting slider", () => {
    const closed = svgOf(sliding({ sliderStyle: "biparting" }), { open: false });
    const open = svgOf(sliding({ sliderStyle: "biparting" }), { open: true });
    expect(closed.match(/width=45/g)?.length).toBe(2);
    expect(closed).toContain("translateX(0px)"); // meet in the middle when closed
    // one panel recesses left, the other right, by half (45) each when open
    expect(open).toContain("translateX(-45px)");
    expect(open).toContain("translateX(45px)");
  });
  it("draws solid door panels (thickness 2.5)", () => {
    expect(svgOf(sliding(), { open: false })).toContain("height=2.5");
  });
});

describe("renderOpening — sliding window", () => {
  it("slides like a slider but with thin glass panels (thickness 1.5)", () => {
    const win = svgOf({ type: "window", motion: "slide" }, { open: true });
    expect(win).toContain("fp-slide-panel");
    expect(win).toContain("translateX(90px)"); // same slide as a single-panel door
    expect(win).toContain("height=1.5"); // thinner glass panel
    expect(win).not.toContain("height=2.5"); // not a solid door panel
  });
});

const count = (s: string, needle: string): number => s.split(needle).length - 1;

describe("renderOpening — double door (motion: swing, doorStyle: double)", () => {
  it("renders two leaves and two swing arcs", () => {
    const v = svgOf({ type: "door", motion: "swing", doorStyle: "double" });
    expect(v).toContain("fp-door-leaf");
    expect(v).toContain("fp-leaf-r");
    expect(count(v, "fp-door-arc")).toBe(2);
  });

  it("a single door (doorStyle unset) has only the left leaf", () => {
    const v = svgOf({ type: "door", motion: "swing" });
    expect(v).toContain("fp-door-leaf");
    expect(v).not.toContain("fp-leaf-r");
  });
});

describe("renderOpening — swing window is unchanged by the double-door refactor", () => {
  it("is byte-identical to the pre-refactor casement body (guards the doubleSwingBody extraction)", () => {
    const win = svgOf({ type: "window", motion: "swing" });
    expect(win).toBe(
      '<g transform="translate(100 60) rotate(0)">' +
        '\n      <g transform="scale(1 1)">' +
        "\n        <!-- jambs -->" +
        '\n        <line x1=-45 y1=-6 x2=-45 y2=6' +
        '\n              stroke=#000 stroke-width="2" />' +
        '\n        <line x1=45 y1=-6 x2=45 y2=6' +
        '\n              stroke=#000 stroke-width="2" />' +
        "\n        <!-- swing arcs, drawn from the middle outward -->" +
        '\n        <path class="fp-door-arc" d="M 0 0 A 45 45 0 0 0 -45 -45"' +
        '\n              fill="none" stroke-width="1.5" stroke-dasharray=70.68583470577035' +
        '\n              style="stroke:#000;stroke-dashoffset:0;" />' +
        '\n        <path class="fp-door-arc" d="M 0 0 A 45 45 0 0 1 45 -45"' +
        '\n              fill="none" stroke-width="1.5" stroke-dasharray=70.68583470577035' +
        '\n              style="stroke:#000;stroke-dashoffset:0;" />' +
        "\n        <!-- left leaf, hinged at left jamb -->" +
        '\n        <g transform="translate(-45 0)">' +
        '\n          <g class="fp-door-leaf" style="transform:rotate(-90deg);">' +
        '\n            <rect x="0" y="-1.25" width=45 height="2.5" style="fill:#000;" />' +
        "\n          </g>" +
        "\n        </g>" +
        "\n        <!-- right leaf, hinged at right jamb -->" +
        '\n        <g transform="translate(45 0)">' +
        '\n          <g class="fp-leaf-r" style="transform:rotate(90deg);">' +
        '\n            <rect x=-45 y="-1.25" width=45 height="2.5" style="fill:#000;" />' +
        "\n          </g>" +
        "\n        </g>" +
        "\n      </g>" +
        "\n    </g>",
    );
  });
});

describe("renderOpening — garage door (motion: roll)", () => {
  it("renders a garage panel with 3 section ticks", () => {
    const v = svgOf({ type: "door", motion: "roll" });
    expect(v).toContain("fp-garage-panel");
    // Ticks are the only lines drawn at y1="-2.5" (jambs use cutH/2, the
    // overhead track line uses y="0").
    expect(count(v, 'y1="-2.5"')).toBe(3);
  });

  it("is full and opaque when closed (amount 0)", () => {
    const v = svgOf({ type: "door", motion: "roll" }, { amount: 0 });
    expect(v).toContain("transform:scaleX(1);opacity:1;");
  });

  it("is cleared and transparent when open (amount 1)", () => {
    const v = svgOf({ type: "door", motion: "roll" }, { amount: 1 });
    expect(v).toContain("transform:scaleX(0);opacity:0;");
  });
});

describe("renderOpening — bi-fold door (motion: fold)", () => {
  it("defaults to 2 fold panels", () => {
    const v = svgOf({ type: "door", motion: "fold" });
    expect(count(v, 'class="fp-fold-panel"')).toBe(2);
  });

  it("renders 4 panels when foldPanels: 4", () => {
    const v = svgOf({ type: "door", motion: "fold", foldPanels: 4 });
    expect(count(v, 'class="fp-fold-panel"')).toBe(4);
  });

  it("the fold angle is 0 closed and FOLD_MAX_DEG (80) open", () => {
    const closed = svgOf({ type: "door", motion: "fold" }, { amount: 0 });
    const open = svgOf({ type: "door", motion: "fold" }, { amount: 1 });
    expect(closed).toContain("rotate(0deg)");
    expect(open).toContain("rotate(-80deg)");
    expect(closed).not.toEqual(open);
  });
});

describe("renderOpening — existing symbols are unaffected", () => {
  it("a plain single swing door still renders only fp-door-leaf", () => {
    const v = svgOf({ type: "door" });
    expect(v).toContain("fp-door-leaf");
    expect(v).not.toContain("fp-leaf-r");
    expect(v).not.toContain("fp-garage-panel");
    expect(v).not.toContain("fp-fold-panel");
  });

  it("a slider still renders fp-slide-panel", () => {
    const v = svgOf({ type: "door", motion: "slide" });
    expect(v).toContain("fp-slide-panel");
    expect(v).not.toContain("fp-garage-panel");
    expect(v).not.toContain("fp-fold-panel");
  });
});
