import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { HomeAssistant } from "./types";
import {
  clampPopoverPosition, radialDomainFor, lightBrightnessCall, climateSetpointCall, climateStep,
} from "./radial-controls";
import { executeAction } from "./actions";

export interface RadialPopoverRequest {
  hass: HomeAssistant;
  entity: string;
  /** The tapped piece's screen rect at hold time (`getBoundingClientRect()`). */
  anchor: DOMRect;
}

/**
 * The long-press quick-control popover. A singleton appended to
 * `document.body` -- the same portal pattern `action-handler.ts` already
 * uses for its own singleton element -- so it is never clipped by
 * `ha-card`'s or `.stage`'s `overflow: hidden`, and sits above the card's
 * own stacking context regardless of where the card lives in a dashboard.
 */
@customElement("easy-floorplan-radial")
export class RadialPopover extends LitElement {
  @state() private _req?: RadialPopoverRequest;
  @state() private _pos = { left: 0, top: 0 };
  @state() private _measured = false;

  private readonly _onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") this.close();
  };

  private readonly _onPointerDown = (ev: PointerEvent): void => {
    if (ev.composedPath().includes(this)) return;
    this.close();
  };

  private readonly _onScroll = (): void => {
    this.close();
  };

  public open(req: RadialPopoverRequest): void {
    this._req = req;
    this._measured = false;
    // Provisional position at the anchor's own corner; `updated()` measures
    // the now-rendered popover box and repositions precisely below, so the
    // popover is hidden (see render()) until that second, accurate pass.
    this._pos = { left: req.anchor.left, top: req.anchor.top };
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("pointerdown", this._onPointerDown, true);
    window.addEventListener("scroll", this._onScroll, true);
  }

  public close(): void {
    if (!this._req) return;
    this._req = undefined;
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("pointerdown", this._onPointerDown, true);
    window.removeEventListener("scroll", this._onScroll, true);
    this.dispatchEvent(new CustomEvent("radial-closed"));
  }

  protected updated(): void {
    if (!this._req) return;
    const box = this.shadowRoot?.querySelector(".pop") as HTMLElement | null;
    if (!box) return;
    const measured = { width: box.offsetWidth, height: box.offsetHeight };
    const next = clampPopoverPosition(this._req.anchor, measured, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    // A fresh {left,top} object literal is never === the previous one, so
    // assigning unconditionally on every pass would fail Lit's `notEqual`
    // check forever and infinite-loop update->updated->update. Only assign
    // (and thus only request a further update) when the numbers actually
    // moved; once the measured box size stabilizes (typically the very next
    // pass) this converges instead of spinning.
    if (next.left !== this._pos.left || next.top !== this._pos.top) {
      this._pos = next;
    }
    if (!this._measured) this._measured = true;
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this._req) return nothing;
    const domain = radialDomainFor(this._req.entity);
    const body =
      domain === "light" ? this._renderLight() :
      domain === "switch" ? this._renderSwitch() :
      domain === "climate" ? this._renderClimate() :
      html`<div class="pop-body">No quick controls for this entity yet.</div>`;
    return html`
      <div
        class="pop"
        style="left:${this._pos.left}px; top:${this._pos.top}px; visibility:${
          this._measured ? "visible" : "hidden"
        };"
      >
        <div class="pop-title">${this._req.entity}</div>
        ${body}
      </div>
    `;
  }

  private _toggle(): void {
    if (!this._req) return;
    executeAction(this, this._req.hass, { entity: this._req.entity }, { action: "toggle" });
  }

  private _renderLight(): TemplateResult {
    const req = this._req!;
    const state = req.hass.states[req.entity];
    const on = state?.state === "on";
    const brightness = (state?.attributes?.brightness as number | undefined) ?? 0;
    const pct = Math.round((brightness / 255) * 100);
    return html`
      <div class="pop-row">
        <button class="pop-toggle ${on ? "on" : ""}" @click=${() => this._toggle()}>
          <ha-icon icon=${on ? "mdi:lightbulb" : "mdi:lightbulb-off-outline"}></ha-icon>
        </button>
        <input
          type="range"
          min="1"
          max="100"
          step="1"
          .value=${String(pct)}
          @change=${(e: Event) => {
            const value = Number((e.target as HTMLInputElement).value);
            const call = lightBrightnessCall(req.entity, value);
            req.hass.callService(call.domain, call.service, call.data);
          }}
        />
      </div>
    `;
  }

  private _renderSwitch(): TemplateResult {
    const req = this._req!;
    const on = req.hass.states[req.entity]?.state === "on";
    return html`
      <button class="pop-toggle pop-toggle-wide ${on ? "on" : ""}" @click=${() => this._toggle()}>
        <ha-icon icon=${on ? "mdi:toggle-switch" : "mdi:toggle-switch-off-outline"}></ha-icon>
        ${on ? "On" : "Off"}
      </button>
    `;
  }

  private _renderClimate(): TemplateResult {
    const req = this._req!;
    const attrs = req.hass.states[req.entity]?.attributes ?? {};
    const current = attrs.current_temperature as number | undefined;
    const target = (attrs.temperature as number | undefined) ?? 20;
    const min = (attrs.min_temp as number | undefined) ?? 7;
    const max = (attrs.max_temp as number | undefined) ?? 35;
    const step = (attrs.target_temp_step as number | undefined) ?? 0.5;
    const setTarget = (next: number) => {
      const call = climateSetpointCall(req.entity, next);
      req.hass.callService(call.domain, call.service, call.data);
    };
    return html`
      <div class="pop-climate">
        <div class="pop-current">${current !== undefined ? `${current}°` : "—"}</div>
        <div class="pop-setpoint">
          <button @click=${() => setTarget(climateStep(target, -1, step, min, max))}>
            <ha-icon icon="mdi:minus"></ha-icon>
          </button>
          <span>${target}°</span>
          <button @click=${() => setTarget(climateStep(target, 1, step, min, max))}>
            <ha-icon icon="mdi:plus"></ha-icon>
          </button>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 500;
      pointer-events: none;
    }
    .pop {
      position: fixed;
      pointer-events: auto;
      min-width: 180px;
      max-width: 260px;
      padding: 10px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      font-size: 13px;
    }
    .pop-title {
      font-weight: 500;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pop-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pop-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border-radius: 8px;
      padding: 6px 8px;
      cursor: pointer;
    }
    .pop-toggle.on {
      background: var(--state-light-active-color, var(--state-active-color, #fdd835));
      border-color: var(--state-light-active-color, var(--state-active-color, #fdd835));
      color: var(--text-primary-color, #212121);
    }
    .pop-toggle-wide {
      width: 100%;
      justify-content: center;
    }
    .pop-row input[type="range"] {
      flex: 1;
      min-width: 0;
    }
    .pop-climate {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .pop-current {
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    .pop-setpoint {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
    }
    .pop-setpoint button {
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
  `;
}

let _singleton: RadialPopover | undefined;

function getPopover(): RadialPopover {
  if (_singleton && _singleton.isConnected) return _singleton;
  _singleton = document.createElement("easy-floorplan-radial") as RadialPopover;
  document.body.appendChild(_singleton);
  return _singleton;
}

export function openRadialPopover(req: RadialPopoverRequest): void {
  getPopover().open(req);
}

export function closeRadialPopover(): void {
  _singleton?.close();
}

declare global {
  interface HTMLElementTagNameMap {
    "easy-floorplan-radial": RadialPopover;
  }
}
