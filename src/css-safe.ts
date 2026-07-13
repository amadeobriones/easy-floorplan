/**
 * Sanitise a user-supplied CSS colour before it is interpolated into a `style`
 * attribute.
 *
 * A floorplan config is shareable and importable, so its colour strings are
 * attacker-controlled. Lit does **not** escape `;` or `}` inside a style-attribute
 * expression, so a value like `red;position:fixed;inset:0;z-index:99999` breaks out
 * of its declaration and paints a full-viewport overlay over Home Assistant, and
 * `red;background-image:url(https://evil/x)` turns into a remote fetch that beacons
 * the viewer's IP. Neither is hypothetical — both were reproduced by parsing the
 * emitted DOM.
 *
 * Fail-closed and structural, so it accepts the full range of real values — hex,
 * named/CSS-wide keywords, `rgb/hsl/oklch/…`, `color-mix`, gradients, and
 * arbitrarily nested `var()` / `rgb(var(--…))` (Home Assistant stores theme colours
 * as bare `r, g, b` triplets read back as `rgb(var(--rgb-primary-color))`, and chains
 * fallbacks as `var(--a, var(--b, #fff))`, so nesting must pass) — while still
 * guaranteeing no breakout.
 */

/**
 * Functions that are inert as a CSS *value*. An allowlist: anything not listed
 * (`url()`, `image-set()`, `cross-fade()`, `element()`, `paint()`, `attr()`,
 * legacy `expression()`, …) is rejected, so a resource fetch or worklet can never
 * appear, even nested inside `var()`/`rgb()`.
 */
const SAFE_FUNCS = new Set([
  "rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch",
  "color", "color-mix", "light-dark",
  "var", "env",
  "calc", "clamp", "min", "max", "abs", "round", "mod", "rem",
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "pow", "sqrt", "hypot", "log", "exp",
  "linear-gradient", "radial-gradient", "conic-gradient",
  "repeating-linear-gradient", "repeating-radial-gradient", "repeating-conic-gradient",
]);

// The characters a colour / gradient value is built from. Excludes `;` `{` `}`
// `"` `'` `:` `@` `\` `!` and every control char — so an accepted value can neither
// end its declaration nor start a new one, nor carry a quoted or `data:` URL.
const SAFE_CHARS = /^[a-z0-9#%.,/_() +*-]+$/i;
const FUNC_CALL = /([a-z][a-z0-9-]*)\s*\(/gi;

/**
 * The colour if it is safe to place in a `style` attribute, else `undefined`:
 * allowed characters only, balanced parens, and every function on the
 * {@link SAFE_FUNCS} allowlist. Whitespace is trimmed; empty and non-strings
 * return `undefined`.
 */
export function cssColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!v) return undefined;
  if (!SAFE_CHARS.test(v)) return undefined;
  if (v.includes("/*") || v.includes("*/")) return undefined; // no comments
  if (!/^[a-z#]/i.test(v)) return undefined; // must read as a colour/keyword/function
  // Balanced parens, never dropping below zero.
  let depth = 0;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === "(") depth++;
    else if (c === ")" && --depth < 0) return undefined;
  }
  if (depth !== 0) return undefined;
  // Every function call must be inert (fail closed on anything unknown).
  const funcs = new RegExp(FUNC_CALL.source, "gi");
  for (let m: RegExpExecArray | null; (m = funcs.exec(v)); ) {
    if (!SAFE_FUNCS.has(m[1].toLowerCase())) return undefined;
  }
  return v;
}

/**
 * `cssColor(value) ?? fallback` — the value if safe, otherwise the (trusted,
 * caller-supplied) fallback. Use at every point a config colour reaches a style.
 */
export function cssColorOr(value: unknown, fallback: string): string {
  return cssColor(value) ?? fallback;
}
