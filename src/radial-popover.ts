import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { HomeAssistant } from "./types";
import { clampPopoverPosition, radialDomainFor } from "./radial-controls";

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
    return html`
      <div
        class="pop"
        style="left:${this._pos.left}px; top:${this._pos.top}px; visibility:${
          this._measured ? "visible" : "hidden"
        };"
      >
        <div class="pop-title">${this._req.entity}</div>
        <div class="pop-body">${domain ?? "No quick controls for this entity yet."}</div>
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
