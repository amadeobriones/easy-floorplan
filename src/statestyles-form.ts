import { html, type TemplateResult } from "lit";
import type { StateStyle } from "./types";

export type StateStyleKind = "room" | "item" | "furniture";

/**
 * The editor operations a stateStyles row needs, factored out so this module
 * has no dependency on the FloorplanCardEditor instance (`this`). The editor
 * passes its own bound `_addStateStyleRule`/`_removeStateStyleRule`/
 * `_updateStateStyleRule`/`_renderEntityPicker` methods as these callbacks.
 */
export interface StateStyleRowsCallbacks {
  renderEntityPicker: (
    value: string,
    onChange: (entity: string) => void,
    includeDomains?: string[],
    includeEntities?: string[]
  ) => TemplateResult;
  addRule: (kind: StateStyleKind, id: string) => void;
  removeRule: (kind: StateStyleKind, id: string, i: number) => void;
  updateRule: (kind: StateStyleKind, id: string, i: number, patch: Partial<StateStyle>, live?: boolean) => void;
}

/** The "Conditional styles" repeater: one row per rule, plus an Add-rule button. */
export function renderStateStyleRows(
  rules: StateStyle[],
  kind: StateStyleKind,
  id: string,
  defaultEntity: string | undefined,
  areaEntities: string[] | undefined,
  callbacks: StateStyleRowsCallbacks
): TemplateResult {
  return html`
    <div class="statestyles">
      <div class="statestyles-head">Conditional styles</div>
      ${rules.map((rule, i) => renderStateStyleRule(rule, kind, id, i, defaultEntity, areaEntities, callbacks))}
      <button class="add-rule" @click=${() => callbacks.addRule(kind, id)}>+ Add rule</button>
    </div>
  `;
}

/** One stateStyles rule's fields: entity, state/state_not, range, icon, colour, animation. */
export function renderStateStyleRule(
  rule: StateStyle,
  kind: StateStyleKind,
  id: string,
  i: number,
  defaultEntity: string | undefined,
  areaEntities: string[] | undefined,
  callbacks: StateStyleRowsCallbacks
): TemplateResult {
  const set = (patch: Partial<StateStyle>, live = false) => callbacks.updateRule(kind, id, i, patch, live);
  const numOrUndef = (s: string) => (s === "" ? undefined : Number(s));
  return html`
    <div class="rule">
      <div class="row wide">
        <label>When entity</label>
        ${callbacks.renderEntityPicker(rule.entity ?? "", (v) => set({ entity: v }), undefined, areaEntities)}
        <button class="rule-remove" title="Remove rule" @click=${() =>
          callbacks.removeRule(kind, id, i)}>✕</button>
      </div>
      <div class="row">
        <label>State</label>
        <input type="text" placeholder=${defaultEntity ? "is…" : "any"} .value=${rule.state ?? ""}
          @change=${(e: Event) => set({ state: (e.target as HTMLInputElement).value })} />
        <input type="text" placeholder="is not…" .value=${rule.state_not ?? ""}
          @change=${(e: Event) => set({ state_not: (e.target as HTMLInputElement).value })} />
      </div>
      <div class="row">
        <label>Range</label>
        <input class="num" type="number" placeholder="above" .value=${String(rule.above ?? "")}
          @change=${(e: Event) => set({ above: numOrUndef((e.target as HTMLInputElement).value) })} />
        <input class="num" type="number" placeholder="below" .value=${String(rule.below ?? "")}
          @change=${(e: Event) => set({ below: numOrUndef((e.target as HTMLInputElement).value) })} />
      </div>
      <div class="row wide">
        <label>Icon</label>
        <input type="text" placeholder="mdi:… (optional)" .value=${rule.icon ?? ""}
          @change=${(e: Event) => set({ icon: (e.target as HTMLInputElement).value })} />
      </div>
      <div class="row">
        <label>Colour</label>
        <input type="color" .value=${rule.color && rule.color !== "rgb" ? rule.color : "#03a9f4"}
          @input=${(e: Event) => set({ color: (e.target as HTMLInputElement).value }, true)} />
        <input type="text" placeholder='colour or "rgb"' .value=${rule.color ?? ""}
          @change=${(e: Event) => set({ color: (e.target as HTMLInputElement).value })} />
      </div>
      <div class="row">
        <label>Animation</label>
        <select @change=${(e: Event) => set({ animation: (e.target as HTMLSelectElement).value as StateStyle["animation"] })}>
          <option value="none" ?selected=${(rule.animation ?? "none") === "none"}>None</option>
          <option value="pulse" ?selected=${rule.animation === "pulse"}>Pulse</option>
          <option value="blink" ?selected=${rule.animation === "blink"}>Blink</option>
        </select>
      </div>
    </div>
  `;
}
