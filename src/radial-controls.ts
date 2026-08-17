import type { ActionConfig, FeaturesConfig } from "./types";
import { featureEnabled } from "./features";
import { hasAction } from "./actions";

/** Domains with a quick-control body in the radial popover (v1: light, switch, climate). */
export type RadialDomain = "light" | "switch" | "climate";

const RADIAL_DOMAINS: ReadonlySet<string> = new Set(["light", "switch", "climate"]);

export function radialDomainFor(entity: string | undefined): RadialDomain | undefined {
  if (!entity) return undefined;
  const domain = entity.split(".")[0];
  return RADIAL_DOMAINS.has(domain) ? (domain as RadialDomain) : undefined;
}

/**
 * Whether a long-press on this entity should open the radial quick-control
 * popover. An explicit `hold_action` is the user's own wiring and always
 * wins -- the popover only fills the gap: an entity in a supported domain,
 * with no `hold_action` configured, while the feature flag is on.
 */
export function shouldOpenRadial(
  config: { features?: FeaturesConfig } | undefined,
  entity: string | undefined,
  holdAction: ActionConfig | undefined,
): boolean {
  if (!featureEnabled(config, "radialControls")) return false;
  if (hasAction(holdAction)) return false;
  return radialDomainFor(entity) !== undefined;
}

/**
 * The `hasHold` value the action-handler needs so it even starts the
 * hold timer. With the flag off this is exactly `hasAction(hold_action)` --
 * today's behaviour, unchanged. With the flag on it is also true for a
 * supported-domain entity that has a hold_action configured, so the
 * gesture still resolves to "hold" and the handler (not this function)
 * decides whether that hold opens the popover or runs hold_action.
 */
export function radialHasHold(
  config: { features?: FeaturesConfig } | undefined,
  entity: string | undefined,
  holdAction: ActionConfig | undefined,
): boolean {
  return hasAction(holdAction) || shouldOpenRadial(config, entity, holdAction);
}

export interface RadialServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
}

/** `light.turn_on` with a brightness percentage, clamped to HA's valid 1..100 range. */
export function lightBrightnessCall(entity: string, brightnessPct: number): RadialServiceCall {
  const pct = Math.min(100, Math.max(1, Math.round(brightnessPct)));
  return { domain: "light", service: "turn_on", data: { entity_id: entity, brightness_pct: pct } };
}

export function climateSetpointCall(entity: string, temperature: number): RadialServiceCall {
  return { domain: "climate", service: "set_temperature", data: { entity_id: entity, temperature } };
}

/** One +/- press of a climate setpoint, clamped to the entity's own min/max. */
export function climateStep(
  current: number,
  direction: 1 | -1,
  step: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, current + direction * step));
}

export interface PopoverRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Where to place the popover: centered above the anchor when there's room,
 * flipped below when there isn't, clamped so it never spills past the
 * viewport (minus `margin`). Pure geometry -- no DOM -- so it's unit
 * testable without mounting the popover element that uses it.
 */
export function clampPopoverPosition(
  anchor: PopoverRect,
  popover: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): { left: number; top: number } {
  const anchorCenterX = anchor.left + anchor.width / 2;
  const rawLeft = anchorCenterX - popover.width / 2;
  const left = Math.min(Math.max(rawLeft, margin), viewport.width - popover.width - margin);

  const above = anchor.top - popover.height - margin;
  const below = anchor.top + anchor.height + margin;
  const rawTop = above >= margin ? above : below;
  const top = Math.min(Math.max(rawTop, margin), viewport.height - popover.height - margin);

  return { left, top };
}
