import { LitElement, html, css, svg, nothing, type TemplateResult, type PropertyValues } from "lit";
import {
  ELEMENT_ANIMATION_CSS_BASE,
  ELEMENT_ANIMATION_CSS_REACTIVE,
  ELEMENT_ANIMATION_CSS_EQ,
} from "./element-styles";
import { customElement, property, state } from "lit/decorators.js";
import type {
  HomeAssistant, FloorplanCardConfig, FloorItem, FloorText, Floor, Rotation, Furniture, ItemKind, Room,
} from "./types";
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_ITEM_SIZE,
  DEFAULT_TEXT_SIZE,
  DEFAULT_RIPPLE_SIZE,
  getFloors,
  trackerPresenceDetected,
} from "./types";
import {
  WALL_THICKNESS,
  renderOpening,
  renderWallMask,
  resolveOpeningAmount,
  openingIsActive,
  openingClickAction,
  renderRipple,
  renderFurniture,
  renderRoom,
  roomIsTappable,
  renderTracker,
  trackerSensorReading,
  itemStateText,
  resolveStateStyle,
  type ResolvedStyle,
  hassRenderInputsChanged,
  collectWatchedEntities,
  entityIsActive,
  furnitureNowPlaying,
  resolveItemIcon,
  lightVisual,
} from "./render";
import type { Opening } from "./types";
import { enabledLayers, layerWatchedEntities, type LiveLayer } from "./layers";
import type { FeatureName } from "./features";
import { featureEnabled } from "./features";
// Registers the room-tint overlay into the live-layer registry; the layer
// framework (src/layers.ts) renders it, gives it a toggle chip, and folds its
// watched entity into the card automatically once features.lightsLayer is on.
// Nothing else in this file references lights.ts directly.
import "./lights";
// Registers the room warm/cool thermal tint into the live-layer registry, the
// same way "./lights" does above -- see thermal.ts's THERMAL_LAYER.
import "./thermal";
// Side-effect import: registers the awareness layer into the layer
// framework's LIVE_LAYERS registry. Nothing else in this file changes --
// the framework renders/toggles/watches it generically once registered.
import "./awareness-layer";
// Side-effect import: registers the energy layer (power-coloured item cues)
// into the layer framework's LIVE_LAYERS registry, the same way the three
// imports above do. See energy-layer.ts's energyLayer.
import "./energy-layer";
import { actionForGesture, executeAction, hasAction } from "./actions";
import { actionHandler } from "./action-handler";
import { resolveRoomAction } from "./areas";
import { normalizeRotation, stageAspect, plateClass, plateVars, counterRotate } from "./rotation";

@customElement("easy-floorplan-card")
export class FloorplanCard extends LitElement {
  private static _nextWallMaskId = 0;

  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: FloorplanCardConfig;
  /** View-state: which floor is shown. Never persisted to config. */
  @state() private _activeFloorId?: string;
  /** View-state: enabled live layers the user has hidden via a toggle chip. Never persisted to config. */
  @state() private _hiddenLayers = new Set<FeatureName>();
  private readonly _wallMaskId = `fp-wall-mask-${FloorplanCard._nextWallMaskId++}`;
  /** Entity ids this plan actually displays; used to skip irrelevant hass updates. */
  private _watchedEntities: Set<string> = new Set();

  public setConfig(config: FloorplanCardConfig): void {
    // Cheap shape assertions so malformed YAML surfaces as HA's error card
    // instead of a render crash deep inside the SVG.
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    const raw = config as Record<string, unknown>;
    for (const key of ["rooms", "walls", "openings", "items", "texts", "furniture", "trackers", "floors"]) {
      if (raw[key] !== undefined && !Array.isArray(raw[key]))
        throw new Error(`Invalid configuration: "${key}" must be a list`);
    }
    for (const key of ["width", "height", "grid"]) {
      if (raw[key] !== undefined && typeof raw[key] !== "number")
        throw new Error(`Invalid configuration: "${key}" must be a number`);
    }
    this._config = {
      ...config,
      width: config.width ?? DEFAULT_WIDTH,
      height: config.height ?? DEFAULT_HEIGHT,
      walls: config.walls ?? [],
      openings: config.openings ?? [],
      items: config.items ?? [],
      texts: config.texts ?? [],
      furniture: config.furniture ?? [],
    };
    // Enabled live layers can watch entities the plan itself doesn't
    // reference (e.g. a whole-home energy sensor); union them in so the card
    // re-renders when those change too. A disabled/unregistered layer
    // contributes nothing.
    this._watchedEntities = new Set([
      ...collectWatchedEntities(this._config),
      ...layerWatchedEntities(this._config),
    ]);
  }

  /**
   * HA pushes a fresh `hass` on every state change anywhere in the instance —
   * for most updates nothing on this plan moved. Skip those renders entirely.
   */
  protected shouldUpdate(changed: PropertyValues): boolean {
    // Anything but a pure hass tick (config change, floor switch, first render).
    if (!(changed.size === 1 && changed.has("hass"))) return true;
    const prev = changed.get("hass") as HomeAssistant | undefined;
    if (!prev || !this.hass) return true;
    return hassRenderInputsChanged(prev, this.hass, this._watchedEntities);
  }

  public getCardSize(): number {
    return 6;
  }

  public static async getConfigElement() {
    await import("./editor");
    return document.createElement("easy-floorplan-card-editor");
  }

  public static getStubConfig(): Partial<FloorplanCardConfig> {
    // Minimal on purpose: the editor migrates to the floors model on first
    // edit, and defaults (width/height/grid) backfill in setConfig.
    return {};
  }

  /** Sections-view sizing (grid rows ≈ 56px): room for the 5:3 default canvas. */
  public static getGridOptions() {
    return { columns: 12, rows: 8, min_columns: 6, min_rows: 4 };
  }

  private _isOn(item: FloorItem): boolean {
    return item.entity ? entityIsActive(item.entity, this.hass?.states[item.entity]?.state) : false;
  }

  /** How far open an opening should be drawn (0..1), from its entity (or default). */
  private _openingAmount(o: Opening): number {
    const state = o.entity ? this.hass?.states[o.entity] : undefined;
    return resolveOpeningAmount(o, state);
  }

  /** Whether an opening wears its accent: drawn open, or a cover still in transit. */
  private _openingActive(o: Opening): boolean {
    const state = o.entity ? this.hass?.states[o.entity] : undefined;
    return openingIsActive(o, state);
  }

  /** The first matching conditional rule for this item, if any. */
  private _itemStyle(item: FloorItem): ResolvedStyle | undefined {
    return resolveStateStyle(item.stateStyles, this.hass, item.entity);
  }

  /**
   * Widened past `FloorItem` so a furniture-badge adapter (no domain `kind`
   * of its own; `_renderFurnitureBadge` passes `"generic"`) shares this and
   * `_renderBadge` verbatim with items.
   */
  private _itemIcon(item: { entity?: string; kind: ItemKind; icon?: string }): string {
    // No entity: no state to read and no registry entry to override the icon.
    const e = item.entity;
    return resolveItemIcon(
      item,
      e ? this.hass?.states[e] : undefined,
      e ? this.hass?.entities?.[e]?.icon : undefined,
    );
  }

  private _label(item: FloorItem): string {
    if (item.name) return item.name;
    if (!item.entity) return "";
    return (
      (this.hass?.states[item.entity]?.attributes?.friendly_name as string | undefined) ??
      item.entity
    );
  }

  private _handleItemAction(
    ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>,
    item: FloorItem
  ): void {
    if (!this.hass) return;
    executeAction(this, this.hass, item, actionForGesture(item, ev.detail.action));
  }

  private _handleFurnitureAction(
    ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>,
    f: Furniture
  ): void {
    if (!this.hass) return;
    executeAction(this, this.hass, f, actionForGesture(f, ev.detail.action));
  }

  /**
   * Tapping a room (2a): resolve either the built-in "toggle area lights"
   * convenience or a generic action, reusing `executeAction` exactly as
   * furniture does for the generic path.
   */
  private _handleRoomAction(
    ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>,
    r: Room
  ): void {
    if (!this.hass) return;
    const resolved = resolveRoomAction(r, ev.detail.action, this.hass);
    if (resolved.kind === "toggle-lights") {
      if (resolved.entityIds.length) {
        this.hass.callService("homeassistant", "toggle", { entity_id: resolved.entityIds });
      }
      return;
    }
    executeAction(this, this.hass, { entity: undefined }, resolved.config);
  }

  /**
   * Tapping an entity-bound opening: toggle a controllable `cover`, otherwise
   * open the entity's more-info dialog (read-only `binary_sensor`s and
   * position-only covers). See {@link openingClickAction}.
   */
  private _onOpeningClick(o: Opening): void {
    if (!this.hass || !o.entity) return;
    const features = (this.hass.states[o.entity]?.attributes?.supported_features as number) ?? 0;
    if (openingClickAction(o.entity, features) === "cover-toggle") {
      this.hass.callService("cover", "toggle", { entity_id: o.entity });
    } else {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", {
          detail: { entityId: o.entity },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private _renderBadge(
    item: { entity?: string; kind: ItemKind; icon?: string; size?: number; angle?: number },
    style?: ResolvedStyle,
  ): TemplateResult {
    const size = item.size ?? DEFAULT_ITEM_SIZE;
    // A matched rule's icon beats the item's own: it is the more specific one.
    const icon = style?.icon ?? this._itemIcon(item);
    const colour = style?.color
      ? `background:${style.color};border-color:${style.color};`
      : "";
    return html`
      <div
        class="badge"
        style="width:${size}px;height:${size}px;transform:rotate(${item.angle ?? 0}deg);${colour}"
      >
        <ha-icon icon=${icon} style="--mdc-icon-size:${Math.round(size * 0.62)}px;"></ha-icon>
      </div>
    `;
  }

  private _renderItem(
    item: FloorItem,
    c: FloorplanCardConfig,
    rot: Rotation,
  ): TemplateResult | typeof nothing {
    const style = this._itemStyle(item);
    const on = this._isOn(item);
    // No entity, no reading to show -- an explicit showState cannot conjure one.
    const showState = !!item.entity && (item.showState ?? item.kind === "sensor");
    const showIcon = item.showIcon ?? true;
    const display = item.display ?? "badge";
    const rippleColor = item.rippleColor ?? "var(--primary-color, #03a9f4)";
    const rippleSize = item.rippleSize ?? DEFAULT_RIPPLE_SIZE;

    let visual: TemplateResult | typeof nothing = nothing;
    if (display === "ripple") {
      visual = renderRipple(on, rippleColor, rippleSize);
    } else if (display === "iconRipple") {
      visual = html`<div class="stack">
        ${renderRipple(on, rippleColor, rippleSize)}
        ${showIcon ? html`<div class="stack-icon">${this._renderBadge(item, style)}</div>` : nothing}
      </div>`;
    } else if (showIcon) {
      visual = this._renderBadge(item, style);
    }

    // With no badge and no ripple the label IS the item, so it must centre on the
    // coordinate rather than hang below a zero-height column. (`showIcon: false`.)
    const labelOnly = visual === nothing;

    // Nothing to draw and nothing to read: an empty div carrying role="button",
    // tabindex and a pointer cursor is an invisible thing to click on.
    if (visual === nothing && !showState) return nothing;

    return html`
      <div
        class="item ${on ? "on" : "off"} ${labelOnly ? "label-only" : ""} ${
          style?.animation && style.animation !== "none" ? `anim-${style.animation}` : ""
        }"
        style="left:${(item.x / c.width) * 100}%; top:${(item.y / c.height) * 100}%;${
          rot ? ` transform: translate(-50%, -50%) rotate(${counterRotate(0, rot)}deg);` : ""
        }"
        title=${this._label(item)}
        role="button"
        tabindex="0"
        @action=${(ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>) =>
          this._handleItemAction(ev, item)}
        .actionHandler=${actionHandler({
          hasHold: hasAction(item.hold_action),
          hasDoubleClick: hasAction(item.double_tap_action),
        })}
      >
        ${visual}
        ${showState ? html`<span class="label">${itemStateText(this.hass, item)}</span>` : nothing}
      </div>
    `;
  }

  /**
   * A furniture piece's state badge: 22px, straddling the piece's top-right
   * corner (post-rotation), upright regardless of the piece's own angle or
   * the floor's rotation. Shown for entity-bound furniture that shows its
   * state, or whose matched rule resolves an icon. Reuses `_renderBadge` and
   * the `.item`/`.badge`/`.label` styles verbatim -- see
   * docs/superpowers/specs/smart-furniture-look.md §2.
   */
  private _renderFurnitureBadge(
    f: Furniture,
    style: ResolvedStyle | undefined,
    c: FloorplanCardConfig,
    rot: Rotation,
  ): TemplateResult | typeof nothing {
    if (!f.entity || !(f.showState || style?.icon)) return nothing;
    const theta = ((f.angle ?? 0) * Math.PI) / 180;
    const hw = f.w / 2;
    const hh = f.h / 2;
    const badgeX = f.x + hw * Math.cos(theta) + hh * Math.sin(theta);
    const badgeY = f.y + hw * Math.sin(theta) - hh * Math.cos(theta);
    return html`
      <div
        class="item ${
          style?.animation && style.animation !== "none" ? `anim-${style.animation}` : ""
        }"
        style="left:${(badgeX / c.width) * 100}%; top:${(badgeY / c.height) * 100}%;${
          rot ? ` transform: translate(-50%, -50%) rotate(${counterRotate(0, rot)}deg);` : ""
        }"
        role="button"
        tabindex="0"
        @action=${(ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>) =>
          this._handleFurnitureAction(ev, f)}
        .actionHandler=${actionHandler({
          hasHold: hasAction(f.hold_action),
          hasDoubleClick: hasAction(f.double_tap_action),
        })}
      >
        ${this._renderBadge({ entity: f.entity, kind: "generic", size: 22 }, style)}
        ${f.showState ? html`<span class="label">${itemStateText(this.hass, f)}</span>` : nothing}
      </div>
    `;
  }

  private _renderText(t: FloorText, c: FloorplanCardConfig, rot: Rotation): TemplateResult {
    return html`
      <div
        class="text"
        style="left:${(t.x / c.width) * 100}%; top:${(t.y / c.height) * 100}%;
               font-size:${t.size ?? DEFAULT_TEXT_SIZE}px;
               color:${t.color ?? "var(--primary-text-color)"};
               transform:translate(-50%,-50%) rotate(${counterRotate(t.angle ?? 0, rot)}deg);"
      >
        ${t.text}
      </div>
    `;
  }

  protected render(): TemplateResult {
    if (!this._config) return html`${nothing}`;
    const c = this._config;
    const floors = getFloors(c);
    const active =
      floors.find((f) => f.id === this._activeFloorId) ??
      floors.find((f) => f.id === c.defaultFloor) ??
      floors[0];
    const rot = normalizeRotation(active.rotation);
    // Captured so the closure below narrows to non-undefined -- LiveLayer's
    // ctx wants a definite RenderHass, and with no hass yet there is nothing
    // live to draw anyway.
    const hass = this.hass;
    const layers = enabledLayers(c);
    const visibleLayers = layers.filter((l) => !this._hiddenLayers.has(l.id));
    return html`
      <ha-card .header=${c.title ?? nothing}>
        <div
          class="stage"
          style="aspect-ratio: ${stageAspect(c.width, c.height, rot)}; background:${c.background ??
          "var(--card-background-color, #fff)"};"
        >
          <div class="plate ${plateClass(rot)}" style="${plateVars(c.width, c.height, rot)}">
<!-- preserveAspectRatio="none" is correct, and now provably so. The .plate box
               always carries the natural width/height ratio (aspect-ratio: var(--fp-arw)),
               so the SVG's box equals its viewBox and "none" never distorts. .plate also
               holds the .items HTML overlay, so both layers letterbox and rotate as one
               unit -- the badges can no longer drift off their walls when card-mod or a
               grid row-count overrides the .stage box. Do not change this to "meet". -->
          <svg viewBox="0 0 ${c.width} ${c.height}" preserveAspectRatio="none">
            ${active.image
              ? svg`<image href=${active.image} x="0" y="0" width=${c.width} height=${c.height}
                          preserveAspectRatio="none" opacity=${active.imageOpacity ?? 1} />`
              : nothing}
            ${(active.rooms ?? []).map((r) => {
              const shape = renderRoom(r, resolveStateStyle(r.stateStyles, this.hass, undefined));
              if (!roomIsTappable(c, r)) return shape;
              // A transparent hit polygon over the room, mirroring .fp-furn-hit --
              // the decoration polygon stays non-interactive (.room {pointer-events:
              // none}), this sibling carries the click. Same points as the room
              // itself: unlike furniture (a fixed local box), a room is an
              // arbitrary polygon, so the hit target is its own outline.
              const pts = r.points.map(([x, y]) => `${x},${y}`).join(" ");
              return svg`<g class="fp-room-tap"
                  @action=${(ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>) =>
                    this._handleRoomAction(ev, r)}
                  .actionHandler=${actionHandler({
                    hasHold: hasAction(r.hold_action),
                    hasDoubleClick: hasAction(r.double_tap_action),
                  })}>
                  ${shape}
                  <polygon class="fp-room-hit" points=${pts} />
                </g>`;
            })}
            ${hass && visibleLayers.length > 0
              ? svg`<g class="fp-layers">
                  ${visibleLayers.map((l) => l.render({ floor: active, hass, config: c }))}
                </g>`
              : nothing}
            ${active.furniture.map((f) => {
              const style = resolveStateStyle(f.stateStyles, this.hass, f.entity);
              // Domain-aware active state (same as items' _isOn), so a reactive
              // glyph bound to e.g. a climate/media_player animates on its real
              // active states, not only literal on/open/home/playing.
              const isActive = !!f.entity && entityIsActive(f.entity, this.hass?.states[f.entity]?.state);
              // Lights layer (off by default): a lit ceilingLight/lamp's glow
              // scales with its bulb's real brightness. The piece's own entity is
              // already in this._watchedEntities (collectWatchedEntities), so
              // this needs no new watched entity.
              const glowIntensity =
                featureEnabled(c, "lightsLayer") && f.entity
                  ? lightVisual(this.hass?.states[f.entity]).intensity
                  : undefined;
              // Feature 1f: literally "playing" (narrower than isActive), flag-gated.
              const isPlaying = furnitureNowPlaying(
                c,
                f.entity ? this.hass?.states[f.entity]?.state : undefined,
                f.entity,
              );
              const shape = renderFurniture(f, style, isActive, glowIntensity, isPlaying);
              if (!f.entity) return shape;
              // Entity-bound furniture is tappable -- a transparent rect over the
              // piece's oriented bounding box gives a reliable hit target even
              // where the drawing itself is a thin stroke (a rug's dashed border,
              // a TV's single line). The shape stays decoration; this is the
              // functional tap target, mirroring .fp-opening-hit.
              const hw = f.w / 2;
              const hh = f.h / 2;
              return svg`<g class="fp-furn-tap"
                  @action=${(ev: CustomEvent<{ action: "tap" | "hold" | "double_tap" }>) =>
                    this._handleFurnitureAction(ev, f)}
                  .actionHandler=${actionHandler({
                    hasHold: hasAction(f.hold_action),
                    hasDoubleClick: hasAction(f.double_tap_action),
                  })}>
                  ${shape}
                  <rect class="fp-furn-hit" x=${-hw} y=${-hh} width=${f.w} height=${f.h}
                        transform="translate(${f.x} ${f.y}) rotate(${f.angle ?? 0})" />
                </g>`;
            })}
            ${renderWallMask(active.openings, c.width, c.height, this._wallMaskId)}
            <g mask=${`url(#${this._wallMaskId})`}>
              ${active.walls.map(
                (w) => svg`
                <line x1=${w.x1} y1=${w.y1} x2=${w.x2} y2=${w.y2}
                      class="wall" stroke-width=${WALL_THICKNESS} stroke-linecap="round" />`
              )}
            </g>
            ${active.openings.map((o) => {
              const amount = this._openingAmount(o);
              const symbol = renderOpening(o, {
                color: "var(--primary-text-color)",
                open: amount > 0,
                amount,
                active: this._openingActive(o),
                accent: o.activeColor ?? "var(--primary-color, #03a9f4)",
              });
              if (!o.entity) return symbol;
              // Entity-bound openings are tappable — a transparent rect over the
              // opening's wall gap gives a reliable hit target beyond the thin
              // leaf/panel strokes.
              const half = o.length / 2;
              const cutH = WALL_THICKNESS + 4;
              return svg`<g class="fp-opening" @click=${() => this._onOpeningClick(o)}>
                  ${symbol}
                  <rect class="fp-opening-hit" x=${o.x - half} y=${o.y - cutH / 2}
                        width=${o.length} height=${cutH}
                        transform="rotate(${o.angle} ${o.x} ${o.y})" />
                </g>`;
            })}
            ${(active.trackers ?? []).map((tr) =>
              renderTracker(tr, {
                editing: false,
                xReading: trackerSensorReading(this.hass?.states, tr.xSensor?.entity),
                yReading: trackerSensorReading(this.hass?.states, tr.ySensor?.entity),
                xPresent: trackerPresenceDetected(this.hass?.states, tr.xSensor?.presence),
                yPresent: trackerPresenceDetected(this.hass?.states, tr.ySensor?.presence),
              })
            )}
          </svg>
          <div class="items">
            ${active.texts.map((t) => this._renderText(t, c, rot))}
            ${active.items.map((it) => this._renderItem(it, c, rot))}
            ${active.furniture.map((f) =>
              this._renderFurnitureBadge(f, resolveStateStyle(f.stateStyles, this.hass, f.entity), c, rot),
            )}
          </div>
          </div>
          ${layers.length > 0 ? this._renderLayerToggles(layers) : nothing}
          ${floors.length > 1 ? this._renderFloorSwitcher(floors, active) : nothing}
        </div>
      </ha-card>
    `;
  }

  private _toggleLayer(id: FeatureName): void {
    const next = new Set(this._hiddenLayers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._hiddenLayers = next;
  }

  private _renderLayerToggles(layers: LiveLayer[]): TemplateResult {
    return html`
      <div class="layer-toggles">
        ${layers.map(
          (l) => html`
            <button
              class="layer-chip ${this._hiddenLayers.has(l.id) ? "off" : ""}"
              title=${l.label}
              @click=${() => this._toggleLayer(l.id)}
            >
              <ha-icon icon=${l.icon}></ha-icon>
              <span>${l.label}</span>
            </button>
          `
        )}
      </div>
    `;
  }

  private _renderFloorSwitcher(floors: Floor[], active: Floor): TemplateResult {
    return html`
      <div class="floor-switcher">
        ${floors.map(
          (f) => html`
            <button
              class=${f.id === active.id ? "active" : ""}
              title=${f.name}
              @click=${() => {
                this._activeFloorId = f.id;
              }}
            >
              ${f.name}
            </button>
          `
        )}
      </div>
    `;
  }

  static styles = css`
    ha-card {
      height: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }
    .stage {
      position: relative;
      width: 100%;
      padding: 0;
      container-type: size;
      overflow: hidden;
    }
    .floor-switcher {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      pointer-events: auto;
      z-index: 1;
    }
    .floor-switcher button {
      cursor: pointer;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      line-height: 1;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .floor-switcher button.active {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      border-color: var(--primary-color, #03a9f4);
    }
    /* Live-layer toggle chips: a corner overlay, one chip per enabled layer.
       Opposite corner from the floor switcher so the two never collide. */
    .layer-toggles {
      position: absolute;
      top: 8px;
      left: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      pointer-events: auto;
      z-index: 1;
    }
    .layer-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      line-height: 1;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      max-width: 160px;
    }
    .layer-chip ha-icon {
      --mdc-icon-size: 16px;
    }
    .layer-chip span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .layer-chip.off {
      opacity: 0.5;
      background: var(--secondary-background-color, #eee);
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
    /* The plate always has the natural W/H ratio, is centred, and is sized by
       min() to the largest natural-ratio box that fits the stage -- a letterbox
       that holds even when the stage box is overridden. */
    .plate {
      position: absolute;
      top: 50%;
      left: 50%;
      aspect-ratio: var(--fp-arw);
      width: min(100cqw, 100cqh * var(--fp-arw));
      transform: translate(-50%, -50%) rotate(var(--fp-rot, 0deg));
      transform-origin: center;
    }
    /* At 90/270 the plate's rotated box must fill the swapped stage footprint,
       so bound the natural-ratio width by the stage's height instead. */
    .plate.rot90,
    .plate.rot270 {
      width: min(100cqh, 100cqw * var(--fp-arw));
    }
    .wall {
      stroke: var(--primary-text-color);
    }
    .fp-door-leaf,
    .fp-leaf-r {
      transform-box: fill-box;
      transition: transform 0.5s ease;
    }
    .fp-door-leaf {
      transform-origin: left center;
    }
    .fp-leaf-r {
      transform-origin: right center;
    }
    .fp-door-leaf rect,
    .fp-leaf-r rect {
      transition: fill 0.5s ease;
    }
    .fp-door-arc {
      transition: stroke-dashoffset 0.5s ease, stroke 0.5s ease;
    }
    .fp-opening {
      cursor: pointer;
    }
    .fp-opening-hit {
      fill: transparent;
      pointer-events: all;
    }
    .fp-slide-panel {
      transform-box: fill-box;
      transition: transform 0.5s ease;
    }
    .fp-slide-panel rect {
      transition: fill 0.5s ease;
    }
    /* Garage panel: retracts toward the hinge-side jamb (scaleX about the left
       jamb via fill-box left center; the group content is static so the box is
       stable) and fades as the door rolls up out of the cut plane. */
    .fp-garage-panel {
      transform-box: fill-box;
      transform-origin: left center;
      transition: transform 0.5s ease, opacity 0.5s ease;
    }
    .fp-garage-panel rect {
      transition: fill 0.5s ease;
    }
    .fp-garage-panel line {
      transition: stroke 0.5s ease;
    }
    /* Bi-fold leaf: each group holds exactly one leaf rect, so fill-box left
       center is the hinge end; the transform is the whole chained hinge list,
       which transitions per-function -- every tween frame is a true fold pose. */
    .fp-fold-panel {
      transform-box: fill-box;
      transform-origin: left center;
      transition: transform 0.5s ease;
    }
    .fp-fold-panel rect {
      transition: fill 0.5s ease;
    }
    .fp-furn-tap {
      cursor: pointer;
    }
    .fp-furn-hit {
      fill: transparent;
      pointer-events: all;
    }
    .fp-room-tap {
      cursor: pointer;
    }
    .fp-room-hit {
      fill: transparent;
      pointer-events: all;
    }
    .items {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    /* A room is decoration. It must never swallow a click meant for the opening
       or the device drawn over it. */
    .room {
      pointer-events: none;
    }
    .item {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: auto;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    /*
     * The item's x/y anchors its icon, not its icon-plus-label. Were the label
     * in flow, it would make the column taller and the translate would
     * push the icon up by half the label's height -- so an item showing state
     * would sit higher than a bare one beside it, at the same y. The label hangs
     * below instead, out of flow, and every icon lands on its own y.
     */
    .item > .label {
      position: absolute;
      top: calc(100% + 2px);
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
    }
    /*
     * ...unless the label is all there is. An item with showIcon: false renders
     * no badge, so the column has zero height and an absolute label would hang
     * 2px below the point instead of centring on it.
     */
    /*
     * Conditional animations (stateStyles). Only two: pulse and blink. "Blinking"
     * is one keyframe; a general animation grammar is a project, not a feature.
     */
    .item.anim-pulse .badge {
      animation: fp-item-pulse 1.6s ease-in-out infinite;
    }
    .item.anim-blink .badge {
      animation: fp-item-blink 1s steps(1, end) infinite;
    }
    /* The scale property, not transform: scale(). The badge carries an inline
       transform: rotate(angle), and an animated transform would erase it. */
    @keyframes fp-item-pulse {
      0%, 100% { scale: 1; }
      50% { scale: 1.18; }
    }
    @keyframes fp-item-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0.25; }
    }
    /*
     * Smart furniture (stateStyles matched). Tint lives in renderFurniture's
     * inline fill/stroke; this only carries the animation, on the inner group
     * so the placement transform (translate + rotate) is never touched. The
     * element-animation rules themselves are shared with editor.ts via
     * element-styles.ts; see that file's header comment for what is (and is
     * not) shared.
     */
    ${ELEMENT_ANIMATION_CSS_BASE}
    @media (prefers-reduced-motion: reduce) {
      /* Every animation this card draws, not just the conditional ones. */
      .item.anim-pulse .badge,
      .item.anim-blink .badge,
      .fp-furn-anim-pulse,
      .fp-furn-anim-blink,
      .ripple.active .ring,
      .tracker-dot,
      .tracker-ring,
      .tracker-band {
        animation: none;
      }
    }
    ${ELEMENT_ANIMATION_CSS_REACTIVE}
    /* Light glow: a slow brightness swell on a lit disc (ceiling light, lamp).
       The resting opacity doubles as the reduced-motion pose, so animation: none
       leaves a steadily lit fixture. The 2.6 s period is deliberately out of
       step with the TV screen's 3 s so co-located glyphs do not pulse in
       lockstep. --fp-glow-intensity (set inline by renderFurniture only when the
       lightsLayer feature is on and the light reports a brightness reading)
       scales both the radius and this opacity together; it is unset everywhere
       else, so var(...,1) keeps every existing look identical. */
    .fp-furn-glow {
      opacity: calc(0.25 * var(--fp-glow-intensity, 1));
      animation: fp-furn-glow-swell 2.6s ease-in-out infinite;
    }
    @keyframes fp-furn-glow-swell {
      0%, 100% { opacity: calc(0.12 * var(--fp-glow-intensity, 1)); }
      50%      { opacity: calc(0.35 * var(--fp-glow-intensity, 1)); }
    }
    ${ELEMENT_ANIMATION_CSS_EQ}
    .item.label-only > .label {
      position: static;
      transform: none;
      white-space: nowrap;
    }
    .badge {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--card-background-color, #fff);
      border: 1.5px solid var(--divider-color, #ccc);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary-text-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    .item.on .badge {
      background: var(--state-light-active-color, var(--state-active-color, #fdd835));
      border-color: var(--state-light-active-color, var(--state-active-color, #fdd835));
      color: var(--text-primary-color, #212121);
    }
    ha-icon {
      --mdc-icon-size: 22px;
    }
    .label {
      font-size: 12px;
      line-height: 1;
      padding: 1px 4px;
      border-radius: 4px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      white-space: nowrap;
    }
    .text {
      position: absolute;
      pointer-events: none;
      white-space: nowrap;
      font-weight: 500;
      line-height: 1;
    }
    .stack {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stack-icon {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ripple {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ripple .ring {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid var(--fp-ripple-color);
      opacity: 0;
    }
    .ripple.active .ring {
      animation: fp-ripple 1.8s ease-out infinite;
    }
    .ripple .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--fp-ripple-color);
      opacity: 0.4;
    }
    .ripple.active .dot {
      opacity: 0.9;
    }
    @keyframes fp-ripple {
      0% {
        transform: scale(0.15);
        opacity: 0.7;
      }
      100% {
        transform: scale(1);
        opacity: 0;
      }
    }
    /* === Tracker animations (live card). The zone outline is editor-only —
       renderTracker is called with editing:false here, so only the marker /
       line and ripples render. Movement transitions on the group's transform
       so the dot/triangle glides between sensor updates rather than jumping. === */
    .tracker-marker {
      transition: transform 0.4s ease-out;
    }
    .tracker-dot {
      animation: fp-tracker-pulse 1.4s ease-in-out infinite;
      transform-box: fill-box;
      transform-origin: center;
    }
    .tracker-ring {
      animation: fp-tracker-ring 2.2s ease-out infinite;
      opacity: 0;
    }
    .tracker-line {
      transition: transform 0.4s ease-out;
    }
    .tracker-line-stroke {
      opacity: 0.45;
      animation: fp-tracker-pulse 1.6s ease-in-out infinite;
    }
    .tracker-band {
      opacity: 0;
      animation: fp-tracker-band 2.2s ease-out infinite;
    }
    @keyframes fp-tracker-pulse {
      0%,
      100% {
        transform: scale(0.9);
        opacity: 0.7;
      }
      50% {
        transform: scale(1.1);
        opacity: 1;
      }
    }
    @keyframes fp-tracker-ring {
      0% {
        r: 0;
        opacity: 0.7;
      }
      100% {
        r: var(--fp-tracker-ring-max, 60px);
        opacity: 0;
      }
    }
    @keyframes fp-tracker-band {
      0% {
        opacity: 0.5;
        stroke-width: 1.5;
      }
      100% {
        opacity: 0;
        stroke-width: 14;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "easy-floorplan-card": FloorplanCard;
  }
}
