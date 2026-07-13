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
