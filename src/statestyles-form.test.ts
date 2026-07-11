import { describe, it, expect, vi } from "vitest";
import { html } from "lit";
import { renderStateStyleRows, renderStateStyleRule, type StateStyleRowsCallbacks } from "./statestyles-form";
import type { StateStyle } from "./types";

// Full recursive serialization (strings interleaved with values, including a
// nested TemplateResult like the entity-picker stub) -- same helper used by
// awareness.test.ts / render.test.ts.
interface TplLike { strings: readonly string[]; values: unknown[] }
const isTpl = (v: unknown): v is TplLike => !!v && typeof v === "object" && "strings" in v && "values" in v;
const serialize = (t: unknown): string => {
  const tpl = t as TplLike;
  let out = tpl.strings[0];
  for (let i = 0; i < tpl.values.length; i++) {
    const v = tpl.values[i];
    out += isTpl(v) ? serialize(v) : typeof v === "function" ? "" : Array.isArray(v) ? v.map(serialize).join("") : String(v);
    out += tpl.strings[i + 1];
  }
  return out;
};

function stubCallbacks(overrides: Partial<StateStyleRowsCallbacks> = {}): StateStyleRowsCallbacks {
  return {
    renderEntityPicker: (value) => html`<input class="entity-picker" .value=${value} />`,
    addRule: vi.fn(),
    removeRule: vi.fn(),
    updateRule: vi.fn(),
    ...overrides,
  };
}

describe("renderStateStyleRows", () => {
  it("renders one .rule row per rule, plus the add-rule button", () => {
    const rules: StateStyle[] = [{ state: "on" }, { state: "off" }, { above: 10 }];
    const out = serialize(renderStateStyleRows(rules, "item", "it1", "light.x", undefined, stubCallbacks()));
    expect((out.match(/class="rule"/g) ?? []).length).toBe(3);
    expect(out).toContain('class="add-rule"');
    expect(out).toContain("+ Add rule");
  });

  it("renders zero rule rows for an empty rules array, but keeps the add-rule button", () => {
    const out = serialize(renderStateStyleRows([], "room", "r1", undefined, undefined, stubCallbacks()));
    expect((out.match(/class="rule"/g) ?? []).length).toBe(0);
    expect(out).toContain('class="add-rule"');
  });

  it("clicking + Add rule invokes callbacks.addRule with the row's kind and id", () => {
    const addRule = vi.fn();
    const tpl = renderStateStyleRows([], "furniture", "f9", undefined, undefined, stubCallbacks({ addRule }));
    // The add-rule button's click handler is the only zero-arity function among the top-level values.
    const clickHandler = tpl.values.find((v) => typeof v === "function" && v.length === 0) as
      | (() => void)
      | undefined;
    expect(clickHandler).toBeTruthy();
    clickHandler?.();
    expect(addRule).toHaveBeenCalledWith("furniture", "f9");
  });
});

describe("renderStateStyleRule", () => {
  const rule: StateStyle = {
    entity: "sensor.x",
    state: "on",
    state_not: "off",
    above: 10,
    below: 20,
    icon: "mdi:home",
    color: "#ff0000",
    animation: "pulse",
  };

  it("renders the rule's field values into the template", () => {
    const out = serialize(renderStateStyleRule(rule, "item", "it1", 0, "light.x", undefined, stubCallbacks()));
    expect(out).toContain("sensor.x"); // routed through the (stubbed) entity picker
    expect(out).toContain("mdi:home");
    expect(out).toContain("#ff0000");
    // .value bindings for the numeric/text fields render bare (no surrounding quotes).
    expect(out).toContain(".value=on");
    expect(out).toContain(".value=off");
    expect(out).toContain(".value=10");
    expect(out).toContain(".value=20");
  });

  it("defaults the State placeholder to 'is…' when a defaultEntity is set, else 'any'", () => {
    const withDefault = serialize(renderStateStyleRule({}, "item", "it1", 0, "light.x", undefined, stubCallbacks()));
    expect(withDefault).toContain("placeholder=is…");
    const withoutDefault = serialize(
      renderStateStyleRule({}, "item", "it1", 0, undefined, undefined, stubCallbacks())
    );
    expect(withoutDefault).toContain("placeholder=any");
  });

  it("passes areaEntities through to the entity picker callback", () => {
    const renderEntityPicker = vi.fn(() => html`<input />`);
    renderStateStyleRule({}, "room", "r1", 0, undefined, ["sensor.a", "sensor.b"], stubCallbacks({
      renderEntityPicker,
    }));
    expect(renderEntityPicker).toHaveBeenCalledWith("", expect.any(Function), undefined, ["sensor.a", "sensor.b"]);
  });

  it("clicking the remove button invokes callbacks.removeRule with kind, id, and index", () => {
    const removeRule = vi.fn();
    const tpl = renderStateStyleRule({}, "room", "r7", 2, undefined, undefined, stubCallbacks({ removeRule }));
    // Every other event handler in this template takes an Event argument; the
    // remove button's click handler is the only zero-arity one.
    const clickHandler = tpl.values.find((v) => typeof v === "function" && v.length === 0) as
      | (() => void)
      | undefined;
    expect(clickHandler).toBeTruthy();
    clickHandler?.();
    expect(removeRule).toHaveBeenCalledWith("room", "r7", 2);
  });
});
