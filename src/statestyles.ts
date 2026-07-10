import type { StateStyle } from "./types";

/** Append an empty rule (a rule with no conditions is a valid "always matches" entry). */
export function addRule(rules?: StateStyle[]): StateStyle[] {
  return [...(rules ?? []), {}];
}

/** Drop rule `i`; `undefined` when the list empties (so the key is dropped, never `[]`). */
export function removeRule(rules: StateStyle[], i: number): StateStyle[] | undefined {
  const next = rules.filter((_, idx) => idx !== i);
  return next.length ? next : undefined;
}

const STRING_FIELDS = new Set(["entity", "state", "state_not", "icon", "color"]);
const NUMBER_FIELDS = new Set(["above", "below"]);

/** Merge `patch` into rule `i`, normalized: empty strings, NaN numbers and `animation:"none"` are dropped. */
export function setRule(rules: StateStyle[], i: number, patch: Partial<StateStyle>): StateStyle[] {
  return rules.map((rule, idx) => {
    if (idx !== i) return rule;
    const next = { ...rule } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) {
      if (STRING_FIELDS.has(k)) {
        if (v === "" || v == null) delete next[k];
        else next[k] = v;
      } else if (NUMBER_FIELDS.has(k)) {
        const n = typeof v === "string" && v !== "" ? Number(v) : v;
        if (typeof n !== "number" || !Number.isFinite(n)) delete next[k];
        else next[k] = n;
      } else if (k === "animation") {
        if (v === "none" || v == null) delete next.animation;
        else next.animation = v;
      } else if (v == null) {
        delete next[k];
      } else {
        next[k] = v;
      }
    }
    return next as StateStyle;
  });
}
