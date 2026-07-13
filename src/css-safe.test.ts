import { describe, it, expect } from "vitest";
import { cssColor, cssColorOr } from "./css-safe";

describe("cssColor accepts every legitimate colour form", () => {
  it.each([
    "#fff",
    "#ffcc00",
    "#ffcc0080",
    "#FC0",
    "red",
    "transparent",
    "currentColor",
    "cornflowerblue",
    "rgb(255, 128, 0)",
    "rgba(255,128,0,0.5)",
    "rgb(255 128 0)",
    "rgb(255 128 0 / 50%)",
    "hsl(200, 50%, 40%)",
    "hsl(200deg 50% 40%)",
    "hsla(200, 50%, 40%, 0.5)",
    // Modern colour spaces — oklch is the default output of many pickers now.
    "oklch(0.7 0.15 200)",
    "oklab(0.7 0.1 -0.1)",
    "lab(52% 40 60)",
    "lch(52% 60 40)",
    "hwb(200 30% 20%)",
    "color(display-p3 1 0 0)",
    "var(--primary-color)",
    "var(--primary-color, #03a9f4)",
    "  #fff  ",
  ])("accepts %s", (v) => {
    expect(cssColor(v)).toBe(v.trim());
  });
});

describe("cssColor rejects the demonstrated injection payloads", () => {
  it.each([
    // Full-viewport overlay over the HA UI (clickjacking / defacement).
    "red;position:fixed;inset:0;z-index:99999",
    // Remote fetch = viewer-IP beacon, bypassing HA's no-remote-content posture.
    "red;background-image:url(https://evil.example/x.png)",
    "url(https://evil.example/x.png)",
    "#fff;background:url(https://evil/x)",
    // style-element breakout characters
    "red}html{display:none",
    "red{",
    // legacy IE, still worth blocking
    "expression(alert(1))",
    // sneaky function-position injection
    "rgb(0,0,0);x:y",
    "var(--x); background: url(https://evil/y)",
    "var(--x, url(https://evil))",
    // Broadened FUNC allowlist must not let injection ride a modern function.
    "color(url(https://evil/x))",
    "oklch(0.7 0.15 200);position:fixed",
    "hwb(200 30% 20%);background:url(evil)",
    "oklch(0.7);}html{display:none",
  ])("rejects %s", (v) => {
    expect(cssColor(v)).toBeUndefined();
  });

  it("rejects non-strings and empties", () => {
    for (const v of [undefined, null, 42, {}, [], "", "   "]) {
      expect(cssColor(v)).toBeUndefined();
    }
  });

  it("a rejected value contains no character that could break out of the declaration", () => {
    // Belt and braces: whatever slips through the allowlist must be inert anyway.
    const dangerous = /[;{}()]/;
    for (const v of ["red;x:y", "a{b}", "url(x)", "var(--a, ;)"]) {
      const out = cssColor(v);
      if (out !== undefined) expect(out).not.toMatch(dangerous);
    }
  });
});

describe("cssColorOr falls back to the trusted default", () => {
  it("keeps a safe value", () => {
    expect(cssColorOr("#abc", "var(--primary)")).toBe("#abc");
  });
  it("substitutes the fallback for an unsafe value — the injection never renders", () => {
    expect(cssColorOr("red;position:fixed", "var(--primary)")).toBe("var(--primary)");
  });
  it("substitutes the fallback for a missing value", () => {
    expect(cssColorOr(undefined, "#000")).toBe("#000");
  });
});

describe("cssColor — HA theme idioms across versions + structural safety", () => {
  const LEGIT = [
    // named / hex / literal rgb/hsl (all HA versions)
    "pink", "red", "transparent", "currentColor", "#ffffff", "#03a9f480",
    "rgb(255, 255, 255)", "rgba(0,0,0,0.5)", "hsl(200,90%,48%)",
    // traditional var() + Polymer/MDC era vars
    "var(--primary-color)", "var(--card-background-color)",
    "var(--paper-item-icon-color)", "var(--mdc-theme-primary)",
    // 2022.12+ RGB-triplet idiom (colours stored as bare "r,g,b")
    "rgb(var(--rgb-primary-color))", "rgba(var(--rgb-primary-color), 0.5)",
    "rgba(var(--rgb-accent-color), var(--opacity, 0.3))",
    // nested fallback chains + modern functions
    "var(--ha-card-border-color, var(--divider-color))",
    "var(--x, var(--y, #fff))",
    "color-mix(in srgb, var(--primary-color), transparent 40%)",
    "light-dark(#fff, #000)", "oklch(0.7 0.1 200)",
  ];
  for (const v of LEGIT) it(`accepts ${v}`, () => expect(cssColor(v)).toBe(v));

  const ATTACKS = [
    "red;position:fixed;inset:0", "red}body{x:1", "url(//evil)", "URL(//evil)",
    "var(--x, url(//evil))", "var(--a, var(--b, url(//evil)))",
    "rgb(var(--x));position:fixed", "image-set(//e)", "expression(1)",
    "attr(data-x)", "element(#y)", "paint(w)", "red !important",
    "red/**/;x:1", "#fff\\3b evil", 'red"x', "red<x", "10px;color:red",
  ];
  for (const a of ATTACKS) it(`rejects ${JSON.stringify(a)}`, () => expect(cssColor(a)).toBeUndefined());

  it("cssColorOr falls back on unsafe, keeps safe", () => {
    expect(cssColorOr("rgb(var(--rgb-primary-color))", "red")).toBe("rgb(var(--rgb-primary-color))");
    expect(cssColorOr("red;evil", "var(--primary-color)")).toBe("var(--primary-color)");
  });
});
