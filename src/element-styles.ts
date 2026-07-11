import { css } from "lit";

/*
 * Element-animation CSS shared between floorplan-card.ts and editor.ts.
 *
 * This covers the rules that are byte-for-byte identical in both files.
 * Two related pieces are deliberately NOT here and stay declared locally in
 * each caller instead, because they differ between the card and the editor:
 *   - the prefers-reduced-motion block that silences .fp-furn-anim-pulse /
 *     .fp-furn-anim-blink (the card's version also silences several
 *     card-only selectors like .ripple.active .ring and .tracker-dot)
 *   - .fp-furn-glow and its @keyframes (the card scales opacity by the
 *     --fp-glow-intensity custom property; the editor does not)
 * Each caller still declares its own copy of those two pieces immediately
 * around this shared block, in the same source order as before, so the
 * cascade (and prefers-reduced-motion overrides) behave identically to
 * pre-extraction.
 */

export const ELEMENT_ANIMATION_CSS_BASE = css`
  .fp-furn {
    transform-box: fill-box;
    transform-origin: center;
  }
  /* Breathing: the appliance inhales -- same 1.6s period as fp-item-pulse, so
     a badge and its shape pulse in phase. Scale is gentle (1.03): these are
     big shapes; the badge's 1.18 would look like the sofa levitating. */
  .fp-furn-anim-pulse {
    animation: fp-furn-pulse 1.6s ease-in-out infinite;
  }
  @keyframes fp-furn-pulse {
    0%, 100% { scale: 1; opacity: 0.78; }
    50% { scale: 1.03; opacity: 1; }
  }
  /* Blink: alert language, identical timing/curve to fp-item-blink. */
  .fp-furn-anim-blink {
    animation: fp-furn-blink 1s steps(1, end) infinite;
  }
  @keyframes fp-furn-blink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0.25; }
  }
  /* Awareness layer: a safety marker (leak, smoke, door left open) reuses
     the fp-furn-blink keyframe above so it reads as the same alert
     language, tinted red/alert instead of the piece's own colour. Idle
     markers stay a faint neutral dot so the sensor is still visible on the
     plan at rest. */
  .fp-awareness-safety {
    fill: var(--fp-awareness-alert-color, #d32f2f);
  }
  .fp-awareness-safety-idle {
    fill: var(--disabled-text-color, #9e9e9e);
    fill-opacity: 0.35;
  }
`;

export const ELEMENT_ANIMATION_CSS_REACTIVE = css`
  /* Reactive glyphs: bespoke active-state animation on inner sub-elements of a
     furniture drawing. These classes sit inside the placement transform (and
     inside g.fp-furn when a stateStyles rule resolves) and animate only the
     standalone rotate/scale/opacity properties, so placement is never touched. */
  .fp-furn-drum,
  .fp-furn-flame {
    transform-box: fill-box;
    transform-origin: center;
  }
  /* Drum tumble: one revolution every 3.6 s at constant speed. Real drums spin
     faster, but at glyph scale that strobes; this reads as turning, calmly. */
  .fp-furn-drum {
    animation: fp-furn-drum-spin 3.6s linear infinite;
  }
  /* The dryer turns the opposite way, so a laundry pair reads as two machines. */
  .fp-furn-drum--reverse {
    animation-direction: reverse;
  }
  @keyframes fp-furn-drum-spin {
    from { rotate: 0deg; }
    to   { rotate: 360deg; }
  }
  /* TV screen glow: a slow brightness swell. The resting opacity doubles as the
     reduced-motion pose, so animation: none leaves a steadily lit screen. */
  .fp-furn-screen {
    opacity: 0.2;
    animation: fp-furn-screen-glow 3s ease-in-out infinite;
  }
  @keyframes fp-furn-screen-glow {
    0%, 100% { opacity: 0.1; }
    50%      { opacity: 0.3; }
  }
  /* Fire flicker: uneven stops so it dances instead of pulsing. The alt flame
     runs a shorter period with a negative delay, so the two tongues never sync
     and the combined pattern only repeats every ~22 s. */
  .fp-furn-flame {
    animation: fp-furn-flame-flicker 1.7s ease-in-out infinite;
  }
  .fp-furn-flame--alt {
    animation-duration: 1.3s;
    animation-delay: -0.9s;
  }
  @keyframes fp-furn-flame-flicker {
    0%, 100% { opacity: 0.85; scale: 1; }
    27%      { opacity: 0.55; scale: 0.97; }
    52%      { opacity: 1;    scale: 1.05; }
    71%      { opacity: 0.65; scale: 0.98; }
  }
  /* Fan spin: one revolution every 1.8 s, twice the washer drum's speed, so a
     fan and a laundry pair on one card never read as the same motion. Four
     blades pass a fixed point every 0.45 s: clearly spinning, not strobing.
     Reuses the drum's full-revolution keyframes at a shorter duration. */
  .fp-furn-fan {
    transform-box: fill-box;
    transform-origin: center;
    animation: fp-furn-drum-spin 1.8s linear infinite;
  }
`;

export const ELEMENT_ANIMATION_CSS_EQ = css`
  /* Media now-playing cue (feature 1f): a tiny equalizer on a TV or smart
     speaker whose media_player is playing. Extends the reactive glyph -- the
     bars are inner sub-elements of the drawing, animating only the standalone
     scale, so the placement transform is never touched. Gated upstream by the
     mediaNowPlaying flag; a not-playing render never emits these. */
  .fp-furn-eq {
    transform-box: fill-box;
    transform-origin: center bottom;
    scale: 1 0.7;
    animation: fp-furn-eq-bounce 0.9s ease-in-out infinite;
  }
  .fp-furn-eq--2 { animation-delay: -0.3s; }
  .fp-furn-eq--3 { animation-delay: -0.6s; }
  @keyframes fp-furn-eq-bounce {
    0%, 100% { scale: 1 0.4; }
    50%      { scale: 1 1; }
  }
  @media (prefers-reduced-motion: reduce) {
    .fp-furn-drum,
    .fp-furn-screen,
    .fp-furn-flame,
    .fp-furn-fan,
    .fp-furn-glow,
    .fp-furn-eq {
      animation: none;
    }
  }
`;
