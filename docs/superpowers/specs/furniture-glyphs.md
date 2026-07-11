# Furniture glyphs: 12 new top-down symbols

Design spec for the Phase-2 furniture types. Every glyph follows the existing
`renderFurniture` vocabulary (`src/render.ts`):

- **Base**: the shared default `rect rx="4"` with `fill=${color} fill-opacity=${fillOpacity} stroke=${color} stroke-width="2"`. **None of the 12 needs `roundBase`** (ellipse) or a custom base — do not touch the `roundBase` / rug / sectional base logic.
- **Detail**: structural lines at `stroke-width="2"`, secondary/soft lines at `stroke-width="1.5"` with `opacity` 0.6–0.8, all centred at the origin using `w`, `h`, `hw = w/2`, `hh = h/2`, and the already-resolved `color` variable.
- **Orientation**: like the rest of the family, "front" faces +y (bottom); backs/headboards sit at `-hh` (top). Front-elevation hints (knobs, door splits) are house style — see fridge, wardrobe.

Each `detail` below is the body of a new `case "<type>":` in the `switch (f.type)` — paste as-is. Types must also be added to the `FurnitureType` union and `FURNITURE_TYPES` array; sizes to `FURNITURE_DEFAULT_SIZE` (`src/types.ts`); labels to `FURNITURE_LABELS` (`src/editor-forms.ts`).

## Distinguishability map (the one cue that separates neighbours)

| Glyph | vs neighbour | Discriminating cue |
| --- | --- | --- |
| armchair | chair | chair = back line only; armchair adds the sofa's two arm lines |
| bench | table / tv | two lengthwise slat lines, no back line, seat-depth footprint |
| crib | bed | bed = headboard + pillows; crib = inner mattress + rail ticks on the long sides |
| coffeeTable | table | table is an empty rect; coffee table has a soft inner shelf outline |
| nightstand | cabinet / dresser | one knob, small square footprint |
| dresser | wardrobe / nightstand | three knobs + two inset bay dividers (wardrobe = one full-height split + handle ticks) |
| bookshelf | stairs / wardrobe | five full-height verticals in a long-shallow footprint, no arrow |
| cabinet | airHandler / wardrobe | single soft diagonal (drafting shorthand for casework); airHandler is a full X |
| microwave | tv / fridge | door window left + control-panel line right, tiny footprint |
| shower | plain square / airHandler | corner-to-drain lines stop at a centre drain circle (standard receptor symbol) |
| bidet | toilet / vanity | tall bowl ellipse + faucet dot but **no tank rect** (toilet's cue); portrait, small |
| fireplace | stove / stairs | two firebox jambs + a two-peak flame zigzag between them |

---

## 1. armchair

A one-seat sofa: the sofa's back-plus-arms drawing at chair scale — instantly reads as "seat with arms" next to the bare-backed chair.

```ts
case "armchair":
  detail = svg`
    <line x1=${-hw} y1=${-hh + h * 0.26} x2=${hw} y2=${-hh + h * 0.26}
          stroke=${color} stroke-width="2" />
    <line x1=${-hw + w * 0.16} y1=${-hh + h * 0.26} x2=${-hw + w * 0.16} y2=${hh}
          stroke=${color} stroke-width="2" />
    <line x1=${hw - w * 0.16} y1=${-hh + h * 0.26} x2=${hw - w * 0.16} y2=${hh}
          stroke=${color} stroke-width="2" />`;
  break;
```

- `FURNITURE_DEFAULT_SIZE`: `armchair: { w: 72, h: 72 }`
- `FURNITURE_LABELS`: `armchair: "armchair"`

## 2. bench

No back, no arms — just two soft slat lines running the length, which is exactly what a park/entry bench looks like from above.

```ts
case "bench":
  detail = svg`
    <line x1=${-hw + w * 0.06} y1=${-h * 0.16} x2=${hw - w * 0.06} y2=${-h * 0.16}
          stroke=${color} stroke-width="1.5" opacity="0.7" />
    <line x1=${-hw + w * 0.06} y1=${h * 0.16} x2=${hw - w * 0.06} y2=${h * 0.16}
          stroke=${color} stroke-width="1.5" opacity="0.7" />`;
  break;
```

- `FURNITURE_DEFAULT_SIZE`: `bench: { w: 110, h: 35 }`
- `FURNITURE_LABELS`: `bench: "bench"`

## 3. crib

An inset mattress framed by a barred border — the rail ticks on the long sides are the "bars" that say crib, and the double outline survives small sizes even when the ticks blur.

```ts
case "crib": {
  const ticks = [];
  for (const ty of [-h * 0.25, 0, h * 0.25]) {
    ticks.push(svg`<line x1=${-hw} y1=${ty} x2=${-hw + w * 0.16} y2=${ty}
                         stroke=${color} stroke-width="1.5" opacity="0.7" />`);
    ticks.push(svg`<line x1=${hw - w * 0.16} y1=${ty} x2=${hw} y2=${ty}
                         stroke=${color} stroke-width="1.5" opacity="0.7" />`);
  }
  detail = svg`
    <rect x=${-hw + w * 0.16} y=${-hh + h * 0.12} width=${w * 0.68} height=${h * 0.76} rx="3"
          fill="none" stroke=${color} stroke-width="1.5" opacity="0.8" />
    ${ticks}`;
  break;
}
```

- `FURNITURE_DEFAULT_SIZE`: `crib: { w: 70, h: 130 }` (portrait, like bed)
- `FURNITURE_LABELS`: `crib: "crib"`

## 4. coffeeTable

A soft inner outline (glass top / lower shelf showing through) is what separates it from the deliberately empty dining table; the low, small footprint does the rest.

```ts
case "coffeeTable":
  detail = svg`
    <rect x=${-hw + w * 0.12} y=${-hh + h * 0.15} width=${w * 0.76} height=${h * 0.7} rx="3"
          fill="none" stroke=${color} stroke-width="1.5" opacity="0.7" />`;
  break;
```

- `FURNITURE_DEFAULT_SIZE`: `coffeeTable: { w: 100, h: 55 }`
- `FURNITURE_LABELS`: `coffeeTable: "coffee table"`

## 5. nightstand

The smallest box in the set, marked by a single centred drawer knob — one knob = one drawer = nightstand.

```ts
case "nightstand":
  detail = svg`
    <circle cx="0" cy="0" r=${Math.min(w, h) * 0.09}
            fill="none" stroke=${color} stroke-width="1.5" />`;
  break;
```

- `FURNITURE_DEFAULT_SIZE`: `nightstand: { w: 42, h: 40 }`
- `FURNITURE_LABELS`: `nightstand: "nightstand"` (single dictionary word — the camelCase-splitting rule that produces "round table" / "water heater" doesn't apply, matching how the enum itself spells it)

## 6. dresser

Three knobs across three inset drawer bays: knob *count* (3 vs the nightstand's 1) and partial dividers (vs the wardrobe's full-height door split + handle ticks) keep the storage trio apart.

```ts
case "dresser":
  detail = svg`
    <line x1=${-w * 0.15} y1=${-hh + h * 0.15} x2=${-w * 0.15} y2=${hh - h * 0.15}
          stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1=${w * 0.15} y1=${-hh + h * 0.15} x2=${w * 0.15} y2=${hh - h * 0.15}
          stroke=${color} stroke-width="1.5" opacity="0.6" />
    <circle cx=${-w * 0.3} cy="0" r=${Math.min(w, h) * 0.07}
            fill="none" stroke=${color} stroke-width="1.5" />
    <circle cx="0" cy="0" r=${Math.min(w, h) * 0.07}
            fill="none" stroke=${color} stroke-width="1.5" />
    <circle cx=${w * 0.3} cy="0" r=${Math.min(w, h) * 0.07}
            fill="none" stroke=${color} stroke-width="1.5" />`;
  break;
```

- `FURNITURE_DEFAULT_SIZE`: `dresser: { w: 110, h: 50 }`
- `FURNITURE_LABELS`: `dresser: "dresser"`

## 7. bookshelf

Five full-height verticals in a long-and-shallow footprint read as book spines / shelf bays; no centre arrow or chevron, so it can't be mistaken for stairs.

```ts
case "bookshelf": {
  const spines = [];
  for (let i = 1; i < 6; i++) {
    const x = -hw + (w / 6) * i;
    spines.push(svg`<line x1=${x} y1=${-hh} x2=${x} y2=${hh} stroke=${color} stroke-width="1.5" />`);
  }
  detail = svg`${spines}`;
  break;
}
```

- `FURNITURE_DEFAULT_SIZE`: `bookshelf: { w: 110, h: 30 }`
- `FURNITURE_LABELS`: `bookshelf: "bookshelf"`

## 8. cabinet

The drafting shorthand for generic casework — a single soft corner-to-corner diagonal. One diagonal at 0.6 opacity is unmistakably not the airHandler's full-strength X, and the absence of knobs/splits says "generic storage".

```ts
case "cabinet":
  detail = svg`
    <line x1=${-hw + w * 0.08} y1=${-hh + h * 0.08} x2=${hw - w * 0.08} y2=${hh - h * 0.08}
          stroke=${color} stroke-width="1.5" opacity="0.6" />`;
  break;
```

- `FURNITURE_DEFAULT_SIZE`: `cabinet: { w: 90, h: 50 }`
- `FURNITURE_LABELS`: `cabinet: "cabinet"`

## 9. microwave

Countertop-appliance front elevation, family style: door window on the left, control-panel line on the right — the asymmetric split is the cue, and the tiny footprint separates it from the fridge.

```ts
case "microwave":
  detail = svg`
    <rect x=${-hw + w * 0.1} y=${-hh + h * 0.18} width=${w * 0.55} height=${h * 0.64} rx="2"
          fill="none" stroke=${color} stroke-width="1.5" opacity="0.8" />
    <line x1=${hw - w * 0.2} y1=${-hh + h * 0.18} x2=${hw - w * 0.2} y2=${hh - h * 0.18}
          stroke=${color} stroke-width="1.5" />`;
  break;
```

- `FURNITURE_DEFAULT_SIZE`: `microwave: { w: 50, h: 35 }`
- `FURNITURE_LABELS`: `microwave: "microwave"`

## 10. shower

The standard architectural shower-receptor symbol: a centre drain circle with lines running in from each corner and stopping at it. The interrupted diagonals can never read as a plain square or as the airHandler's X.

```ts
case "shower": {
  const r = Math.min(w, h) * 0.07;
  detail = svg`
    <circle cx="0" cy="0" r=${r}
            fill="none" stroke=${color} stroke-width="1.5" />
    <line x1=${-hw + w * 0.08} y1=${-hh + h * 0.08} x2=${-w * 0.1} y2=${-h * 0.1}
          stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1=${hw - w * 0.08} y1=${-hh + h * 0.08} x2=${w * 0.1} y2=${-h * 0.1}
          stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1=${-hw + w * 0.08} y1=${hh - h * 0.08} x2=${-w * 0.1} y2=${h * 0.1}
          stroke=${color} stroke-width="1.5" opacity="0.6" />
    <line x1=${hw - w * 0.08} y1=${hh - h * 0.08} x2=${w * 0.1} y2=${h * 0.1}
          stroke=${color} stroke-width="1.5" opacity="0.6" />`;
  break;
}
```

- `FURNITURE_DEFAULT_SIZE`: `shower: { w: 90, h: 90 }`
- `FURNITURE_LABELS`: `shower: "shower"`

## 11. bidet

The toilet's bowl language *minus the tank rect*, plus a faucet dot at the head of the bowl — no tank and the smaller portrait footprint are what say bidet. (The oval stays a detail on the standard rect base; no `roundBase`.)

```ts
case "bidet":
  detail = svg`
    <ellipse cx="0" cy=${h * 0.08} rx=${w * 0.32} ry=${h * 0.34}
             fill="none" stroke=${color} stroke-width="2" />
    <circle cx="0" cy=${-hh + h * 0.16} r=${Math.min(w, h) * 0.07}
            fill="none" stroke=${color} stroke-width="1.5" />`;
  break;
```

- `FURNITURE_DEFAULT_SIZE`: `bidet: { w: 44, h: 62 }`
- `FURNITURE_LABELS`: `bidet: "bidet"`

## 12. fireplace

Two full-height firebox jambs framing a two-peak flame zigzag: the jambs give it hearth structure at any size, and the little "M" of flame is the read even when it shrinks to a squiggle.

```ts
case "fireplace":
  detail = svg`
    <line x1=${-w * 0.26} y1=${-hh} x2=${-w * 0.26} y2=${hh}
          stroke=${color} stroke-width="2" />
    <line x1=${w * 0.26} y1=${-hh} x2=${w * 0.26} y2=${hh}
          stroke=${color} stroke-width="2" />
    <path d="M ${-w * 0.14} ${h * 0.18} L ${-w * 0.05} ${-h * 0.18} L 0 ${h * 0.02} L ${w * 0.05} ${-h * 0.18} L ${w * 0.14} ${h * 0.18}"
          fill="none" stroke=${color} stroke-width="1.5" opacity="0.8" />`;
  break;
```

- `FURNITURE_DEFAULT_SIZE`: `fireplace: { w: 110, h: 40 }`
- `FURNITURE_LABELS`: `fireplace: "fireplace"`

---

## Summary tables (paste-ready)

`FURNITURE_DEFAULT_SIZE` additions (`src/types.ts`):

```ts
armchair: { w: 72, h: 72 },
bench: { w: 110, h: 35 },
crib: { w: 70, h: 130 },
coffeeTable: { w: 100, h: 55 },
nightstand: { w: 42, h: 40 },
dresser: { w: 110, h: 50 },
bookshelf: { w: 110, h: 30 },
cabinet: { w: 90, h: 50 },
microwave: { w: 50, h: 35 },
shower: { w: 90, h: 90 },
bidet: { w: 44, h: 62 },
fireplace: { w: 110, h: 40 },
```

`FURNITURE_LABELS` additions (`src/editor-forms.ts`):

```ts
armchair: "armchair",
bench: "bench",
crib: "crib",
coffeeTable: "coffee table",
nightstand: "nightstand",
dresser: "dresser",
bookshelf: "bookshelf",
cabinet: "cabinet",
microwave: "microwave",
shower: "shower",
bidet: "bidet",
fireplace: "fireplace",
```

`roundBase`: unchanged — none of the 12 uses an ellipse base.
