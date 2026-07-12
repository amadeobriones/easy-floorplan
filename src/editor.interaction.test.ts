// @vitest-environment jsdom
/**
 * The editor's interaction layer: the Escape ladder, fullscreen containment, and
 * undo discipline.
 *
 * This is where every fix we adopted from upstream on 2026-07-11 lives, and none of
 * it had a test. The failures here are the nastiest kind — they don't throw, they
 * just quietly do the wrong thing to someone's dashboard:
 *
 *   - an Escape that escapes closes HA's card-config dialog *underneath* the
 *     fullscreen workspace, and a dirty config then pops a confirm the user cannot
 *     see, behind the top layer;
 *   - a burst that never ends collapses two separate slider drags into one undo
 *     step, so Ctrl+Z jumps further back than the user expects.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import type { FloorplanCardConfig } from "./types";

/** Minimal ha-form: enough that `customElements.get("ha-form")` is truthy. */
class HaFormStub extends HTMLElement {
  public hass: unknown;
  public data: Record<string, unknown> = {};
  public schema: Array<{ name: string }> = [];
  public edit(patch: Record<string, unknown>): void {
    this.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: { ...this.data, ...patch } },
        bubbles: true,
        composed: true,
      })
    );
  }
}

const CONFIG = {
  type: "custom:easy-floorplan-card",
  width: 1000,
  height: 600,
  walls: [],
  rooms: [],
  items: [{ id: "i1", entity: "light.k", kind: "light", x: 100, y: 100, name: "Lamp" }],
  furniture: [],
  openings: [],
  texts: [],
  trackers: [],
} as unknown as FloorplanCardConfig;

interface Priv {
  hass: unknown;
  _selection: unknown[];
  _history: unknown[];
  _future: unknown[];
  _fullscreen: boolean;
  updateComplete: Promise<unknown>;
}

async function mount() {
  const { FloorplanCardEditor } = await import("./editor");
  const el = document.createElement("easy-floorplan-card-editor") as InstanceType<
    typeof FloorplanCardEditor
  >;
  const p = el as unknown as Priv;
  p.hass = { states: {}, entities: {}, formatEntityState: () => "on" };
  el.setConfig(structuredClone(CONFIG));
  document.body.appendChild(el);
  await p.updateComplete;
  p._selection = [{ kind: "item", id: "i1" }];
  await p.updateComplete;
  return { el, p };
}

const form = (el: Element) => el.shadowRoot!.querySelector("ha-form") as HaFormStub;

/**
 * The burst-ending listener is bound on the editor's root `<div class="editor">`,
 * not on the host — dispatching at the host never reaches into the shadow root.
 */
const pointerDown = (el: Element) =>
  el.shadowRoot!
    .querySelector(".editor")!
    .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));

/** Undo/redo clear the selection, which unmounts the ELEMENT panel with it. */
async function reselect(p: Priv) {
  p._selection = [{ kind: "item", id: "i1" }];
  await p.updateComplete;
}

beforeAll(() => {
  customElements.define("ha-form", HaFormStub);
  if (!HTMLElement.prototype.showPopover) {
    HTMLElement.prototype.showPopover = function () {};
    HTMLElement.prototype.hidePopover = function () {};
  }
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Escape while fullscreen must never reach HA's dialog (upstream d7c8d65)", () => {
  /** An Escape typed inside a form field, bubbling up from within the editor. */
  async function escapeFromAField(fullscreen: boolean) {
    const { el, p } = await mount();
    p._fullscreen = fullscreen;
    await p.updateComplete;

    // A real field inside the editor — an open picker/select would sit here.
    const input = document.createElement("input");
    el.shadowRoot!.appendChild(input);

    const reachedDocument = vi.fn();
    document.addEventListener("keydown", reachedDocument);

    const ev = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    input.dispatchEvent(ev);
    document.removeEventListener("keydown", reachedDocument);
    return { ev, reachedDocument };
  }

  it("is contained at the host — the dialog never sees it", async () => {
    const { ev, reachedDocument } = await escapeFromAField(true);
    // HA's card-config dialog listens above us in the bubble path. If this Escape
    // gets through, the dialog closes underneath the top-layer workspace.
    expect(reachedDocument).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(true);
  });

  it("is left alone when NOT fullscreen — Escape should close the dialog normally", async () => {
    const { ev, reachedDocument } = await escapeFromAField(false);
    // Containing it here would trap the user in a dialog they cannot close.
    expect(reachedDocument).toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });
});

describe("fullscreen collapses when focus leaves the editor (upstream #43)", () => {
  it("a focusin outside the editor drops fullscreen", async () => {
    const { p } = await mount();
    p._fullscreen = true;
    await p.updateComplete;

    // Tabbing past the last control, or a dialog opening above, lands the user on
    // UI hidden behind the top layer. Collapse rather than leave them blind.
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    await p.updateComplete;

    expect(p._fullscreen).toBe(false);
  });
});

describe("undo discipline", () => {
  it("repeated edits to one field coalesce into a single undo step", async () => {
    const { el, p } = await mount();
    expect(p._history.length).toBe(0);

    // Dragging a slider / typing a name fires a stream of live edits. They must be
    // ONE history entry, or Ctrl+Z would step through every intermediate value.
    for (const name of ["L", "La", "Lam", "Lamp!"]) {
      form(el).edit({ name });
      await p.updateComplete;
    }
    expect(p._history.length).toBe(1);
  });

  it("a new pointer interaction ends the burst — two drags are two undo steps (upstream 6600e04)", async () => {
    const { el, p } = await mount();

    form(el).edit({ name: "first" });
    await p.updateComplete;
    expect(p._history.length).toBe(1);

    // Without this, releasing and re-grabbing the same slider silently extends the
    // first burst, and one Ctrl+Z throws away both drags.
    pointerDown(el);
    await p.updateComplete;

    form(el).edit({ name: "second" });
    await p.updateComplete;
    expect(p._history.length).toBe(2);
  });

  it("undo restores the previous value, and redo puts it back", async () => {
    const { el, p } = await mount();

    form(el).edit({ name: "changed" });
    await p.updateComplete;
    expect(p._history.length).toBe(1);

    (el as unknown as { _undo: () => void })._undo();
    await p.updateComplete;
    expect(p._future.length).toBe(1);
    expect(p._history.length).toBe(0);

    (el as unknown as { _redo: () => void })._redo();
    await p.updateComplete;
    expect(p._future.length).toBe(0);
    expect(p._history.length).toBe(1);
  });

  it("a fresh edit after an undo clears the redo stack", async () => {
    const { el, p } = await mount();

    form(el).edit({ name: "a" });
    await p.updateComplete;
    (el as unknown as { _undo: () => void })._undo();
    await p.updateComplete;
    expect(p._future.length).toBe(1);

    // Branching the history: the old redo future is unreachable and must be dropped.
    await reselect(p);
    pointerDown(el);
    form(el).edit({ name: "b" });
    await p.updateComplete;

    expect(p._future.length).toBe(0);
  });
});
