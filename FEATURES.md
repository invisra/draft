# Feature reference

Detailed, feature-by-feature documentation for `@invisra/draft`. For an overview,
install steps, and a quick start, see the [README](./README.md). For the full
generated API — every exported class, function, and type — run `npm run docs`
and open `docs/index.html`.

> **Note:** Fasteners & threads, fits/tolerance standards, surface-finish & weld
> symbols, machine elements (gears, springs, cams, sheaves), and hole/chamfer
> callouts & tolerance stack-ups now live in the companion package
> `@invisra/draft-mechanical`.

## Fundamentals

- **Units**: all geometry is in millimeters. Sheets rendered from an inch-based
  paper size (e.g. ANSI/Letter) convert internally; use `toMM`/`fromMM` from
  `units.ts` at any external boundary that deals in inches. Dimensions can also
  *display* in inches without changing the underlying geometry: every
  dimension/leader class takes `unit: "in"` (see **Dimensioning**), which
  converts the measured millimeter value to a decimal-inch value for the label
  only — so a US inch drawing and a metric one share the same mm geometry code.
- **Coordinate system**: Y-up, origin at the bottom-left of the sheet —
  standard drafting convention (+X right, +Y up). The SVG renderer applies a
  single coordinate flip so you never think in SVG's native Y-down space.
  `TextElement` carries its own counter-flip, so text you place at a Y-up
  position renders upright.
- **Text**: `TextElement(position, content, options?)` is the single text
  primitive — font size/family/color/weight and horizontal (`anchor`) and
  vertical (`baseline`) alignment. It is **multi-line-aware**: content with hard
  `\n` breaks (and/or word-wrapping to `options.maxWidthMM`, measured with the
  same AFM metrics as `bounds`) renders one `<text>` per line, stacked downward
  from `position` by `options.lineHeightMM` (default `size × 1.2`) in paper units
  — line spacing, like text height, does not scale inside a `View`. `lines()`
  exposes the resolved display lines, and `bounds()` boxes the whole block
  (widest line × line count). Every text sink follows suit: PDF export draws each
  line, and DXF export emits one `TEXT` entity per line (R12 `TEXT` is
  single-line; `MTEXT` is R13+). Control characters other than the line-breaking
  `\n` are stripped on DXF export so a string can't inject stray group codes.
- **`Renderable`**: `Sheet.add()` accepts anything with a `toSVG(): string`
  method — `DrawingElement`, `TextElement`, and all the dimension classes
  satisfy it structurally, so new primitives don't require touching `Sheet`.
  A `Renderable` may *optionally* implement `bounds(context?): BoundingBox | null`
  (see **Geometry introspection**); those that don't are simply skipped when
  measuring.
- **Geometry introspection & fit-to-view**: the geometry/text primitives and the
  containers (`Layer`, `View`, `BlockInstance`) implement `bounds()`, returning
  their paper-space extent (mapped through any active view transform), and
  `boundsOf(renderables, context?)` unions whatever is measurable (annotation
  classes with no exposed geometry are skipped, not errors). `Sheet.contentBounds()`
  boxes all added content (excluding border/title block); `View.contentBounds()`
  gives its children's true *model*-space extent. `fitView(contentBoundsMM, area,
  { marginMM?, maxScale? })` uses that to build a `View` that scales (aspect
  preserved) and centers content into a target rectangle (e.g. a sheet's
  `drawingArea`) — the fit-to-view convenience. This is measurement only, not a
  persistent/parametric model.
- **No kernel dependency**: unlike CAD libraries built on OpenCascade/WASM,
  every primitive here is plain TypeScript — no WASM, no async init, no
  registered kernel adapter.

## Geometry

- **Geometry**: `Path` is a Canvas2D-style builder
  (`moveTo`/`lineTo`/`arc`/`ellipticalArc`/`bezierCurveTo`/`close`) over
  `LineSegment`/`ArcSegment`/`EllipticalArcSegment`/`CubicBezierSegment`
  primitives. Arcs are stored
  in CAD form (center, radius, start/end angle, sweep direction) rather than
  SVG's endpoint form, so sweep direction is unambiguous; SVG arc flags are
  derived at serialization time. Elliptical arcs (`Path.ellipticalArc`) carry
  independent `rx`/`ry` and a `rotation`, stored in center parameterization
  (eccentric angles) and serialized to SVG's full `A rx ry rotation …` command;
  the PDF exporter converts them via the standard endpoint-to-center recovery
  (so a rotated ellipse renders as true bezier curves, not a polygon), and the
  R12 DXF exporter tessellates them into short straight segments (its
  `LWPOLYLINE` bulge only expresses circular arcs). **Cubic Bézier** segments
  (`Path.bezierCurveTo`) round out the free-form curve support: serialized to
  SVG's `C` command, rendered as a **native** PDF bezier (`c` operator, no
  approximation), and tessellated for DXF; `boundingBox` is exact (from the
  derivative roots). Ready-made shapes: `rectangle`, `roundedRectangle`,
  `circle`, `ellipse` (two exact elliptical half-arcs by default, or a
  tessellated polyline via `{ segments }`), `ellipticalArc` (an open partial
  arc), `polyline`, `centerMark`. **Fit spline** — `fitSpline(points, {
  closed?, tension? })` returns a smooth `Path` that passes *through* every
  given point (a Catmull-Rom interpolating spline emitted as native cubic
  Béziers, so it exports and bounds like any other path) — for cam profiles,
  faired outlines, and section boundaries defined by the points they touch;
  `tension` (0–1) trades roundness for tautness, `closed` makes a seamless loop.
- **Geometry construction**: the toolkit for *computing* a layout instead of
  hand-placing every coordinate. **Intersections** — `lineIntersection`/
  `segmentIntersection` (infinite vs. bounded), `lineCircleIntersection`/
  `segmentCircleIntersection` (0/1/2 points, ordered along the line), and
  `circleCircleIntersection` (0/1/2 points, left-of-axis first).
  **Constructions** — `circleThrough3Points` (the circumcircle / "arc through
  three points", `null` if collinear), `tangentPointsFromPoint` (the two points
  where tangents from an external point touch a circle), `perpendicularBisector`
  (of a segment), and `perpendicularFoot` (orthogonal projection of a point onto a
  line) — the classic compass-and-straightedge helpers.
  **Line breaks** — `breakSegmentAtCrossings(a, b, obstacles, gapMM)` splits a
  segment into the pieces that survive after cutting a gap around each point where
  it crosses an obstacle (segment or circle), merging overlapping gaps — the
  AutoCAD `DIMBREAK` primitive, reusable for any crossing linework (see the
  `LinearDimension` `breakAt` option under Dimensioning).
  **Fillets** — `filletCorner(p1, corner, p2, radius)` returns the tangent arc
  (center, tangent points, sweep) that rounds a corner, and
  `roundedPolyline(points, radius, closed?)` rounds a whole polyline into one
  `Path` of legs + tangent arcs (the general-case `roundedRectangle`, with the
  radius clamped per corner so a fillet never overruns half an edge).
  **Offset** — `offsetPolyline(points, distance, closed?)` shifts a polyline by
  a signed distance (positive = left of travel), re-intersecting adjacent edges
  into mitered corners — a straight miter offset for concentric outlines and
  clearance boundaries, not a self-intersection-cleaning kernel. **Patterns** —
  `boltCircle(center, count, radius, { startAngleDeg?, endAngleDeg?, clockwise? })`
  for evenly-spaced bolt-hole circles (full or arc), `linearPattern(start, step,
  count)`, and `rectangularPattern(origin, { columns, rows, dx, dy })`, each
  returning a `Point[]` you feed to `circle`/`centerMark`/etc. All operate on
  plain `Point`s in mm, so they compose with everything else. **Boolean region
  ops** — `polygonUnion`/`polygonIntersection`/`polygonDifference(subject,
  clip)` clip two polygons (rings of `Point`s — flatten a `Path` first) via the
  Greiner–Hormann algorithm, returning zero or more result rings (a difference
  can yield a reversed-winding hole ring, which the even-odd fill rule `hatch()`
  uses renders correctly); `polygonArea` gives a ring's signed area. Scoped to
  simple polygons in general position.
  **Isometric projection** — `isometricProjection({ x, y, z })` maps a 3D model
  point to the 2D drawing plane in standard 30° isometric (`+X` right-down, `+Y`
  left-down, `+Z` up, in Y-up drawing coords; a unit axis vector stays unit
  length). `projectIsoPlane("top" | "left" | "right", p)` lays a flat 2D point
  onto one of the three pictorial faces, `isoPolyline(points3d)` projects a whole
  polyline (feed the result to `polyline`/`Path`), and `isometricAxisDirections()`
  returns the three axis unit vectors. `isometricCircle(plane, centerOnPlane,
  radius)` draws a circle on a face as its **isometric ellipse** (a hole/cylinder
  end) — the ellipse axes come from `isometricEllipseAxes(plane, radius)`, derived
  exactly from the projection (√3 major:minor ratio; major horizontal on `top`,
  ∓60° on the walls, minor along the cylinder axis). `isometricBox(size, {
  origin? })` returns the visible edges of a rectangular prism (top loop + two
  front faces) as `Path[]`. `IsometricText(position, content, { plane, ... })`
  letters text *onto* a face — it shears the glyphs into the plane via an SVG
  matrix (unlike the always-upright `TextElement`), choosing per-face default
  reading/height axes that keep text non-mirrored (or pass explicit `right`/`up`
  unit vectors). It carries through to PDF via a sheared text matrix (the PDF text
  pipeline now supports a full `Tm`, not just a translation).
  `IsometricLinearDimension(p1, p2, { plane, offset, ... })` dimensions an edge on
  a face — endpoints in the face's own 2D coordinates, the true in-plane length
  formatted with the usual `unit`/`zeroHandling`/tolerances, and the whole
  dimension (extension lines, dimension line, flat arrowheads, and the value
  lettered via `IsometricText`) lying in the plane. This completes the pictorial
  set (SVG/PDF; a native DXF `DIMENSION` can't represent an isometric view).
- **Line styles**: `DrawingElement` takes a `lineStyle` — `"visible"` (thick,
  continuous, the default), `"hidden"` (thin dashed), `"centerline"` (thin,
  long dash/short dash), or `"phantom"` (thin, long dash/short/short) — per
  ASME Y14.2 / ISO 128 convention. An explicit `stroke` object still overrides
  individual fields (e.g. `{ lineStyle: "centerline", stroke: { color: "red" } }`).
  `centerMark(center, radius, overshoot?)` draws the cross for a hole or round
  feature's center; short marks render solid rather than dash-dot since the
  dash period doesn't fit — expected behavior, not a bug.
- **Centerlines**: `axisCenterline(p1, p2, { overshootMM?, symmetryTicks? })`
  draws the long-dash-short-dash **axis** of a shaft/cylinder (or a plane of
  symmetry), extended past each end — with `symmetryTicks` it adds the paired
  short strokes at each end that mark a line of symmetry on a partial/half view
  (ASME Y14.2). `boltCircleCenterline(center, radius, { holeCenters?, ... })` is
  the companion to the `boltCircle()` pattern: the dash-dot **bolt circle**
  through the hole centers, a horizontal + vertical center cross through the
  pattern, and a small centerline cross at each hole when `holeCenters` is
  passed. Both return `DrawingElement`s already carrying the `"centerline"`
  style (color/width overridable), so they drop straight into `sheet.add(…)`.
- **Hatching**: `hatch(boundary, options)` fills a region with parallel
  section-lining, returning one `DrawingElement` per line — same "array,
  caller adds" pattern as `centerMark`/`chainDimension`. `boundary` is a
  `Path` (or an array of them: outer boundary plus hole boundaries, combined
  under the even-odd fill rule, so holes are automatically left unhatched —
  no separate "holes" parameter). Internally a scanline fill rotated to the
  hatch angle (`angleDeg`, default 45°); arcs are tessellated first via
  `Path.flatten(angleStepDeg?)`, also usable standalone anywhere you need a
  Path reduced to straight-edged polygon vertices. `hatch()` also takes
  `phaseMM` (perpendicular offset of the line family, for interleaving
  multiple passes) and `dasharray`/`linecap`, which `hatchPattern()` builds
  on: `hatchPattern(boundary, pattern, options?)` runs `hatch()` once per
  `HatchLineFamily` in a `HatchPattern` (angle/spacing/phase/dash per family)
  and concatenates the results. `ANSI31`–`ANSI38` (also as
  `ANSI_HATCH_PATTERNS`) are the classic US mechanical-drafting
  material-symbol patterns — iron/steel/bronze/plastic/fire
  brick/marble/lead/aluminum — converted directly from AutoCAD's `acad.pat`
  (angle, spacing, and dash lengths preserved exactly, inches→mm via
  `toMM`), not approximated from memory. Two honest simplifications: (1) a
  dash-dot "dot" is a real 0-length dasharray entry in `acad.pat`, but a
  literal 0 renders as nothing (not a dot) in at least librsvg — verified
  directly — so a small positive epsilon is used instead, relying on
  `linecap: "round"` to still draw a dot; (2) `ANSI36`/`ANSI38` drop
  `acad.pat`'s per-row dash-phase stagger ("brick coursing"), since each
  hatch line's dasharray independently restarts at its own clipped start
  point in this engine — angle, spacing, and dash rhythm are otherwise
  exact, so both render as a regular grid rather than a staggered one. A
  `scale` option scales every family together, like AutoCAD's HPSCALE.
- **Knurl**: `knurl(boundary, { pattern, angleDeg?, spacingMM? })` fills a
  region with the knurl texture on a gripping surface — `"diamond"` (two hatch
  families crossed at `±angleDeg`, the default) or `"straight"` (one family) —
  built on the same `hatch()` scanline machinery, so it clips to the boundary
  and returns `DrawingElement`s per line. `knurlNote(pitch, pattern?)` gives the
  conventional callout string (`"0.8 DIAMOND KNURL"`) to hang on a `Callout`/
  `MultiLeader`.

## Sheets & layout

- **Paper sizes**: `PAPER_SIZES` covers ANSI A–E, ISO 216 A0–A5, and US
  architectural ARCH A–E1. `Sheet` takes a `paperSize` + `orientation` and
  exposes `drawingArea` (the usable region inside the border and above the
  title block). JIS mechanical drawings use the same ISO A sizes already
  provided (JIS A ≡ ISO A) — there's no separate JIS export, since the JIS B
  series is a real but different scale meant for general stationery, not
  drafting; adding it under a "JIS" paper-size option would be wrong, not
  just redundant. For anything else, `customPaperSize(widthMM, heightMM,
  label?)` builds a one-off `PaperSize` — `PaperSize` is a plain data shape,
  so any object matching it works as `paperSize` regardless of where it
  came from.
- **Border**: `Sheet`'s `borderStyle` defaults to `"plain"` (a single frame).
  `"zoned"` adds a map-style zone reference grid in the margin — numbered
  columns left-to-right and lettered rows top-to-bottom (`I`/`O` skipped to
  avoid confusion with `1`/`0`), so a location can be called out like "zone
  C3" (used by revision callouts). Zone count is derived per sheet from a
  ~50mm target zone size (`zonedBorderOptions.targetZoneSizeMM`), matching
  documented ISO 5457 practice; exact starting corner/direction varies a
  little across ASME and company templates in practice, so treat this as a
  sensible default rather than a hard guarantee of one specific standard.
- **Sheet output**: `sheet.toSVG()` renders the complete sheet — border,
  content, title block — as a standalone physical-unit SVG document.
  `sheet.toDXF(options?)` is the R12 DXF counterpart: it walks the content tree
  (recursing `Layer`s and `View`s), emits the border on a `"BORDER"` layer, bakes
  a `View`'s scale/rotation into its geometry, and explodes the title block — one
  call for a whole drawing. Entities are organized by type
  (`VISIBLE`/`DIMENSIONS`/`ANNOTATIONS`/`GDT`/`TITLEBLOCK`/`BORDER`), not by SVG
  `Layer` name. A native dimension inside a *scaled/rotated* view exports as a
  `DIMENSION` with the view transform baked into its definition points and picture
  geometry, while the displayed value is pinned to the true model measurement via
  the DXF group-1 text override (so a 2:1 detail still reads its real size);
  `options.onUnsupported` now fires only for content DXF has no representation for.
- **Title block**: `TitleBlock` renders the classic engineering "corner block"
  layout — a signoff grid (drawn/checked/eng approved/mfg approved, each with
  name + date) on the left, and drawing identification (size, drawing number,
  revision, title, material, finish, general tolerances, projection-angle
  symbol, scale, sheet) on the right. Anchored to the bottom-right of the
  sheet, sized independently of the sheet width (clamped to fit narrow
  sheets). `size` falls back to the `Sheet`'s paper size label automatically.
  The projection symbol (`"first-angle"` / `"third-angle"`) is the real ISO
  128 / ASME Y14.3 pictogram — a truncated cone in profile next to its
  concentric-circle end view, not just a text label.
  `ISO7200TitleBlock` is a second built-in style, based on the ISO 7200:2004
  field set (legal owner, identification number, revision index, date of
  issue, sheet, title, creator, approval person, document type) — a single
  full-width column, deliberately fewer fields than the ASME block, per the
  standard's own stated principle of keeping the title block's field count to
  a minimum. (The standard's example title-block diagram sits behind ISO's
  paywall beyond the fields/obligations table, so this layout is my own
  reasonable arrangement of the verified field set, not a pixel-for-pixel
  reproduction of ISO's Figure 1 — the field names and mandatory/optional
  status themselves came straight from the standard text.) For anything else,
  `GridTitleBlock` is the generic system both of these are built on: pass it
  your own columns of rows of cells (`grid.ts` — `"labeled"` cells with a
  corner label plus a value, or `"caption"` cells with centered static text)
  for a fully custom layout. `Sheet.setTitleBlock()` accepts any
  `TitleBlockLike` (`{ heightMM, render(ctx), renderElements?(ctx) }`), so a
  custom title block needs no special registration. All the built-in title
  blocks (and the `BOMTable`/`RevisionTable`) also expose their constituent
  `DrawingElement`/`TextElement` pieces — `renderElements(ctx)` on a title block,
  `toElements()` on a table — from which `render`/`toSVG` are derived, so they can
  be **DXF-exported** (see the DXF section): pass `exportDXF` a
  `{ titleBlock, context }` (the same context a `Sheet` supplies) or a bare table,
  and it explodes onto a `"TITLEBLOCK"` layer. A custom title block that provides
  only `render` still works on a `Sheet` but can't be DXF-exported.
- **Layers**: `new Layer({ name, visible? })` groups content into a named
  SVG `<g>`; `Layer` is itself `Renderable`, so it nests (`layer.add(otherLayer)`)
  and adds to a `Sheet` like anything else — no dedicated Sheet API needed.
  `visible: false` hides the group (`display:none`) without removing its
  content from the output, so downstream tools (Illustrator, Inkscape, a
  custom web viewer) can toggle it back on; it does *not* mean "don't
  render this" the way skipping `.add()` would. There's no per-layer default
  styling — content keeps whatever `lineStyle`/`stroke` it was given when
  constructed; a layer is purely an organizational/visibility grouping.
- **Scaled & rotated views (model space / paper space)**: `new View({ scale,
  rotationDeg?, modelOrigin?, paperOrigin? })` is a container whose children are
  authored in **true model coordinates** and drawn onto the sheet at `scale` (2
  for 2:1, 0.5 for 1:2), optionally turned by `rotationDeg` about `modelOrigin` —
  the separation real detail/section/**auxiliary** views need. Crucially it's
  *annotative*: geometry scales and rotates, but text height, arrowheads, and
  line weights stay in paper millimeters, **text is never turned** (labels stay
  upright and readable), and a dimension inside the view **reports the true model
  value**, not the scaled span (a `⌀8` hole drawn 2:1 still reads `⌀8.00`). So you
  draw a feature once at its real size and place it at any scale/angle without
  rescaling, re-rotating, or overriding dimension text. Delivered via a render-time
  `transform` on the shared `RenderContext` (the same mechanism as
  `dimensionDefaults`), so it also reaches content nested in a `Layer` and flows
  into PDF export. Honored by geometry (`DrawingElement`), `TextElement`, the
  dimension classes, and the elbow-leader `Callout`; other annotation classes render at
  paper scale regardless, so position those with `view.toPaper(modelPoint)`
  (with `toModel` as its inverse). `formatScaleRatio(scale)` renders the
  conventional ratio string (`2` → `"2:1"`, `0.5` → `"1:2"`) for a title-block
  `scale` field or a `"SCALE …"` label. Views don't compose — a nested `View`
  replaces the outer transform rather than multiplying it.
  `nearestStandardScale(scale, scales?)` snaps an arbitrary scale to the nearest
  preferred ISO 5455 ratio (compared in ratio/log space, so 3:1 → 2:1), with
  `STANDARD_SCALES` the built-in list and `isStandardScale(scale)` the membership
  test; pass a custom list for other conventions (e.g. ASME 1:4).
- **Reusable symbols (blocks)**: `new Block(name?)` defines a set of renderables
  once in **local coordinates** (`block.add(...)`); `block.instance({ position?,
  scale?, rotationDeg? })` stamps a placeable copy (a `Renderable`) onto a
  `Sheet`/`Layer`/`View` — the CAD block/symbol-library concept, so a standard
  fastener, weld symbol, or detail is authored once and dropped in many places at
  different positions, scales, and angles. A placed block applies the same
  view-style transform as `View` (geometry scales/rotates, text stays upright and
  paper-size), and — unlike `View` — an instance's transform **composes** with an
  enclosing `View`'s, so a symbol placed at model coordinates inside a scaled view
  scales with it. Instances emit no wrapper group (children render inline), so
  they flow through PDF export like any other content.
- **Multi-sheet sets**: `DrawingSet` solves the ordering problem plain
  `Sheet[]` can't — a sheet's title block typically needs "2 OF 5", but you
  don't know the total until every sheet is added. `set.add(factory)` takes a
  `(ctx) => Sheet` rather than a ready `Sheet`; `set.toSVGs()` resolves
  `{ index, total, sheetLabel }` for each and builds them in order, so
  `sheetLabel` ("2 OF 5") is available *while* constructing each sheet's
  title block, not after.

## Dimensioning

- **Dimensioning**: `LinearDimension(p1, p2, { offset, orientation })` draws
  extension lines, a dimension line broken around centered text, and
  arrowheads — `orientation` is `"aligned"` (parallel to p1→p2, the default),
  or `"horizontal"`/`"vertical"` to force an axis even when the two points
  aren't exactly aligned (e.g. the X-distance between holes at different Y).
  `offset` is signed: positive is 90° counterclockwise from the measurement
  axis (up for horizontal, left for vertical). An optional `breakAt` list of
  obstacles (model-space segments/circles) gaps this dimension's extension and
  dimension lines wherever they cross that geometry (`breakGapMM`, default
  1.5) — the `DIMBREAK` convention, built on `breakSegmentAtCrossings` and
  mapped through any active view transform; the native DXF `DIMENSION` is
  unaffected. `RadialDimension`/
  `DiameterDimension(center, radius, { angleDeg })` draw an `R`/`⌀` leader
  from the circle's surface, and `Callout(point, text, { angleDeg })` is the
  same elbow-leader mechanic for arbitrary notes (e.g. `"4X ⌀8.00 THRU"`).
  All three share one elbow-leader renderer (`renderElbowLeader`) so label
  text always stays horizontal regardless of leader angle (unidirectional
  dimensioning). `AngularDimension(vertex, p1, p2, { radius })` measures the
  angle at `vertex` counterclockwise from the ray toward `p1` to the ray
  toward `p2` (any point along each ray, e.g. an edge endpoint — the actual
  distance from `vertex` doesn't matter, only the direction) — draws
  extension lines out to a dimension arc broken around centered text, with
  arrowheads tangent to the arc. Since it's measured CCW specifically, order
  `p1`/`p2` accordingly, or you'll get the reflex angle (e.g. 270° instead of
  90°). The measured value auto-formats from the geometry on all four
  dimension types; pass `text` to override it.
  `chainDimension(points, options)` and `baselineDimension(points, options)`
  are thin helpers over `LinearDimension` for stacking a series: chain
  dimensions each consecutive pair (p0→p1, p1→p2, ...) sharing one offset
  (adjacent-feature spacing); baseline dimensions every point from a common
  datum (`points[0]`) at automatically increasing offsets
  (`options.stackSpacing`, default 8mm) so they don't overlap (position from
  one reference edge). Both return a plain `LinearDimension[]` you loop over
  and `.add()` individually — same pattern as `centerMark()`, no wrapper
  class. `chainAngularDimension(vertex, rays, options)` and
  `baselineAngularDimension(vertex, rays, options)` are the same two
  patterns for `AngularDimension`: chain measures each consecutive ray pair
  (rays[0]→rays[1], rays[1]→rays[2], ...) sharing one `radius`; baseline
  measures every ray from a common datum ray (`rays[0]`) at automatically
  increasing radii (`options.stackSpacing`, default 10mm) so the arcs nest
  without overlapping. `rays` are points along each ray (as with
  `AngularDimension` itself, distance from `vertex` doesn't matter) — order
  them counterclockwise, same CCW-sweep caveat as a bare `AngularDimension`.
- **Tolerances**: `LinearDimension`, `AngularDimension`, `RadialDimension`,
  and `DiameterDimension` all take `tolerance` — a plain number for a
  symmetric `±X`, or `{ plus, minus }` for asymmetric `+X/-Y`. On
  `LinearDimension`/`AngularDimension`, `toleranceDisplay: "limits"` instead
  shows the computed upper/lower limits stacked (two lines, nominal omitted)
  — the dimension line/arc gap sizes itself to fit whichever layout you pick.
  `RadialDimension`/`DiameterDimension` only support the inline `±`/`+/-`
  form (their leader text is single-line; no stacked limits there). All
  dimension/tolerance/limit values render at a fixed decimal precision
  (`style.precision`, default 2 — `"80.00"` not `"80"`), matching real
  drawing convention where every dimension on a sheet shares one precision
  regardless of whether a given value happens to be a whole number. All four
  classes also take `basic` (ASME Y14.5 basic dimension: a theoretically
  exact value paired with a GD&T feature control frame elsewhere — drawn
  boxed, sized to fit the rendered text with no separate geometry code
  needed) and `reference` (shown parenthesized, e.g. `"(40.00)"`, for
  convenience/traceability rather than inspection). Both only apply to the
  plain single-line display, not `toleranceDisplay: "limits"` (a basic
  dimension has no tolerance to compute limits from in the first place).
  They also take `count` (the ASME Y14.5 §1.9.5 repetition prefix — `count: 4`
  renders `"4X ⌀5.00"`, the count sitting outside any reference parentheses)
  and `typical` (appends `" TYP"`). Because these are applied in the one shared
  `formatToleranceText` chokepoint, every dimension class picks them up — and so
  does native DXF `DIMENSION` text. Feature-shape prefixes round this out: `RadialDimension`/
  `DiameterDimension` take `spherical` (ASME §3.3.6 — `SR`/`S⌀` for a spherical
  radius/diameter), and `LinearDimension` takes `square` (§3.3.7 — a `□` prefix
  meaning a square cross-section dimensioned once). The count and dual `[in]`
  bracket compose with all of these, and a bracketed dual value never repeats the
  count/TYP/reference qualifiers (they belong to the dimension as a whole, shown
  once). In non-embedded PDF the `□` prefix is substituted `SQ ` (like `⌀`→`Ø`),
  and renders as itself with an embedded font.
- **Half & not-to-scale dimensions**: `LinearDimension` takes `half: true` for an
  ASME/ISO **half (symmetry) dimension** of a part drawn as a half view — `p1` is
  taken on the axis of symmetry, only the `p2` side is drawn (one extension line,
  one arrowhead, the dimension line running past the axis), and the value shown is
  the **full** size (twice the `p1`→`p2` distance). Any dimension takes
  `notToScale: true`, which **underlines** the value per ASME Y14.5 §2.2 to flag a
  feature intentionally not drawn to size (applies to both the inline and
  stacked-limits displays; the underline is SVG/PDF-only, since DXF `TEXT` can't
  carry it). Both go through the shared tolerance/label path, so the full value
  also reaches the native DXF `DIMENSION`.
- **Display units & ASME zero suppression**: every dimension/leader class
  (`LinearDimension`, `RadialDimension`/`DiameterDimension`, `Callout`, …)
  takes `unit` (`"mm"` default, or `"in"`) and `zeroHandling`
  (`"none"`/`"inch"`/`"metric"`) via the shared `DimensionStyle`. `unit: "in"`
  converts the measured mm value to a decimal-inch value *for the label only*
  (a 50.8mm distance reads `2.000`), and defaults `precision` to 3 and
  `zeroHandling` to `"inch"` — the ASME Y14.5 §2.3.2 inch convention of
  **omitting the leading zero** (`.250`, not `0.250`) while keeping trailing
  zeros. `zeroHandling: "metric"` is the opposite (strict millimeter) rule:
  keep the leading zero, drop trailing zeros (`0.5`, `12.5`, `24`). The default
  `"none"` (millimeter, fixed decimal — `80.00`) preserves the library's
  original output exactly. A supplied `tolerance` is interpreted in the display
  `unit` (a label concern, not geometry), so an inch dimension takes an inch
  tolerance (`tolerance: 0.005` → `±.005`). `AngularDimension` is unaffected —
  its values are degrees. The same conversion/formatting is exposed standalone
  as `formatMeasurement(valueMM, format)` / `formatValue(valueInUnit, format)`
  for custom annotations.
- **Fractional & architectural inches**: for inch drawings, `inchDisplay`
  switches the number format — `"decimal"` (default), `"fractional"` (a reduced
  common fraction, `3/8`, `1 1/2`), or `"architectural"` (feet-and-inches with
  marks, `3'-6 1/2"`) — with `fractionDenominator` (a power of two, default 16)
  setting the fraction resolution. Tolerances render in the same style. This is
  what makes the ARCH paper sizes usable for architectural/woodworking drawings.
  Exposed standalone as `formatFractionalInches(valueIn, denom?)` and
  `formatArchitecturalInches(valueIn, denom?)`.
- **Degrees-minutes-seconds angles**: `AngularDimension` takes `angleFormat:
  "dms"` to write its value as `30°30′` (or `45°45′45″`) instead of a decimal
  degree count, via the standalone `formatAngleDMS(decimalDegrees,
  secondsPrecision?)`.
- **Dual dimensioning (mm [in])**: set `dualUnit` to also show the value
  converted into a second unit, in brackets after the primary — `50.00 [1.969]`
  for `unit: "mm", dualUnit: "in"` (ASME Y14.5 §2.4 bracket method). Any
  tolerance is converted into the second unit too (`50.00 ±0.50 [1.969 ±.020]`),
  and prefixes repeat inside the bracket (`⌀25.40 [⌀1.000]`, `R…`). `dualPrecision`
  / `dualZeroHandling` tune the secondary's formatting (defaulted per unit like
  the primary). Honored by `LinearDimension` (and its `chainDimension`/
  `baselineDimension` stacks) plus `RadialDimension`/`DiameterDimension`; a `text`
  override or `AngularDimension` (degrees) shows no bracket. Set it once as a
  `dimensionDefaults` to make a whole sheet dual-unit. The seam is exposed as
  `dualSecondary`/`appendDual` for custom annotations.
- **Document-wide drafting defaults**: rather than repeat `unit: "in"` (or a
  shared text/arrow/color style) on every dimension, set it once as the
  `Sheet`'s `dimensionDefaults` — a `DimensionStyle` merged *under* every
  dimension/leader element's own options at render time, so per-element options
  still win. Three presets ship for the common standards:
  `ASME_INCH` (`{ unit: "in", zeroHandling: "inch" }`), `ASME_METRIC`, and
  `ISO_METRIC` (both millimeter with leading-zero-kept/trailing-dropped rules) —
  `new Sheet({ dimensionDefaults: ASME_INCH })` makes the whole sheet a US
  inch drawing. Defaults flow through `Layer`s to nested content and into the
  PDF export (which renders the same sheet SVG); they're honored by the
  dimension classes and the elbow-leader `Callout`. `AngularDimension` deliberately ignores an inherited display
  `unit` (its values are degrees), while still picking up shared visual style.
  `mergeDimensionDefaults(options, defaults)` exposes the same merge for custom
  renderables.
- **US decimal-inch tolerance block**: `inchToleranceBlock({ onePlace, twoPlace,
  threePlace, fourPlace, fractionalInch, angularDeg })` builds the classic
  `.X`/`.XX`/`.XXX ± …, ANGLES ± …` title-block note where a dimension's
  decimal-place count picks its default tolerance — the inch counterpart to the
  ISO 2768 general-tolerance note (`iso2768Note()`, in `@invisra/draft-mechanical`).
  It returns a `string[]` (values formatted with inch
  zero-suppression, `±.005`) to pass straight into
  `TitleBlockFields.generalTolerance`.
- **Ordinate (arrowless) dimensioning**: `OrdinateDimension(origin, feature,
  { axis, offset, jog?, ... })` is ASME Y14.5 rectangular-coordinate
  dimensioning *without* dimension lines — a plain extension line from the
  feature (no arrowhead, no dimension line) ending in the feature's distance
  from a common `origin` along one `axis` (`"x"` or `"y"`), so every feature is
  dimensioned from one datum (the origin reads `0`). `offset` is the signed
  length of the extension line out to the value; `jog` adds the standard lateral
  dogleg near the readout to destagger crowded values. Values honor the display
  `unit`/`zeroHandling`, and text stays horizontal, same as every other
  dimension. `ordinateDimensions(origin, features, options)` returns one per
  feature (a plain `OrdinateDimension[]` you `.add()` individually — the same
  pattern as `chainDimension`/`baselineDimension`; include `origin` in
  `features` to show the datum's own `0`). `OrdinateOrigin(origin, { diameterMM?,
  strokeWidthMM?, color? })` draws the ASME Y14.5 §10.3 / ISO 129 origin
  indicator — the small open circle marking the datum — placed once at the origin
  point. Like arrowheads and text it stays paper-size (its position maps through
  any active `View` transform, its ~3mm diameter does not scale) and it exposes
  `bounds()`.
- **Arc-length dimensions**: `ArcLengthDimension(center, radius, startAngleDeg,
  endAngleDeg, { offset, counterclockwise?, symbol? })` dimensions the length
  *along* an arc (ASME Y14.5) — radial extension lines from the arc's two ends
  out to a concentric dimension arc, broken around a centered value with
  arrowheads tangent to the arc. The value is the true arc length (`radius ×
  sweep`) prefixed with the arc symbol `⌒`, honoring the display
  `unit`/`zeroHandling` and scaling annotatively inside a `View` (same
  `radius`/angle inputs as `Path.arc`).
- **Jogged (foreshortened) radius**: `JoggedRadiusDimension(arcPoint,
  falseCenter, radius, { jogSizeMM?, jogPosition? })` is the ASME §5.9.4 radius
  dimension for an arc whose true center is off the sheet — the leader runs from
  the arc to a convenient *false center* with a zigzag jog marking the break in
  the true radial distance, while the label reports the real (unforeshortened)
  `R…`.
- **Multileaders**: `MultiLeader(targets, note, { landing, shoulderSign? })`
  ties one note to several features — a leader from each target point converging
  on a common `landing`, then a single horizontal shoulder into the shared note
  (`note` may be a string array for stacked lines). The shoulder runs away from
  the targets by default; arrowheads at each target unless `arrow: false`. The
  natural way to write `3X ⌀5 THRU` once for three holes.
- **Material-condition calculator** (ASME Y14.5): `bonusTolerance(feature, actualSize)`
  returns the bonus earned as a feature of size departs from MMC/LMC (0 for RFS),
  `totalToleranceAt` adds it to the geometric tolerance, and `virtualCondition(feature)`
  gives the MMC/LMC sizes plus the virtual and resultant condition boundaries — the
  external/internal and MMC/LMC sign rules handled per Y14.5. Pure calculation, to
  pair with the drawn feature-control frames.

## GD&T & tolerancing

- **GD&T**: all 14 ASME Y14.5 geometric characteristic symbols
  (`renderCharacteristicSymbol` / `GDTCharacteristic`) — straightness,
  flatness, circularity, cylindricity, profile of a line/surface, angularity,
  perpendicularity, parallelism, position, concentricity, symmetry, and
  circular/total runout. `concentricity` and `symmetry` were deprecated in
  ASME Y14.5-2018 in favor of position tolerancing, but still appear on
  legacy drawings, so they're included. The tricky ones (profile line vs.
  surface, cylindricity's oblique tangent lines, symmetry's three stacked
  lines, single vs. double runout arrow) were verified against the Unicode
  Miscellaneous Technical block's official character names/cross-references
  and targeted research before implementing, not drawn from memory alone.
  `FeatureControlFrame(anchor, characteristic, toleranceValue, options)`
  renders the standard compartmented box — symbol, tolerance (optional `⌀`
  prefix and modifiers: `Ⓜ`/`Ⓛ` material condition, the projected-tolerance-zone
  `Ⓟ` via `projectedZone`/`projectedHeight` — `⌀0.14 Ⓜ Ⓟ 25` —, unequally-disposed
  profile `Ⓤ` via `unequallyDisposed`/`unequallyDisposedValue` — `0.4 Ⓤ 0.1` —,
  free-state `Ⓕ`, tangent-plane `Ⓣ`, and statistical-tolerance (boxed `ST`, via
  `statistical`)), and 0–3 datum reference compartments (each with its own
  optional modifier).
  `CompositeFeatureControlFrame(anchor, characteristic, segments, options)` draws
  the ASME Y14.5 **composite** frame: one characteristic symbol shared across a
  tall cell, followed by two or more stacked tolerance-zone rows (the upper
  pattern-locating framework / PLTZF over lower feature-relating frameworks /
  FRTZF, each a `FrameSegment` with its own tolerance, modifiers, and datums).
  Compartment columns align across rows; a row with fewer datums extends its last
  compartment to the frame edge. This differs from stacking separate
  `FeatureControlFrame`s, which repeat the symbol.
  `MultipleSingleSegmentFrame(anchor, rows, options)` is the ASME Y14.5
  **multiple single-segment** control — two or more *complete, independent*
  single-segment frames stacked into one box, each row (`SingleSegmentRow`) with
  its **own** characteristic symbol (so the horizontal dividers run full width,
  and rows may even carry different characteristics), as opposed to the composite
  frame's one shared symbol.
- **GD&T application modifiers** (`modifierSymbols.ts`): the symbols that sit on a
  feature control frame's leader or datum references rather than in its cells.
  `allAroundSymbol(junction)` draws the all-around circle at a leader knee;
  `allOverSymbol(junction)` the all-over double circle; `betweenSymbol(from, to,
  { fromLabel?, toLabel? })` the between (`↔`) double-arrow limiting where a
  profile applies; `continuousFeatureNote(anchor)` the `CF` continuous-feature
  indicator. The datum-translation `▷` modifier is a `translation: true` flag on a
  frame's `DatumReferenceSpec`.
  `DatumFeatureSymbol(touchPoint,
  letter, { angleDeg })` is the filled-triangle-plus-leader-plus-boxed-letter
  that tags a surface as a datum — distinct from a frame's datum reference,
  which cites an already-tagged datum. Neither attaches a leader
  automatically to a `FeatureControlFrame` the way `RadialDimension` does;
  position it directly, or compose your own leader from existing primitives.
- **Datum targets**: `DatumTargetSymbol(touchPoint, letter, targetNumber,
  { angleDeg, areaSize?, areaText?, side? })` is ASME Y14.5's other datum
  mechanism — a circle divided in half by a horizontal line (lower half always
  "A1"-style letter+number; upper half shows a circular contact area's diameter
  via `areaSize` → "⌀6.00", or a non-circular area's dimensions via `areaText` →
  e.g. "10X6", left blank for a point/line target), on a leader that's solid for
  a near-side target or dashed (`side: "far"`) for far-side. Auto-grows to fit
  whichever half's text is longest rather than overflowing a fixed size. Distinct
  from `DatumFeatureSymbol`, which tags an entire feature as a datum rather than a
  specific point/line/area used to establish one. `datumTargetPoint(center)`
  draws the "X" contact-point marker (as two separate line elements — `Path`
  has no compound-subpath support, so a true X needs two, the same reason
  `centerMark()` returns an array); `datumTargetLine` builds the phantom-line
  marker. For area targets, `datumTargetArea(center, radius)` (circular),
  `datumTargetRectangle(center, width, height)` (rectangular), and
  `datumTargetAreaOutline(boundary)` (any closed `Path` — an ellipse, polygon,
  etc.) all build the cross-hatched, phantom-outlined contact area.

## Annotation & symbols

- **Revision table**: `RevisionTable(anchor, entries, options)` — a
  ZONE/REV/DESCRIPTION/DATE/APPROVED table (ZONE is opt-in via `columns`,
  since it only makes sense paired with a `borderStyle: "zoned"` sheet) built
  on the same grid primitives as the title blocks. `anchor` is the table's
  top-left corner; pass entries newest-first, since they render top to
  bottom. Distinct from a title block's single `REV` field — this is the
  full history, and the one place the zoned border's grid references
  actually get used by something.
- **Revision clouds**: `revisionCloud(boundary, { arcLengthMM?, bulgeRatio?,
  strokeWidthMM?, color? })` draws a scalloped boundary of conjoined outward
  arcs around a changed area — `boundary` is any closed polygon (`rectangle()`
  or a plain `Point[]`), built as a single continuous `Path` (chained `.arc()`
  calls, not multiple `moveTo()`s, since `Path` only supports one subpath).
  Bump size (`arcLengthMM`, default 8mm chord length) and bulge height
  (`bulgeRatio`, default 0.18 of the chord) aren't values fixed by ASME
  Y14.35 — even AutoCAD's own REVCLOUD command treats arc length as an
  approximate, randomized target rather than a spec'd constant — so these are
  reasonable, visually-verified defaults. Pair it with `RevisionSymbol(center,
  letter, { shape?, sizeMM?, ... })`: a circled letter by default, since ASME
  Y14.35's text specifies enclosing the revision letter in a **circle**, or
  `shape: "triangle"` for the widely-used "delta" convention that's common
  industry practice but not the literally-standardized shape.
- **Bill of materials**: `BOMTable(anchor, entries, options)` — an
  ITEM/QTY/PART NUMBER/DESCRIPTION table (MATERIAL is opt-in via `columns`),
  built on the same grid primitives as `RevisionTable`, for assembly
  drawings. Same "caller controls order" contract as `RevisionTable`: entries
  render top to bottom in the order given. Many shops place this table
  directly above the title block with item 1 in the row nearest the title
  block (ascending upward) rather than at the top — that specific direction
  isn't a single universally-cited rule, so reverse `entries` yourself if you
  want that convention. `ItemBalloon(touchPoint, itemNumber, { angleDeg,
  terminus? })` cross-references a part in the assembly view to its `BOMTable`
  row — a circled number on the same elbow-leader geometry as
  `Callout`, with the circle sitting at the end of the leader's
  shoulder. `terminus` is `"dot"` (default, a small filled circle) for
  pointing at a general surface/area, or `"arrow"` for pointing precisely at
  an edge/profile — the conventional distinction between the two leader
  styles.
- **General notes**: `NotesBlock(anchor, notes, options)` renders the numbered
  `NOTES:` list every drawing carries — a bold heading (customizable, or `""`
  to omit) over a numbered list, with long notes word-wrapped to `maxWidthMM`
  using a hanging indent so continuation lines align under the note text. Reports
  `heightMM` from the wrapped layout, the same "position/stack me" contract as
  `RevisionTable`/`BOMTable`. `FlagNote(center, number, { shape? })` is the
  numbered flag ("delta note") placed in the field to tie a feature to a note —
  a `"triangle"` (default), `"pentagon"`, or `"hexagon"`; the shape isn't rigidly
  standardized (the triangle/delta is most common), so it's selectable. Distinct
  from `RevisionSymbol`, which references a revision rather than a general note.
- **Section views**: `CuttingPlaneLine(points, { viewDirectionDeg, label? })`
  draws the ASME Y14.2/Y14.3 cutting-plane symbol — a thick (0.6mm) line with
  the same long-short-short dash rhythm as the `"phantom"` line style (but
  thick, not thin), a perpendicular arrow leg at each end, and an optional
  bold label. `points` takes 2+ points, so offset/stepped sections (more than
  one plane) work the same way as a straight one. Both end arrows point in
  `viewDirectionDeg` — the direction of sight through the cut, i.e. toward
  the material that ends up shown in the section, *not* toward the viewer
  standing at the cutting plane (easy to get backwards; verified against
  multiple independent sources before implementing, same as the projection
  symbol earlier). This class is only the marker on the source view; use
  `sectionView(...)` (below) to generate the section fill itself, and a
  `ViewLabel` for the "SECTION A-A" title.
- **Section fill generation**: `sectionView(boundary, { cut?, angleDeg?,
  spacingMM?, outline?, color? })` turns a material cross-section into a section
  view's fill — it section-lines (hatches) the region, leaving holes/islands
  open via the even-odd rule, and returns `{ region, hatch, outline }`
  (`DrawingElement`s ready to `.add()`, plus the region rings). With a `cut`
  cutting plane (`{ p1, p2, keep: "left"|"right" }`) it first clips the region to
  the kept side — intersecting each boundary ring with a half-plane via the
  polygon-boolean clipper — so you can section "the far half" of an outline. It's
  a 2D fill generator over the material outline you supply (outer ring plus any
  hole rings), composing the boolean and `hatch()` machinery; keep the cut line
  out of exact coincidence with a vertex (the Greiner–Hormann general-position
  caveat). Not a 3D-model section.
- **Named section helpers** (`sectionHelpers.ts`): the standard section
  conventions layered on `sectionView`. `halfSection(boundary, cut, options)`
  sections one half of a symmetric part and also returns the axis-of-symmetry
  **centerline** along the cutting plane (the edge convention that marks a half
  section) as `{ …, centerline }`. `revolvedSection(profile, options)` hatches an
  in-situ cross-section with a **thin** visible outline (per ASME Y14.3, since it
  sits on the view). `removedSection(profile, { label, … })` hatches a cross-
  section drawn away from the part and returns a centered `ViewLabel`
  ("SECTION A-A") beneath it as `{ …, label }`.
- **Detail views**: `DetailViewCallout(center, radius, { angleDeg, label,
  text? })` is the ASME Y14.3 detail-view marker — a phantom-line circle
  around the area of a source view that's shown enlarged elsewhere, with an
  elbow leader (arrow touching the circle) to a "DETAIL X" label. Same scope
  as `CuttingPlaneLine`: only the marker, not the detail view itself or its
  own title — use a `ViewLabel` for that.
- **View titles & viewing-direction arrows**: `ViewLabel(position, title, {
  scale?, underline?, textSizeMM?, anchor?, color? })` is the bold caption placed
  beneath a drawn view — pass the full title string (`"SECTION A-A"`, `"VIEW A"`,
  `"DETAIL B"`; the caller owns the wording), with an optional smaller
  `"SCALE 2:1"` caption below and an optional underline rule spanning the title.
  This is the title the section/detail *markers* deliberately don't draw.
  `ViewArrow(tail, { angleDeg, label, lengthMM?, ... })` is the ISO 128-30
  **arrow (viewing-direction) method** indicator — a thick arrow pointing in the
  direction of sight with a bold letter at its tail, calling out an auxiliary or
  other view taken from that direction (the referenced view is then titled with
  the same letter via `ViewLabel`); distinct from `CuttingPlaneLine`, which is
  for sections. Both map their position through any active `View` transform while
  staying paper-size.
- **Break lines**: `zigzagBreakLine(p1, p2, options)` is the ASME Y14.3
  conventional "long break" — an otherwise-straight line with a single
  zigzag jog centered on its midpoint, for shortening a long uniform flat
  member (a bar, plate, extrusion) without changing scale. Call it once per
  edge being broken (top and bottom of a rectangular bar); both calls' jogs
  line up automatically since each centers on its own `p1`-`p2` midpoint.
  `cylindricalBreakLine(p1, p2, options)` is the equivalent "S-break" for a
  round shaft/tube — `p1`/`p2` are the two points spanning the diameter at
  the break, connected by two mirrored semicircular arcs (radius = 1/4 the
  `p1`-`p2` distance) forming an exact S-curve, called once per break since
  it already spans both outer edges. Neither the straight zigzag's exact
  proportions nor the S-break's curve are numerically dimensioned in the
  standard (only "reveal the characteristic shape of the cross section" is
  specified) — both are the widely-used conventional construction, verified
  by rendering rather than a primary-source measurement. `freehandBreakLine(p1,
  p2, options)` is the ASME Y14.3 freehand "short break" — the thick wavy line
  hand-drawn across a member where a small portion is broken away. Since the
  library is deterministic, its wave is a byte-stable undulation (a sine sampled
  four times per wave and faired through `fitSpline`, ends anchored on `p1`/`p2`)
  rather than randomized jitter, and it's drawn heavier (`strokeWidthMM` 0.5) than
  the visible outline by default; tune `amplitudeMM`/`wavelengthMM` for the wave.
- **Nondestructive-examination (NDE) symbols**: `ExaminationSymbol(jointPoint,
  { angleDeg, arrowSide?, otherSide?, centered?, allAround?, fieldExam?,
  tailNote? })` is an AWS A2.4:2020 clause-17 examination symbol on the same
  leader geometry. Each `ExamSpec` carries `methods` (a letter designation such
  as `"RT"`/`"UT"`/`"MT"`/`"PT"`/`"VT"`/`"ET"`, or an array joined with `+` for
  two methods on one side, §17.5.6), an optional `length` extent (a length or a
  `"25%"` percentage, §17.11) shown to the right, and a `count` of examinations
  in parentheses (§17.12). The designation sits below the line for `arrowSide`,
  above for `otherSide`, straddling for `centered` (no side significance); an
  `allAround` circle and a `fieldExam` flag attach at the junction, and
  `radiationAngleDeg` draws the radiation-direction arrow with its degree value
  (§17.4). Validated against clause 17.

## Export & testing

- **DXF export**: `exportDXF(elements, options?)` writes geometry **and text** —
  each `DrawingElement` becomes a DXF `POLYLINE` and each `TextElement` (or
  `{ text, layer?, colorIndex? }`) a `TEXT` entity (honoring height and
  horizontal/vertical justification, defaulting onto a `"TEXT"` layer, with a
  `STYLE`/`STANDARD` table emitted when any text is present). A multi-line
  `TextElement` becomes one `TEXT` entity per line, stacked downward to match the
  SVG layout (R12 `TEXT` is single-line; `MTEXT` is R13+). A `LinearDimension`
  becomes a **native `DIMENSION` entity** — not exploded lines/text: the exporter
  emits a `DIMSTYLE` table, a `BLOCKS` section with one anonymous block per
  dimension holding its picture (extension lines, dimension line, `SOLID`
  arrowheads, value `TEXT`), and the `DIMENSION` entity referencing that block, so
  the receiving CAD sees an editable dimension on a `DIMENSIONS` layer (validated
  against `dxf-parser` during development). `RadialDimension`,
  `DiameterDimension`, `AngularDimension`, and `OrdinateDimension` are native
  `DIMENSION` entities too (dimtypes 4, 3, 2, and 6 — the last with the X-datum
  bit 64 for `axis: "x"`); each exposes a `dimensionDXF()` giving the block
  "picture" (angular uses `ARC` entities for the text-broken dimension arc) plus
  the DXF definition points. A GD&T annotation — a `FeatureControlFrame`,
  `CompositeFeatureControlFrame`, `DatumFeatureSymbol`, or `DatumTargetSymbol`,
  passed bare or wrapped in a `{ gdt, layer?, colorIndex? }` for an override — is
  **exploded** into its constituent `POLYLINE`/`TEXT` entities on a `"GDT"` layer
  (R12 has no native feature-control-frame entity). Each of these classes
  implements the shared `Explodable` interface (`toElements(): (DrawingElement |
  TextElement)[]`), and its `toSVG()` is derived from the very same element list,
  so the SVG and DXF renderings can't drift apart. A title block or table is
  exploded the same way onto a `"TITLEBLOCK"` layer: a `{ titleBlock, context }`
  input (the `context` being the same sheet width/margin/paper-size a `Sheet`
  would pass, so the block lands at the sheet's bottom-right) or a bare anchored
  `BOMTable`/`RevisionTable`. To export a whole sheet at once — border, content,
  views, and title block — use `sheet.toDXF()` (see "Sheet output"), which composes
  all of these. A `BlockInstance` (from a reusable `Block` symbol)
  exports as a shared **`BLOCK` definition plus an `INSERT`**: each distinct
  source `Block` is written once into the `BLOCKS` section (its
  `DrawingElement`/`TextElement` children authored at the block's local origin,
  on layer `0`), and every placement emits an `INSERT` carrying that instance's
  position, uniform scale, and rotation — so a symbol placed a hundred times
  stays one definition and a hundred lightweight references rather than a hundred
  copies of flat geometry. Blocks sharing a `name` are disambiguated (`SYM`,
  `SYM_2`); unnamed blocks get `BLOCK1`, `BLOCK2`, … Only geometry and text
  inside a block are emitted (nested blocks and dimensions within a block are
  skipped). `MTEXT` isn't used: it's an R13+ entity and this writer
  targets R12/`AC1009`. `Path.arc()` segments are preserved as
  true arcs via per-vertex bulge values (`pathToPolyline`,
  `dxf/polylineConversion.ts`) — not tessellated the way `hatch()`'s scanline
  fill needs `Path.flatten()` to be — while elliptical arcs are tessellated
  (bulge is circular-only). A `lineStyle` maps to both a same-named DXF layer and linetype
  (`VISIBLE`/`HIDDEN`/`CENTER`/`PHANTOM`), with the `HIDDEN`/`CENTER`/
  `PHANTOM` linetypes built from the exact same dash-array values as
  `LINE_STYLES`, so the DXF dash rhythm matches the SVG output. Pass
  `{ element, layer, linetype?, colorIndex? }` instead of a bare
  `DrawingElement` to override the inferred layer (e.g. routing hatch lines,
  which carry no `lineStyle`, onto their own `"HATCH"` layer). Output is
  deliberately old-format DXF (R12/`AC1009`, classic `POLYLINE`/`VERTEX`/
  `SEQEND` rather than the newer `LWPOLYLINE`) — R12 needs no entity handles
  or subclass markers, keeping the writer a plain, dependency-free
  group-code serializer while still supporting per-vertex bulge; verified by
  round-tripping generated files through `ezdxf` (Python) during development.
- **DXF import**: `importDXF(dxfString)` is the inverse of `exportDXF` — it reads
  a DXF's `ENTITIES` back into `{ elements: DrawingElement[], texts:
  TextElement[] }`, so a drawing round-trips (`importDXF(exportDXF(x))`) and
  foreign DXFs can be ingested. Reads the entity types this library writes plus
  the common ones other tools emit: `LINE`, `CIRCLE`, `ARC`, `LWPOLYLINE`,
  `POLYLINE`/`VERTEX` (arcs recovered *exactly* from per-vertex bulges — the
  inverse of the bulge encoding), and `TEXT` (height + justification). Each
  geometry entity's `lineStyle` is recovered from its layer name. The round-trip
  is idempotent — `exportDXF(importDXF(exportDXF(x)))` reproduces the DXF
  byte-for-byte (verified in tests). Entity types the library never emits
  (SPLINE, ELLIPSE, INSERT/blocks, HATCH, DIMENSION, MTEXT, 3D) are skipped
  rather than erroring, so a foreign file imports its supported subset; colors
  and non-geometry metadata are dropped.
- **PDF export**: `exportPDF(sheet, options?)` renders the *whole* sheet —
  border, title block, dimensions, GD&T, hatching, everything, not a
  geometry-only subset — because unlike DXF it works by parsing the exact
  SVG markup `sheet.toSVG()` already produces (a small hand-rolled parser for
  exactly the four element shapes this library's SVG generator ever emits —
  `svg`/`g`/`path`/`text` — not a general SVG parser) and converting that
  into PDF content-stream operators, arcs included (SVG arcs become cubic
  Bezier curves via the standard endpoint-to-center recovery + kappa
  approximation, since PDF has no native arc operator). `Layer`s become real
  PDF Optional Content Groups, toggleable in a viewer's layers panel (e.g.
  Acrobat) — a `visible: false` layer starts in the OCG "OFF" state, the same
  intent as its SVG `display:none` rendering but genuinely interactive here.
  By default, text renders in standard (non-embedded) Helvetica/Helvetica-Bold
  — keeping the exporter dependency-free and shipping no bundled font — so only
  WinAnsi/Latin-1 characters are guaranteed to render, and the handful of
  Unicode drafting symbols this library uses as literal text (`⌀`/`⌴`/`⌵`;
  everything else, like GD&T characteristic symbols and the circled M/L
  modifiers, is already vector geometry) are substituted with their
  historical pre-Unicode equivalents (`Ø`, `CBORE `, `CSK `). To render
  **arbitrary Unicode** instead, pass `options.font` a TrueType or OpenType/CFF font
  (`exportPDF(sheet, { font: { data: fontBytes } })`): the exporter parses it
  (`pdf/ttf.ts`) and embeds it as a composite Type0/Identity-H font
  (CIDFontType2, `CIDToGIDMap /Identity`) with a `/ToUnicode` map, so `⌀`/`⌴`/`⌵`
  and any other glyph render as themselves. It still bundles **no** font (you
  supply the bytes) and stays zlib-free — the font embeds as a hex-encoded
  (`ASCIIHexDecode`) `FontFile2`, so output stays plain-ASCII. A `glyf` `.ttf` is
  **subsetted** to the glyphs actually used (a "blanking" subset that keeps glyph
  ids stable — composite glyphs pull in their component glyphs), and `bold` text
  runs are synthesized by stroking the glyph outline (faux-bold), since one
  embedded font carries a single weight. **OpenType/CFF (`.otf`, `OTTO`)** fonts
  embed too: the bare `CFF ` table becomes a `FontFile3` (`/Type1C`, or
  `/CIDFontType0C` when the CFF is CID-keyed — detected via the Top-DICT ROS
  operator) inside a `CIDFontType0` descendant (no `CIDToGIDMap`); the shared
  `head`/`hhea`/`maxp`/`hmtx`/`cmap`/`name` tables and the Identity-H GID encoding
  are the same as the TrueType path. The **CFF is glyph-subsetted** too — its
  CharStrings INDEX is blanked to the used glyphs (unused charstrings become a
  bare `endchar`) with glyph ids, subrs, charset, and strings kept intact, so the
  CID==GID assumption holds. Both plain (Type1C) and CID-keyed
  (FDArray/FDSelect/per-FD Private DICT) CFFs are subsetted; an unexpected CFF
  structure falls back to embedding whole. Color parsing covers hex plus a bounded set of CSS named
  colors, falling back to black for anything else (e.g. `rgb()`/`hsl()`
  functions). Output is plain-ASCII and byte-deterministic
  (no timestamps, no random `/ID`), verified against real PDF tooling
  (`pypdf`, `poppler`'s `pdftoppm`, Ghostscript) during development,
  including confirming a hidden `Layer` genuinely toggles visible again when
  its OCG is turned on, not just coincidentally absent.
- **Regression testing**: `test/regression.test.ts` snapshot-tests the raw
  SVG/DXF/PDF text output of the full worked example (`examples/basic-sheet.ts`,
  refactored to export `buildBasicSheetExample()` so both the CLI demo and
  the test suite build the same scenario) plus a couple of scenarios it
  doesn't otherwise exercise (`ISO7200TitleBlock`, `CuttingPlaneLine`).
  Deliberately text snapshots, not pixel diffs: different SVG renderers draw
  identical markup slightly differently (confirmed earlier — librsvg vs.
  ImageMagick disagreed on a real drawing), which would make a pixel
  baseline an unreliable, machine-dependent regression signal; a text diff
  of the generated markup has no such flakiness and adds no dependencies.
  This catches *unintended* changes to already-verified output — it doesn't
  replace the manual librsvg-render-and-inspect verification (see git
  history) used to confirm a *new* feature is correct in the first place.
