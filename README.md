# draft

A TypeScript library for generating engineering-style SVG drawing sheets.

`draft` is a lightweight, dependency-free 2D drafting core: geometry primitives
(lines, arcs, polylines), a physical-unit SVG renderer, standard paper sizes
(ANSI + ISO), and a title block — the pieces you need to lay out engineering
drawing sheets, without a 3D CAD kernel underneath.

## Install

```sh
npm install @invisra/draft
```

> **Using an AI coding agent?** [`llms.txt`](./llms.txt) is a dense API index
> (every export, one line each, plus worked examples) sized for an agent's
> context window — it ships in the published package at
> `node_modules/@invisra/draft/llms.txt`.

## Quick start

```ts
import { Sheet, TitleBlock, DrawingElement, roundedRectangle, circle, centerMark, LinearDimension, RadialDimension } from "@invisra/draft";

const sheet = new Sheet({ orientation: "landscape", borderStyle: "zoned" }); // defaults to ANSI A (Letter), "plain" border

sheet.setTitleBlock(
  new TitleBlock({
    title: "BRACKET, MOUNTING",
    drawingNumber: "DRW-1000",
    revision: "A",
    scale: "1:1",
    sheet: "1 OF 1",
    material: "AL 6061-T6",
    finish: "ANODIZE, CLEAR",
    generalTolerance: ["X.XX = ±0.01", "ANGLES = ±0.5°"],
    projection: "third-angle",
    drawnBy: "S. RICHS",
    drawnDate: "2026-07-08",
  }),
);

const area = sheet.drawingArea;
sheet.add(new DrawingElement(roundedRectangle(area.x + 20, area.y + 20, 80, 50, 6)));

const holeCenter = { x: area.x + 30, y: area.y + 30 };
sheet.add(new DrawingElement(circle(holeCenter.x, holeCenter.y, 4)));
for (const mark of centerMark(holeCenter, 4, 2.5)) {
  sheet.add(new DrawingElement(mark, { lineStyle: "centerline" }));
}

sheet.add(new LinearDimension({ x: area.x + 20, y: area.y + 20 }, { x: area.x + 100, y: area.y + 20 }, { offset: -12, orientation: "horizontal" }));
sheet.add(new RadialDimension(holeCenter, 4, { angleDeg: 45 }));

const svg = sheet.toSVG();
```

See `examples/basic-sheet.ts` for a complete runnable example
(`npm run example`).

## Design

A few principles shape the whole library:

- **Millimeters, everywhere.** All geometry is stored in mm; inch paper sizes and
  inch *dimension display* (`unit: "in"`) convert at the boundary via `toMM`/
  `fromMM`, so a US and a metric drawing share the same geometry code.
- **Y-up drafting coordinates.** Origin bottom-left, +X right, +Y up; the SVG
  renderer applies a single flip (and text a counter-flip) so you never think in
  SVG's native Y-down space.
- **Plain `Renderable`s, no kernel.** Everything is an object with a
  `toSVG(): string` method — add anything satisfying that to a `Sheet`. Pure
  TypeScript: no WASM, no async init, no geometry-kernel dependency.
- **Deterministic output.** SVG/PDF/DXF generation is byte-stable (no timestamps
  or random IDs), so output diffs cleanly and snapshot-tests reliably.

## Features

Each feature below is indexed — with the exact options, standards references, and
rendering notes — in **[`llms.txt`](./llms.txt)**, a dense one-line-per-export
API reference. The complete generated API (every exported class, function, and
type) comes from `npm run docs`. At a glance:

- **Geometry** — a Canvas2D-style `Path` builder (line / arc / elliptical-arc /
  cubic-Bézier), ready-made shapes (`rectangle`, `roundedRectangle`, `circle`,
  `ellipse`, `polyline`, `centerMark`), `fitSpline` through points, and a
  construction toolkit: intersections, fillets, signed polyline offset, patterns
  (`boltCircle` / `linearPattern` / `rectangularPattern`), polygon booleans
  (`polygonUnion` / `polygonIntersection` / `polygonDifference`),
  `breakSegmentAtCrossings` (DIMBREAK-style line gapping), and isometric
  projection with pictorial circles, boxes, on-face text & dimensions
  (`isometricProjection` / `isometricCircle` / `isometricBox` / `IsometricText` /
  `IsometricLinearDimension`).
- **Sheets & layout** — `Sheet` on ANSI / ISO 216 / ARCH `PAPER_SIZES`, a drawing
  `Border`, three title-block styles, `Layer`s, scaled **and rotated** `View`s
  (annotative detail / section / auxiliary views), reusable `Block` symbols, and
  `DrawingSet` for multi-sheet numbering. Geometry/text and containers expose
  `bounds()`, so `Sheet.contentBounds()` and `fitView(...)` give measurement and
  fit-to-view.
- **Dimensioning** — linear / aligned / ordinate (with origin indicator) / angular / radial / diameter /
  arc-length / jogged-radius dimensions, chain & baseline stacks, multileaders,
  and generic leader `Callout`s;
  tolerances (±, limits, basic, reference),
  repetition counts (`4X`) & `TYP`, spherical (`S⌀`/`SR`) & square (`□`) prefixes,
  half (symmetry) & not-to-scale (underlined) dimensions,
  dual `mm [in]` display, ASME zero-suppression, fractional & architectural inches
  (`3'-6 1/2"`), DMS angles, document-wide `dimensionDefaults`, and preferred
  scale-ratio snapping (ISO 5455).
- **GD&T & tolerancing** — all 14 geometric-characteristic symbols, feature-control
  frames (material-condition, projected-zone `Ⓟ`, free-state `Ⓕ`, tangent-plane `Ⓣ`,
  unequally-disposed `Ⓤ` & statistical-tolerance `ST` modifiers), **composite**
  (two-tier) and **multiple single-segment** frames, the application modifiers
  (all-around, all-over, between `↔`, continuous-feature `CF`, datum-translation
  `▷`), datums & datum targets, and a material-condition calculator
  (`bonusTolerance` / `virtualCondition`).
- **Annotation & symbols** — multi-line / word-wrapped `TextElement`s, centerlines,
  hatching (plus ANSI material patterns)
  and knurl, section / detail / break-line markers plus `sectionView` fill
  generation and named half / revolved / removed section helpers, view titles
  (`SECTION A-A`) & viewing-direction arrows,
  revision clouds & tables, BOM
  tables, general notes, and nondestructive-examination (NDE) symbols.
- **Export** — SVG (native), PDF (a dependency-free writer with native beziers and
  an optional embedded, glyph-subsetted TrueType or OpenType/CFF font), and DXF (R12) export — geometry, text,
  native dimensions (linear / radial / diameter / angular / ordinate), and
  reusable `Block` symbols as `BLOCK`/`INSERT` — plus DXF import.

## Scripts

```sh
npm run build       # bundle to dist/ (ESM + CJS + .d.ts)
npm test            # run the vitest suite
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run example     # generate examples/basic-sheet.{svg,dxf,pdf} + basic-sheet-detail.{svg,pdf}
npm run example:hatches # generate examples/material-hatches.svg (ANSI31-38 pattern gallery)
npm run example:inch # generate examples/inch-sheet.svg (US decimal-inch drawing: inch dimensions + block tolerances)
npm run example:construction # generate examples/construction.svg (fillets, offset, bolt circle, ellipse)
npm run example:scaled # generate examples/scaled-view.svg (2:1 detail view via View, dimensions read true)
npm run docs        # generate a static API reference site (docs/, from TSDoc comments)
npm run docs:watch  # regenerate docs/ on every source change
```

API documentation for every exported class, function, and type is generated straight from the
source's TSDoc comments via [TypeDoc](https://typedoc.org/), the same way Sphinx builds docs from
docstrings in Python. Run `npm run docs` and open `docs/index.html`; it isn't checked into the
repo or published to npm (see `.gitignore`), so it's always generated fresh from the current
source.

## Known gaps

The core is feature-complete for 2D sheet layout: DXF exports whole sheets
including view-nested dimensions, and PDF embeds both TrueType and OpenType/CFF
fonts. What remains genuinely out of scope is mostly where a target format has no
native representation:

- **DXF R12 has no native entity** for annotations, GD&T frames, or tables, so
  those explode to `POLYLINE`/`TEXT` (dimensions do use native `DIMENSION`).
  Sheared/obliqued text — isometric text and dimension values — exports upright,
  since DXF `TEXT` can't be sheared onto a plane.
- **PDF default font**: with no `options.font`, text uses non-embedded Helvetica,
  which renders WinAnsi/Latin-1 only. Pass a `.ttf` or `.otf` to embed and
  glyph-subset it (both TrueType and CFF, including CID-keyed) and render arbitrary
  Unicode — so this is a default, not a hard limit.

## License

MIT © Invisra Labs LLC — see [LICENSE](./LICENSE). Release history is on the
[GitHub releases page](https://github.com/invisra/draft/releases).
