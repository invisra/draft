# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Mechanical modules extracted into `@invisra/draft-mechanical`**: the
  mechanical-engineering specifications built during this cycle — fasteners &
  thread specs (threads, hex fasteners, screw/bolt profiles, keyways, splines,
  retaining rings, DIN 509 relief grooves, ISO 6411 centre holes), the fits &
  general-tolerance standards (ISO 286, ISO 2768, ASME B4.1) and tolerance
  stack-ups, surface-finish and weld symbols, the machine elements (gears,
  springs, cams, V-belt sheaves, taper/slope callouts), and the hole & chamfer
  callouts and hole tables — now live in the companion package
  [`@invisra/draft-mechanical`](https://github.com/invisra/draft-mechanical),
  which builds on this core. The "Added" entries below that describe those
  features document where the code was first written; it ships from the
  mechanical package. `@invisra/draft` keeps the drafting core: geometry,
  sheets, dimensioning, GD&T feature-control frames, and SVG/DXF/PDF export.

### Added

- **DIN 509:2006 undercut dimensions**: `din509Undercuts(diameterMM, { type?, load? })` returns
  the standard undercut sizes (radius, recess depths, widths) for a workpiece diameter — Table 1
  transcribed for all four types (E/F/G/H) and both load cases — and `din509Designation` formats
  the call-out. The distinct `r × t1` sizes are validated against the standard's Table 2 list.
  Pairs with `reliefGrooveProfile` to size and draw the groove.
- **DIN 509 relief-groove profile**: `reliefGrooveProfile(options)` draws a machined
  shaft-shoulder relief/undercut groove (DIN 509 form-E form — corner radius + angled
  run-out at the standard flank angle) from a user-supplied depth, breadth, and radius.
  Geometry only; the DIN 509 dimension tables are not built in.
- **ANSI B27.7 retaining ring lookup**: `retainingRingForShaft(shaftDiameterMM)`
  returns the metric external tapered retaining ring (3AM1 series) and the shaft
  groove to cut (diameter, width, depth, edge margin) for a standard shaft size, and
  `retainingRingDesignation` gives the part designation. All 58 sizes (4–100 mm)
  transcribed from the standard, with groove depth validated against (shaft − groove
  diameter)/2.
- **ANSI B17.2 Woodruff key lookup**: `woodruffKey(number)` returns a Woodruff key's
  nominal width/diameter and tabulated dimensions (length F, full-radius height C,
  flat-bottom height D, distance-below-center E) — all 41 keys transcribed from ANSI
  B17.2-1967 (R1998) and cross-checked against the standard's key-number encoding rule
  (`decodeWoodruffKeyNumber`).
- **ASME B17.1 key sizing & keyseat depth-control**: `keyForShaft(shaftDiameterIn,
  type?)` returns the standard parallel-key width/height and nominal keyseat depth
  (Table 1, transcribed from ANSI/ASME B17.1-1967 R2003), and `keyseatDepthControl`
  / `shaftKeyseat` compute the chordal height and the shaft (`S`) and hub (`T`)
  depth-control dimensions from the standard's formulas — validated against the
  standard's Table 3 (square/rectangular, parallel/taper). Sizes the keyway geometry
  helpers from a shaft diameter.
- **More screw/bolt head profiles**: `countersunkFlatHeadScrew` (conical flush head at
  the standard 90°/82° included angle), `panHeadScrew` (circular-arc domed head), and
  `hexBoltSideView` (across-flats hex-head elevation with chamfered corners) join
  `socketHeadCapScrew` in the fastener-profile family — proportional defaults, all
  overridable.
- **V-belt sheave groove section**: `vBeltSheaveSection(origin, options)` draws the
  sectional grooved-rim outline of a V-belt sheave (ISO 4183 / classical convention) —
  symmetric V-grooves at the standard included angle, single or multi-groove, from the
  widths and depth you supply.
- **Socket-head cap screws & washers**: `socketHeadCapScrew` (ISO 4762 / ASME B18.3
  side elevation with the hex-socket recess, proportional defaults but every dimension
  overridable), plus `plainWasher` (top view), `plainWasherSection` (cut view), and
  `splitLockWasher` (helical-spring lock washer).
- **Radial cam profiles**: `camProfile(center, options)` generates a disk-cam pitch
  curve from a follower-motion program — dwell / uniform / harmonic / cycloidal /
  parabolic segments (signed lift, durations totaling 360°) — wrapping the computed
  follower displacement around the base circle. Pure kinematics, no tables.
- **Gear rack profile**: `gearRackProfile(origin, options)` draws the involute rack
  (a gear of infinite radius) — full-depth trapezoidal teeth with straight flanks at
  the pressure angle, laid along the pitch line — as an open toothed edge or a closed
  solid body. Completes the gear family (spur, internal, rack).
- **Spline representation**: `splineEndView(center, spec, options)` draws the ISO 4156
  / ANSI B92.1 simplified splined shaft/bore end view (major, minor, and optional
  pitch circles), with the external-shaft vs internal-bore line-weight convention.
- **Extension & torsion springs**: `extensionSpring` (coil body with a circular end
  loop at each end) and `torsionSpring` (coil body with a straight leg at each end,
  at configurable angles) complete the spring family alongside `compressionSpring`,
  all ISO 2162 single-line schematics.
- **Internal (ring) gear profile**: `internalGearProfile(center, spec, options)`
  draws the involute tooth profile of an internal/ring gear — the radial inverse of
  `gearProfile`, with teeth pointing inward and spaces at the larger root circle.
- **Involute gear tooth profiles**: `gearProfile(center, spec, options)` draws the
  true involute tooth profile of a standard full-depth spur gear as a single closed
  path — real involute flanks joined by tip and root-land arcs (with a radial below
  the base circle), computed from module/teeth/pressure-angle with no tables, and
  auto-capping pointed teeth on low tooth counts. Complements the existing
  simplified `gearCircles`.
- **GD&T advanced modifiers & multiple single-segment frames**: the ASME Y14.5
  application modifiers that sit on a feature control frame's leader or datum
  references — `allAroundSymbol`, `allOverSymbol`, `betweenSymbol` (`↔`),
  `continuousFeatureNote` (`CF`), and a `translation` (`▷`) flag on datum
  references — plus `MultipleSingleSegmentFrame`, two or more complete
  single-segment controls stacked into one frame (each row with its own
  characteristic symbol), distinct from the existing composite frame.
- **Keyways & keyseats**: `boreKeywayProfile`, `shaftKeyseatEndProfile`, and
  `woodruffKeyseatProfile` generate the outline geometry for parallel (ASME B17.1
  / ISO R773) and Woodruff (ISO 3912) keyways and keyseats from a user-supplied
  width and depth (no sizing tables built in).
- **ISO 6411 centre holes**: `centerHoleProfile` draws the sectional cavity
  outline for forms A and B, and `centerHoleDesignation` gives the standard
  designation string (forms A, B, R), e.g. `ISO 6411-A 2.5/5.3`.
- **Half (symmetry) & not-to-scale dimensions**: `LinearDimension` accepts
  `half: true` (one side drawn about an axis of symmetry, value shown as the full
  size), and every dimension accepts `notToScale: true` (the value is underlined,
  per ASME Y14.5 §2.2). `TextElement` gained an `underline` option.
- **Named section helpers**: `halfSection` (sections one half and returns the
  axis centerline), `revolvedSection` (thin in-situ outline), and `removedSection`
  (with a `SECTION A-A` title), on top of `sectionView`.
- **Preferred scales & line-type presets**: `STANDARD_SCALES` (ISO 5455) with
  `nearestStandardScale` / `isStandardScale` for snapping an arbitrary scale to a
  preferred ratio, and `break` / `section` / `cutting` entries added to
  `LINE_STYLES`.
- **ASME B4.1 inch limits & fits**: `inchFit(fitClass, nominalIn)` — the inch
  counterpart to `iso286Fit` — returns hole and shaft limits (in inches), the
  min/max assembly clearance, and a `clearance`/`transition`/`interference`
  classification for any ANSI B4.1-1967 preferred fit: running & sliding
  `RC1`–`RC9`, locational clearance `LC1`–`LC11`, locational transition
  `LT1`–`LT6`, locational interference `LN1`–`LN3`, and force & shrink
  `FN1`–`FN5`. Limits are transcribed from the standard's Tables 5–9 and
  validated cell-by-cell (743 cells) against the standard's own limits-of-
  clearance / limits-of-interference columns in the test suite.
- **ISO 2553 weld symbols — System A (dual reference line)**: `WeldSymbol` now
  accepts `identificationLine: "above" | "below"`, drawing the solid reference
  line with a parallel dashed identification line so arrow-side and other-side
  welds are placed by ISO 2553 System A (the default remains System B, a single
  reference line with above/below placement).
- **Tolerance stack-up analysis**: `toleranceStackUp([{ nominal, tol } | { nominal,
  plus, minus }, …])` computes both the worst-case (arithmetic) and RSS
  (statistical) bounds of a 1-D chain of toleranced dimensions — signed nominals,
  unequal tolerances shift the RSS mean, and the result reports the nominal gap,
  min/max, and total spread for each method.
- **GD&T material-condition calculator (ASME Y14.5)**: `bonusTolerance(feature,
  actualSize)` returns the bonus tolerance earned as a feature of size departs
  from MMC/LMC (0 for RFS), `totalToleranceAt` adds it to the geometric tolerance,
  and `virtualCondition(feature)` gives the MMC/LMC sizes plus the virtual and
  resultant condition boundaries — external/internal and MMC/LMC sign rules
  handled per Y14.5.
- **ISO 286 fits for nominal sizes over 500 up to 3150 mm**: the fit functions
  (`iso286Shaft`/`iso286Hole`/`iso286Fit`) now cover the large-size range for the
  letters the standard defines there — `d e f g h js k m n p r s t u` (both cases) —
  with fundamental deviations transcribed from ISO 286-2:2010 Tables 18–29 (the
  standard's formulas round differently over 500 mm, so the values are tabulated,
  with `r s t u` on the standard's finer over-500 sub-ranges). Above 500 mm the Δ
  correction is zero (the hole near deviation is the negated shaft deviation), and
  `k` becomes ei = 0; every value is validated cell-by-cell against the standard's
  shaft and hole tables. `a b c` and `v`–`zc` remain capped at 500 mm (the standard
  does not tabulate them larger).
- **ISO 286 high-interference fit letters `v`–`zc` / `V`–`ZC`**: the fit functions
  (`iso286Shaft`/`iso286Hole`/`iso286Fit`) now cover the full ISO 286 letter set —
  shafts `v x y z za zb zc` (fundamental deviations transcribed from ISO 286-2:2010
  Tables 30–32) and the matching holes `V X Y Z ZA ZB ZC` (derived via the existing
  Δ rule). Every value is validated cell-by-cell against the standard's shaft and
  hole limit-deviation tables. `v` is undefined at or below 14 mm and `y` at or below
  18 mm, per the standard. This completes the ISO 286 letter coverage on both sides.
- **ISO 286 standard tolerance grades — full range**: `standardTolerance` now covers
  the complete ISO 286-2:2010 Table 1 — grades **IT01, IT0, IT1–IT18** for nominal
  sizes **up to 3150 mm** (previously IT5–IT16 up to 500 mm), transcribed in full and
  cross-checked against the standard (IT01/IT0 defined only to 500 mm, per the
  standard). The letter-based **fit** functions (`iso286Fit`/`iso286Hole`/
  `iso286Shaft`) remain scoped to IT5–IT16 and sizes up to 500 mm — where the
  fundamental-deviation data is transcribed — and now reject out-of-scope grades and
  sizes with clear messages.
- **Geometric construction helpers**: `circleThrough3Points` (the circumcircle /
  "arc through three points"), `tangentPointsFromPoint` (where tangents from an
  external point touch a circle), `perpendicularBisector`, and `perpendicularFoot`
  (orthogonal projection onto a line) — plus `circleCircleIntersection` completing
  the intersection family (line/segment/circle already covered). Exact, deterministic
  compass-and-straightedge primitives with the usual degenerate cases handled
  (collinear/coincident → `null`, point inside a circle → no tangent, etc.).
- **Detailed thread representation**: `threadDetailedSideView(p1, p2, { majorDiameter,
  minorDiameter, pitch, kind, hand? })` draws the realistic V-thread profile — a
  crest/root sawtooth along each edge (far edge offset half a pitch) with slanted
  crest/root helix lines — the third and most descriptive of ASME Y14.6's three
  conventions, completing the trio alongside `threadSideView` (simplified) and
  `threadSchematicSideView` (schematic). `hand` selects a right- or left-hand thread;
  shares `threadEndView` for the circular view.
- **Schematic thread representation**: `threadSchematicSideView(p1, p2, { majorDiameter,
  minorDiameter, pitch, kind })` draws the ASME Y14.6 schematic thread convention —
  staggered thin long crest lines and heavy short root lines at the pitch, inside the
  major-diameter outline — the middle form between the existing simplified
  `threadSideView` and a full detailed helix. Shares `threadEndView` for the circular
  view.
- **`Sheet.toDXF()`** — export a whole sheet to R12 DXF in one call, the DXF
  counterpart to `Sheet.toSVG()`. Walks the content tree (recursing `Layer`s and
  `View`s), emits the border on a `"BORDER"` layer, bakes a `View`'s
  scale/rotation/translation into its geometry, and explodes the title block. A
  native dimension inside a scaled/rotated view can't be a DXF `DIMENSION` entity,
  so it's reported via `options.onUnsupported` rather than emitted incorrectly.
  Entities are organized by type (`VISIBLE`/`DIMENSIONS`/`ANNOTATIONS`/`GDT`/
  `TITLEBLOCK`/`BORDER`, etc.); `Layer` names aren't mapped to DXF layers. Adds
  element-producing border helpers (`plainBorderElements`/`zonedBorderElements`)
  and `getElements()` accessors on `Layer`/`View`. This completes DXF export
  coverage — every part of a drawing can now round-trip to DXF.
- **View annotations, isometric & misc dimensions in DXF export**: `ViewLabel`,
  `ViewArrow`, `CuttingPlaneLine`, `IsometricText`, `IsometricLinearDimension`,
  `ArcLengthDimension`, and `JoggedRadiusDimension` are now `Explodable` and
  exported by `exportDXF` onto the `"ANNOTATIONS"` layer. This completes the set —
  every individual annotation is now DXF-exportable. Isometric/obliqued text
  explodes to upright DXF `TEXT` (DXF text can't be sheared onto a plane); the
  view/section annotations and misc dimensions derive `toSVG()` from the same
  element list (SVG unchanged, guarded with and without a view transform). The
  shared dimension-label renderer gained an element-producing form
  (`dimensionLabelElements`) backing the existing `renderDimensionLabel`.
- **Notes & data tables in DXF export**: `NotesBlock`, `FlagNote`, `GearDataTable`,
  and `HoleTable` are now `Explodable` and exported by `exportDXF` onto the
  `"ANNOTATIONS"` layer, each deriving `toSVG()` from the same element list (SVG
  unchanged).
- **Symbols & tags in DXF export**: the symbol/tag family — `SurfaceFinishSymbol`,
  `WeldSymbol`, `ItemBalloon`, `RevisionSymbol`, `HoleTag`, and `OrdinateOrigin` —
  is now `Explodable` and exported by `exportDXF` onto the `"ANNOTATIONS"` layer.
  Each class's `toSVG()` is derived from the same element list (SVG unchanged). A
  rotated `SurfaceFinishSymbol` keeps its matrix-rotated text in SVG but explodes
  to upright DXF `TEXT` at the rotated anchors (the library's `TextElement` has no
  glyph rotation), which reads correctly; at the default `rotationDeg: 0` the two
  paths are byte-identical.
- **Callouts & leaders in DXF export**: the callout/leader family — `Callout`,
  `ChamferCallout`, `HoleCallout`, `TaperCallout`, `MultiLeader`, and
  `DetailViewCallout` — is now `Explodable` and exported by `exportDXF` (bare)
  into `POLYLINE`/`TEXT` entities on an `"ANNOTATIONS"` layer. `exportDXF` now
  accepts **any** `Explodable` annotation on that layer, so future annotation
  types work automatically. The shared `Explodable.toElements(context?)` gained an
  optional render context, so a view transform is baked into the exported geometry
  identically to `toSVG` — and each class's `toSVG()` is derived from the same
  element list (SVG output unchanged, guarded by new equality tests). First step
  toward a whole-`Sheet`→DXF export.
- **Title blocks & tables in DXF export**: `exportDXF` now accepts a
  `{ titleBlock, context, layer?, colorIndex? }` input (for `TitleBlock`,
  `GridTitleBlock`, or `ISO7200TitleBlock` — the `context` being the same sheet
  width/margin/paper-size a `Sheet` supplies) and a bare `BOMTable`/`RevisionTable`,
  exploding each into real `POLYLINE`/`TEXT` entities on a `"TITLEBLOCK"` layer.
  The title-block classes gain a `renderElements(ctx)` method and the tables a
  `toElements()` method (added to the `TitleBlockLike` interface as an optional
  `renderElements?`); `render`/`toSVG` are now derived from those, keeping the SVG
  and DXF renderings in lockstep. This leaves only a whole-`Sheet`→DXF convenience
  (and the sheet border) unemitted; every drawing-frame piece can be exported
  individually.
- **GD&T frames in DXF export**: `exportDXF` now accepts GD&T annotations —
  `FeatureControlFrame`, `CompositeFeatureControlFrame`, `DatumFeatureSymbol`, and
  `DatumTargetSymbol` — bare or wrapped in a `{ gdt, layer?, colorIndex? }` for a
  layer/color override. Each is **exploded** into real `POLYLINE`/`TEXT` entities
  on a `"GDT"` layer (R12 has no native feature-control-frame entity), so frames
  are no longer dropped from DXF output. A new shared `Explodable` interface
  (`toElements(): (DrawingElement | TextElement)[]`) backs both the DXF explosion
  and each class's `toSVG()`, so the SVG and DXF renderings are guaranteed
  consistent. Only title blocks now remain SVG-only.
- **Freehand short-break line**: `freehandBreakLine(p1, p2, options)` draws the
  ASME Y14.3 thick wavy "short break" — the everyday break for small parts and
  partial sections — joining the existing `zigzagBreakLine` (long) and
  `cylindricalBreakLine` (round). Its wave is a deterministic, byte-stable
  undulation (a sine sampled and faired through `fitSpline`, ends anchored on
  `p1`/`p2`), drawn heavier than the visible outline by default; `amplitudeMM` /
  `wavelengthMM` tune the wave.

- **Non-circular datum target areas**: `datumTargetAreaOutline(boundary, options)`
  cross-hatches and phantom-outlines an arbitrary closed `Path` (ellipse, polygon,
  etc.), and `datumTargetRectangle(center, width, height, options)` is the
  rectangular convenience — joining the existing circular `datumTargetArea`.
  `DatumTargetSymbol` gains an `areaText` option so a non-circular target's
  dimensions (e.g. `"10X6"`) show in the symbol's upper half, alongside the
  circular `areaSize` (`⌀…`) form.

- **DXF export for radial, diameter, angular & ordinate dimensions**: `exportDXF`
  now emits `RadialDimension`, `DiameterDimension`, `AngularDimension`, and
  `OrdinateDimension` as native DXF `DIMENSION` entities (dimtypes 4, 3, 2, and 6
  — the ordinate with the X-datum bit 64 for `axis: "x"`), joining the existing
  linear dimension. Each references an anonymous picture block on the `DIMENSIONS`
  layer (the angular arc uses `ARC` entities), so the receiving CAD sees editable
  dimensions. Each class exposes a `dimensionDXF(): DimensionDXFData` describing
  its picture and definition points. GD&T frames and title blocks remain SVG-only.

- **Composite feature control frames & the statistical-tolerance symbol**:
  `CompositeFeatureControlFrame(anchor, characteristic, segments, options)` renders
  the ASME Y14.5 composite (two-tier) frame — one characteristic symbol shared
  across a tall cell, followed by two or more stacked tolerance-zone rows (the
  upper pattern-locating framework over lower feature-relating frameworks), each a
  `FrameSegment` with its own tolerance, modifiers, and datums. Compartment columns
  align across rows. Separately, `FeatureControlFrame` and each composite segment
  gain a `statistical` option that appends the boxed `ST` statistical-tolerance
  symbol after the tolerance value.

- **ISO 286 transition hole letters (J K M N)**: `iso286Hole` now covers the
  transition hole letters, completing the everyday letter set (only `v`–`zc`
  remain out of scope). `K M N` are derived from a grade-independent fundamental
  base by the Δ rule (`ES = −base + Δ`, Δ up to IT8), and `J` is the tabulated
  special case. The standard's special cases are handled: `N` has `ES = 0` for
  grades ≥ IT9 over 3 mm, `K` above IT8 is defined only for sizes ≤ 3 mm, and
  `J9` and coarser are symmetric (= `JS`). E.g. `iso286Hole(30, "N7")` →
  `-0.007/-0.028`, `iso286Hole(30, "K7")` → `+0.006/-0.015`. Every value is
  cross-checked cell-by-cell against ISO 286-2:2010 Tables 8 and 9.

- **ISO 286 hole letters (coarse/clearance A–H + interference P R S T U)**:
  `iso286Hole` now covers the coarse/clearance hole letters `A B C` (joining the
  existing `D E F G H`, `JS`) and the interference letters `P R S T U`. The
  interference holes are derived from the same-letter shaft deviations by
  ISO 286's Δ correction rule (ES = −ei + Δ, Δ = ITn − IT(n−1), applied up to
  IT7; Δ = 0 for coarser grades and the ≤3 mm range), e.g.
  `iso286Hole(30, "P7")` → `-0.014/-0.035`. Every value is cross-checked
  cell-by-cell against ISO 286-2:2010 Tables 2 and 10–13.

- **ISO 1302 surface-finish data positions**: `SurfaceFinishSymbol` now covers
  the full Figure 6 data-position grid. New options: `transmissionBand` prefixes
  the primary requirement (position a) in the standard's `{band}/{parameter}
  {value}` form (e.g. `"0.8"` + `roughnessText: "Ra 1.6"` → "0.8/Ra 1.6", or a
  band range "0.0025-0.8"); `secondRequirement` adds a second requirement one
  line below (position b, e.g. a waviness/Rz callout); and `machiningAllowance`
  (mm) renders to the left of the symbol (position e). These join the existing
  primary roughness (a), production-method `note` (c), and `lay` glyph (d).

- **ISO 1302 symbol rotation (clause 11.2.1 / Figure 16)**: `SurfaceFinishSymbol`
  gains a `rotationDeg` option to sit the symbol against a surface at any
  orientation (`0` top-facing, `90` left-facing, `180` bottom-facing, `270`
  right-facing). The graphic rotates rigidly about the vertex while the roughness
  value, note, and other complementary information are automatically re-oriented
  to stay readable from the bottom or the right-hand side of the drawing (per
  ISO 129-1) — never upside-down.

- **ISO 286 coarse & interference shaft fits**: `iso286Shaft`/`iso286Fit` now
  cover the coarse clearance letters `a b c` and the interference letters
  `p r s t u` (e.g. `iso286Fit(30, "H7", "s6")` → an interference fit), in
  addition to the existing `d–h / js / k / m / n`. The fundamental deviations are
  transcribed from ISO 286-2:2010 (Tables 17, 26–29), using the standard's finer
  size sub-ranges (e.g. 50–65/65–80, and the 18–24/24–30 split for `u`), and are
  cross-checked against the standard's own limit-deviation cells in the tests.

- **ISO 2768-1 Table 2**: `iso2768BrokenEdgeTolerance(nominalSizeMM, class)` looks
  up the general tolerance (± mm) for broken edges — external radii and chamfer
  heights — over the standard's three coarse size ranges (`f`=`m`, `c`=`v`),
  alongside the existing Table 1 (linear) and Table 3 (angular) lookups.

- **More GD&T modifiers**: `FeatureControlFrame` gains the free-state `Ⓕ`
  (`freeState`), tangent-plane `Ⓣ` (`tangentPlane`), and unequally-disposed-profile
  `Ⓤ` (`unequallyDisposed` / `unequallyDisposedValue` → `0.4 Ⓤ 0.1`) modifiers,
  rendered as trailing circled letters in the tolerance compartment alongside the
  existing material-condition and projected-zone symbols.

- **Isometric dimensioning**: `IsometricLinearDimension(p1, p2, { plane, offset,
  ... })` dimensions an edge on a pictorial face — endpoints in the face's 2D
  coordinates, the true in-plane length formatted with the usual
  unit/zero-suppression/tolerance/count options, and the whole dimension
  (extension lines, dimension line, flat arrowheads, and the value lettered via
  `IsometricText`) lying in the plane. Completes the isometric/pictorial set
  (SVG/PDF; a native DXF `DIMENSION` can't represent an isometric view).

- **Isometric on-face text**: `IsometricText(position, content, { plane, ... })`
  letters text onto a pictorial face — shearing the glyphs into the plane via an
  SVG matrix (choosing non-mirrored per-face axes, or explicit `right`/`up`
  vectors). It renders in PDF as well: the PDF text pipeline now supports a full
  text matrix (`Tm`), not just a translation, and `parseSvg`'s `TextNode` gained
  an optional `matrix` (upright text is unchanged).

- **Isometric circles & boxes**: `isometricCircle(plane, centerOnPlane, radius)`
  draws a circle on a pictorial face as its isometric ellipse (hole/cylinder end);
  `isometricEllipseAxes(plane, radius)` exposes the ellipse's semi-axes and
  rotation, derived exactly from the projection (√3 major:minor ratio; major
  horizontal on `top`, ∓60° on the walls). `isometricBox(size, { origin? })`
  returns the visible edges of a rectangular prism as `Path[]`.

- **Isometric projection (foundation)**: `isometricProjection({ x, y, z })` maps a
  3D model point to the 2D drawing plane in standard 30° isometric (`+X`
  right-down, `+Y` left-down, `+Z` up; unit axis vectors stay unit length).
  `projectIsoPlane("top" | "left" | "right", p)` lays a flat 2D point on a
  pictorial face, `isoPolyline(points3d)` projects a polyline, and
  `isometricAxisDirections()` returns the three axis unit vectors. First of a
  multi-part isometric/pictorial effort — circles (ellipses), boxes, and
  dimensioning build on this.

- **Dimension-line breaks at crossings (DIMBREAK)**: new geometry primitive
  `breakSegmentAtCrossings(a, b, obstacles, gapMM)` splits a segment into the
  pieces left after gapping around each point where it crosses an obstacle
  (segment or circle), merging overlapping gaps. `LinearDimension` gains a
  `breakAt` option (plus `breakGapMM`, default 1.5) that applies it to the
  dimension's extension and dimension lines, mapped through any active view
  transform; SVG only (the native DXF `DIMENSION` is unaffected).

- **Taper & slope callouts (ISO 3040)**: `TaperCallout(feature, { angleDeg, kind,
  ratio, symbolDirection? })` is an elbow-leader callout carrying the conical
  taper (`kind: "cone"`) or flat slope (`"slope"`) symbol plus a ratio (e.g.
  `⌲ 1:20`). The symbols are drawn geometry with a meaningful apex direction
  (toward the small/thin end) and are also exposed standalone as
  `conicalTaperSymbol(center, size, …)` (open isosceles triangle) and
  `slopeSymbol(center, size, …)` (open right triangle).

- **Projected tolerance zone (Ⓟ)**: `FeatureControlFrame` gains `projectedZone`
  (adds the circled `Ⓟ` after the tolerance and any material modifier, ASME
  Y14.5 §10.3.4) and `projectedHeight` (renders the minimum height after `Ⓟ`,
  e.g. `⌀0.14 Ⓜ Ⓟ 25`; implies `projectedZone`). The tolerance compartment's
  layout was generalized to a token sequence — existing frames render
  byte-identically.

- **Hole-callout spotface & depth symbol**: `HoleCallout` gains `spotface`
  (`⌴⌀12.00 SF` — ASME reuses the counterbore symbol with an `SF` suffix, with an
  optional depth) and `depthStyle: "word" | "symbol"`. `"word"` (default,
  unchanged) writes `X {d} DEEP`; `"symbol"` switches every depth in the callout
  to the ASME `↧` symbol (`⌀8.00 ↧5.00`, U+21A7), which substitutes to `DEEP` in
  non-embedded PDF. The standalone drawn `depthSymbol` glyph is unchanged.

- **View titles & viewing-direction arrows**: `ViewLabel(position, title, {
  scale?, underline?, ... })` renders the bold view caption the section/detail
  markers deliberately don't draw — `"SECTION A-A"`, `"VIEW A"`, `"DETAIL B"`
  (caller owns the wording) — with an optional smaller `"SCALE 2:1"` line and
  optional underline. `ViewArrow(tail, { angleDeg, label, ... })` is the ISO
  128-30 arrow (viewing-direction) method indicator: a thick arrow in the sight
  direction with a bold letter at its tail, for auxiliary/other views. Both map
  through any active `View` transform while staying paper-size.

- **Ordinate origin indicator**: `OrdinateOrigin(origin, { diameterMM?,
  strokeWidthMM?, color? })` draws the ASME Y14.5 §10.3 / ISO 129 origin symbol —
  the small open circle marking the datum that rectangular-coordinate (ordinate)
  dimensions read from. Paper-size (its position maps through a `View` transform,
  its ~3mm diameter does not scale), with `bounds()`. Pairs with
  `ordinateDimensions`.

- **Spherical & square feature prefixes**: `RadialDimension`/`DiameterDimension`
  take `spherical` (ASME Y14.5 §3.3.6 — `SR`/`S⌀`), and `LinearDimension` takes
  `square` (§3.3.7 — a `□` prefix for a square cross-section). Repetition count
  and dual `[in]` display compose with both; in non-embedded PDF the `□` prefix is
  substituted `SQ ` (like `⌀`→`Ø`).

- **Repetition count & "typical" on dimensions**: every dimension class (and
  native DXF `DIMENSION` text) now takes `count` — the ASME Y14.5 §1.9.5
  repetition prefix, `count: 4` → `"4X ⌀5.00"`, sitting outside any reference
  parentheses — and `typical`, appending `" TYP"`. Applied in the shared
  `formatToleranceText`, so all classes pick them up at once. `HoleCallout` gains
  its own `count` too (`"4X ⌀5.00 THRU"`).

- **Multi-line & word-wrapped text**: `TextElement` now renders content with hard
  `\n` breaks — and, with the new `options.maxWidthMM`, greedily word-wraps to a
  column (measured with the same AFM metrics as `bounds`). Lines stack downward
  from the element's position by `options.lineHeightMM` (default `size × 1.2`) in
  paper units. `TextElement.lines()` exposes the resolved display lines; `bounds()`
  boxes the whole block. Every text sink follows: SVG emits one `<text>` per line,
  PDF export draws each line, and DXF export emits one `TEXT` entity per line (R12
  `TEXT` is single-line; `MTEXT` is R13+). Control characters other than `\n` are
  still stripped on DXF export.

- **DXF block export**: `exportDXF` now accepts `BlockInstance` inputs, emitting a
  reusable symbol as a shared `BLOCK` definition plus an `INSERT` per placement —
  each distinct `Block` written once (its `DrawingElement`/`TextElement` children
  at the block's local origin, on layer `0`) with every placement an `INSERT`
  carrying position, uniform scale, and rotation, so repeated symbols stay
  references rather than duplicated geometry. Blocks sharing a name are
  disambiguated (`SYM`, `SYM_2`); unnamed blocks get `BLOCK1`, `BLOCK2`, …
  `BlockInstance.placement()` (returning the new `BlockPlacement`) exposes what
  the exporter reads.

- **Section fill generation**: `sectionView(boundary, { cut?, angleDeg?,
  spacingMM?, outline?, color? })` turns a material cross-section into a section
  view's fill — section-lining (hatching) the region with holes left open via the
  even-odd rule, and returning `{ region, hatch, outline }`. With a `cut` plane
  (`{ p1, p2, keep }`) it first clips the region to the kept side by intersecting
  each boundary ring with a half-plane (the polygon-boolean clipper). Composes the
  existing boolean + `hatch()` machinery; a 2D fill generator over the supplied
  outline, not a 3D-model section. Pairs with `CuttingPlaneLine` (the marker).

- **Geometry introspection & fit-to-view.** `Renderable` gains an optional
  `bounds(context?): BoundingBox | null`, implemented by the geometry/text
  primitives and the containers (`Layer`, `View`, `BlockInstance`) — each mapping
  through any active view transform. `boundsOf(renderables, context?)` unions the
  measurable ones (skipping annotation classes that don't expose geometry).
  `Sheet.contentBounds()` boxes all added content; `View.contentBounds()` gives
  the children's true model-space extent. `fitView(contentBoundsMM, area, {
  marginMM?, maxScale? })` builds a `View` that scales (aspect preserved) and
  centers content into a target rectangle (e.g. a sheet's `drawingArea`).

- **Fractional & architectural inch units, and DMS angles.** Inch drawings gain
  an `inchDisplay` option on `DimensionStyle` — `"decimal"` (default),
  `"fractional"` (`3/8`, `1 1/2`), or `"architectural"` (`3'-6 1/2"`) — with
  `fractionDenominator` (a power of two, default 16) setting the resolution;
  tolerances render in the same style. `AngularDimension` gains `angleFormat:
  "dms"` for degrees-minutes-seconds (`30°30′`). New standalone formatters:
  `formatFractionalInches`, `formatArchitecturalInches`, and `formatAngleDMS`.
  This makes the ARCH paper sizes usable for architectural/woodworking drawings.

- **Spring representation**: `compressionSpring(p1, p2, { diameterMM, coils?,
  rails? })` draws the conventional simplified side view of a helical compression
  spring — a zigzag along the `p1`→`p2` axis touching the outer-diameter envelope
  (ISO 2162 single-line schematic), optionally with the two envelope rails. Works
  at any orientation.

- **Gear representation + data table**: `gearGeometry(spec)` resolves a spur
  gear's pitch/outside/root/base diameters from `teeth` and a `module` (or
  `diametralPitch`). `gearCircles(center, spec)` draws the simplified end-view
  representation (solid outside circle, dash-dot pitch circle, thin root circle;
  no teeth), per ASME Y14.7.1 / ISO 2203. `GearDataTable(anchor, spec, options?)`
  renders the accompanying cutting-data block (teeth, module/DP, pressure angle,
  diameters, plus optional `title`/`extraRows`) on the `BOMTable` grid primitives.

- **Reusable symbols (blocks)**: `new Block(name?)` defines a set of renderables
  once in local coordinates; `block.instance({ position?, scale?, rotationDeg? })`
  stamps a placeable copy onto a `Sheet`/`Layer`/`View` — the CAD block/symbol
  concept. A placed block applies the same annotative view transform as `View`
  (geometry scales/rotates, text stays upright), and its transform **composes**
  with an enclosing `View`'s (via the new `composeViewTransforms` helper) rather
  than replacing it. Instances emit no wrapper group, so they flow through PDF
  export unchanged.

- **Knurl representation**: `knurl(boundary, { pattern, angleDeg?, spacingMM? })`
  fills a region with a `"diamond"` (crossed) or `"straight"` knurl texture,
  built on the `hatch()` scanline machinery (clips to the boundary, honors
  even-odd holes, returns `DrawingElement`s per line). `knurlNote(pitch,
  pattern?)` returns the conventional callout string, e.g. `"0.8 DIAMOND KNURL"`.

- **Fit spline through points**: `fitSpline(points, { closed?, tension? })`
  returns a smooth `Path` that interpolates (passes through) every given point —
  a Catmull-Rom spline emitted as native cubic Béziers, so it serializes to SVG
  `C` / native PDF beziers, tessellates for DXF, and has an exact bounding box
  like any other path. `tension` (0–1) trades roundness for tautness (1 =
  straight chords); `closed` makes a seamless loop.

- **Weld-symbol completeness**: `WeldSymbol`'s `WeldType` gains the rest of the
  groove family — `"u-groove"`, `"j-groove"`, `"flare-v-groove"`,
  `"flare-bevel-groove"` — plus `"plug-slot"` and `"surfacing"`. Each `WeldSpec`
  also takes a `contour` finish (`"flush"`/`"convex"`/`"concave"`), drawn as the
  AWS A2.4 supplementary symbol across the weld's outer edge. (Resistance welds
  and staggered reference lines remain out of scope.)

- **View rotation (auxiliary / rotated views)**: `View` gains a `rotationDeg`
  option that turns the view's geometry about `modelOrigin`, on top of the
  existing scale — for auxiliary and rotated detail/section views. It stays
  annotative: geometry rotates, but text height/arrowheads/line weights remain
  paper-size and **text stays upright** (never turned), and dimensions still
  report the true model value. `ViewTransform` gains an optional `rotation`
  (radians), applied by `applyViewTransform` and `Path.transformed`; `toPaper`/
  `toModel` account for it. An unrotated view is byte-identical to before.

- **Surface-texture lay symbols**: `SurfaceFinishSymbol` gains a `lay` option
  that draws the ISO 1302 / ASME Y14.36 direction-of-lay glyph at the lay
  position — `"parallel"` (`=`), `"perpendicular"` (`⊥`), `"angular"` (`X`),
  `"multidirectional"` (`M`), `"circular"` (`C`), `"radial"` (`R`), or
  `"particulate"` (`P`).

- **Dual dimensioning (mm [in])**: a new `dualUnit` on `DimensionStyle` also
  shows the value converted into a second unit, bracketed after the primary —
  `50.00 [1.969]` (ASME Y14.5 §2.4). Any tolerance is converted into the second
  unit too (`50.00 ±0.50 [1.969 ±.020]`) and prefixes repeat inside the bracket
  (`⌀25.40 [⌀1.000]`). `dualPrecision`/`dualZeroHandling` tune the secondary.
  Honored by `LinearDimension` (and the `chainDimension`/`baselineDimension`
  stacks) and `RadialDimension`/`DiameterDimension`; settable document-wide via
  `dimensionDefaults`. Exposed as `dualSecondary`/`appendDual`/`resolveDualFormat`
  for custom annotations.

- **Centerlines**: `axisCenterline(p1, p2, { overshootMM?, symmetryTicks? })`
  draws the long-dash-short-dash axis of a shaft/cylinder (or a plane of
  symmetry), extended past each end; `symmetryTicks` adds the paired
  symmetry-line strokes at each end (ASME Y14.2). `boltCircleCenterline(center,
  radius, { holeCenters?, overshootMM?, holeMarkRadiusMM? })` — the companion to
  `boltCircle()` — draws the dash-dot bolt circle, a center cross through the
  pattern, and a small centerline cross at each hole. Both return
  `DrawingElement`s carrying the `"centerline"` line style (color/width
  overridable).

- **Thread designation lookup + hex fastener symbols**: `lookupThread(designation)`
  resolves a standard thread callout — Unified inch (`"1/4-20 UNC"`, `"#10-24"`,
  `"10-32 UNF"`) and ISO metric (`"M6"`, `"M6×1"`, `"M8x1 fine"`) — into major /
  minor / pitch diameters, pitch, threads-per-inch (inch only), and a
  ~75%-thread tap-drill size, all in mm (backed by ASME B1.1 / ISO 261 series
  tables and the 60° formulas). The minor diameter feeds `threadSideView`/
  `threadEndView` directly. `hexHead(center, acrossFlatsMM)` and
  `hexNut(center, acrossFlatsMM, boreDiameterMM)` draw top-view hex symbols
  (hexagon + inscribed chamfer circle, nut adds a bore), and
  `hexAcrossFlatsMM(designation)` gives the standard ASME B18.2 / ISO 4014 width
  across flats so a symbol sizes itself from the designation.

- **Arc-length, jogged-radius, and multileader annotations**:
  `ArcLengthDimension(center, radius, startAngleDeg, endAngleDeg, { offset, ... })`
  dimensions the length along an arc (ASME Y14.5) — radial extension lines to a
  concentric dimension arc, tangent arrowheads, and a `⌒`-prefixed
  true-arc-length value that honors the display unit and scales inside a `View`.
  `JoggedRadiusDimension(arcPoint, falseCenter, radius, { jogSizeMM?, jogPosition? })`
  is the ASME §5.9.4 foreshortened radius for an arc whose true center is off the
  sheet — a zigzag jog to a false center, labeling the real `R…`.
  `MultiLeader(targets, note, { landing, shoulderSign? })` ties one note to
  several features via leaders converging on a shared landing (stacked-line notes
  supported; arrowheads optional).

- **Hole tables (hole charts)**: `HoleTable(anchor, entries, options)` renders a
  grid of holes — one row per hole with any of `tag`/`x`/`y`/`size`/`quantity`/
  `description`, columns chosen via `columns` and headers overridable via
  `columnLabels`. Numeric columns honor the shared `DimensionStyle`
  `unit`/`precision`/`zeroHandling` (so `unit: "in"` flips the table to
  decimal-inch), and `size` shows a leading `⌀` unless `diameterSymbol` is off.
  `HoleTag(center, tag, options)` places the matching label on the view (circled
  by default), accepting a bare tag or a whole `HoleTableEntry` so one data set
  drives both the chart and its on-drawing keys — the companion to
  `OrdinateDimension`. Built on the same grid primitives as `BOMTable`.

- **Cubic Bézier path segments**: `Path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y)`
  adds free-form cubic curves alongside lines and arcs. Serialized to SVG's `C`
  command, rendered as a **native** PDF bezier (`c` operator, no polyline
  approximation), and tessellated for DXF (which has no R12 spline). `boundingBox`
  is exact — solved from the curve's derivative roots rather than the control
  hull — and `transformed`/`flatten` handle beziers throughout.

- **Boolean region operations**: `polygonUnion`, `polygonIntersection`, and
  `polygonDifference(subject, clip)` clip two polygons (rings of `Point`s) via the
  Greiner–Hormann algorithm, returning zero or more result rings; a difference
  with a fully-contained clip yields the outer ring plus a reversed-winding hole
  ring (rendered correctly by `hatch()`'s even-odd fill). `polygonArea` returns a
  ring's signed area. Scoped to simple polygons in general position.

- **Native DXF `DIMENSION` entities**: `exportDXF` now accepts `LinearDimension`s
  and emits real `DIMENSION` entities (not exploded lines/text) — a `DIMSTYLE`
  table, a `BLOCKS` section with one anonymous block per dimension holding its
  picture (extension/dimension lines, `SOLID` arrowheads, value `TEXT`), and the
  `DIMENSION` referencing that block, on a `DIMENSIONS` layer. Validated against
  `dxf-parser`. Only `LinearDimension` is native so far; `MTEXT` is not used (it's
  an R13+ entity and the writer targets R12).

- **DXF import**: `importDXF(dxfString)` — the inverse of `exportDXF`, reading a
  DXF's `ENTITIES` back into `{ elements: DrawingElement[], texts:
  TextElement[] }`. Handles `LINE`/`CIRCLE`/`ARC`/`LWPOLYLINE`/`POLYLINE`
  (arcs recovered exactly from per-vertex bulges) and `TEXT`, recovering
  `lineStyle` from layer names; unsupported entity types are skipped. The
  round-trip is idempotent (`exportDXF(importDXF(exportDXF(x)))` is byte-stable).

- **Scaled views (model space / paper space)**: `new View({ scale, modelOrigin?,
  paperOrigin? })` draws children authored in true model coordinates at a scale,
  *annotatively* — geometry scales, but text/arrow/line-weight sizes stay in
  paper units and dimensions report the true model value. Implemented via a
  render-time `transform` on `RenderContext` (reaches geometry, text, the
  dimension classes, and elbow-leader callouts, and flows into PDF export).
  Adds `view.toPaper`/`toModel` and a `formatScaleRatio` helper.

- **PDF embedded fonts**: `exportPDF(sheet, { font: { data } })` embeds a
  caller-supplied TrueType font and renders all text in it, unlocking arbitrary
  Unicode (the library's own `⌀`/`⌴`/`⌵` render as themselves instead of ASCII
  substitutions). Embedded as a composite Type0/Identity-H font (CIDFontType2,
  `CIDToGIDMap /Identity`) with a `/ToUnicode` map; the font is hex-encoded
  (`ASCIIHexDecode` `FontFile2`) so output stays plain-ASCII, deterministic,
  zlib-free, and ships no bundled font. `glyf`-based `.ttf` only (not CFF/OTTO);
  not subsetted; weight not synthesized.

- **DXF text entities**: `exportDXF` now accepts `TextElement`s (and
  `{ text, layer?, colorIndex? }` wrappers) alongside geometry, emitting DXF
  `TEXT` entities with height and horizontal/vertical justification, a default
  `"TEXT"` layer, and a `STYLE`/`STANDARD` table. Dimensions/GD&T/title blocks
  remain SVG-only.

- **True elliptical-arc path segments**: `Path.ellipticalArc(...)` and a new
  `EllipticalArcSegment` (independent `rx`/`ry` + rotation, center
  parameterization) — serialized to SVG's full `A rx ry rotation …` command,
  converted to exact bezier curves in PDF (standard endpoint-to-center
  recovery), and tessellated for R12 DXF. `ellipse()` now emits two exact
  elliptical half-arcs by default (pass `{ segments }` for the old tessellated
  polyline), and `ellipticalArc(cx, cy, rx, ry, startDeg, endDeg, …)` draws an
  open partial arc.

- **Geometry construction toolkit**: helpers for computing a layout rather than
  hand-placing coordinates. Intersections (`lineIntersection`,
  `segmentIntersection`, `lineCircleIntersection`, `segmentCircleIntersection`);
  fillets (`filletCorner` tangent-arc primitive, `roundedPolyline` for a whole
  outline); `offsetPolyline` (signed miter offset); `ellipse()` (tessellated
  closed `Path`); and pattern layouts (`boltCircle`, `linearPattern`,
  `rectangularPattern`).
- **Inch dimension display & ASME Y14.5 zero suppression**: every
  dimension/leader class now accepts `unit` (`"mm"`/`"in"`) and `zeroHandling`
  (`"none"`/`"inch"`/`"metric"`) via the shared `DimensionStyle`. `unit: "in"`
  converts the measured millimeter value to a decimal-inch value for the label
  only, defaulting to 3-place precision and the ASME Y14.5 §2.3.2 inch
  leading-zero-suppression convention (`.250`, not `0.250`); `"metric"` applies
  the opposite (strict millimeter) rule (`0.5`, `12.5`, `24`). Wired through
  `LinearDimension`, `RadialDimension`/`DiameterDimension`, and `HoleCallout`
  (`AngularDimension` is unaffected — its values are degrees). The underlying
  helpers `formatMeasurement`, `formatValue`, `applyZeroHandling`, and
  `resolveMeasurementFormat` are exported for custom annotations.
- **`inchToleranceBlock()`**: builds the US decimal-inch block-tolerance
  title-block note (`.X`/`.XX`/`.XXX ± …, ANGLES ± …`), the inch counterpart to
  `iso2768Note()`; returns a `string[]` for `TitleBlockFields.generalTolerance`.
- **Ordinate (arrowless) dimensioning**: `OrdinateDimension(origin, feature,
  { axis, offset, jog? })` and the `ordinateDimensions(origin, features,
  options)` group helper — ASME Y14.5 rectangular-coordinate dimensioning
  without dimension lines, every feature measured from a common datum origin.
- **Chamfer callouts**: `ChamferCallout(chamferPoint, { angleDeg, size,
  chamferAngleDeg?, order? })` — an elbow-leader chamfer note (`2 X 45°`,
  `45° X 2`, or the ISO `C2` shorthand), leg length in the display unit.
- **General notes block**: `NotesBlock(anchor, notes, options)` renders a
  numbered `NOTES:` list (bold heading, hanging-indent word wrap, `heightMM`
  layout), and `FlagNote(center, number, { shape? })` the numbered
  triangle/pentagon/hexagon flag that ties a feature to a note.
- **ISO 286 limits & fits**: `iso286Fit(size, "H7", "g6")`, `iso286Hole`,
  `iso286Shaft`, and `standardTolerance` compute IT-grade widths and hole/shaft
  limit deviations (with min/max clearance and a clearance/transition/
  interference classification) from a fit designation. Sizes 0–500mm, grades
  IT5–IT16, shaft letters `d e f g h js k m n`, hole letters `D E F G H`.
- **Document-wide dimension defaults**: `Sheet` accepts `dimensionDefaults`, a
  `DimensionStyle` merged under every dimension/leader element's own options at
  render time (options still win), so a whole sheet can be set to inches (or a
  shared text/arrow/color style) in one place. Ships `ASME_INCH`, `ASME_METRIC`,
  and `ISO_METRIC` presets. Defaults propagate through `Layer`s and into PDF
  export; `AngularDimension` ignores an inherited display unit (its values are
  degrees). The merge is exposed as `mergeDimensionDefaults(options, defaults)`,
  and a render-time `RenderContext` is threaded through `Renderable.toSVG`.

### Changed

- **DXF text export**: a `TextElement` whose content contains `\n` now exports as
  one `TEXT` entity per line (a hard line break), where it was previously
  collapsed to spaces on a single line.
- **Accurate text metrics.** `estimateTextWidth` now uses the real Adobe AFM
  per-glyph advance widths (the same `fontMetrics` table the PDF exporter uses,
  moved to `svg/fontMetrics.ts` and shared) instead of a flat `0.65 em/char`
  guess. This sizes dimension-line gaps and the boxes around GD&T frames, basic
  dimensions, and datum-target circles to the text they actually contain —
  digit-heavy values are no longer over-padded and wide glyphs (M/W) no longer
  clip. It gains an optional `bold` argument (Helvetica-Bold metrics). SVG
  coordinates around text shift slightly as a result (regression snapshots
  updated); the duplicate width heuristic in `featureControlFrame` was removed.
- **Docs restructure**: the README's exhaustive per-feature reference moved into a
  new `FEATURES.md` (also shipped in the package) — grouped under category
  headings (Fundamentals, Geometry, Sheets & layout, Dimensioning, GD&T,
  Annotation & symbols, Export) that mirror the README's new feature overview,
  leaving the README with a concise design-principles section and a categorized
  overview that links out. The `Known gaps` list was corrected to match the
  current feature set.
- `formatToleranceText`, `formatLimits`, and `renderDimensionLabel` now accept a
  resolved measurement format in place of a bare `precision` number. The number
  form still works (millimeter, no zero suppression), so existing callers and
  output are unchanged.
- `Renderable.toSVG` now accepts an optional `RenderContext` argument (used to
  deliver `dimensionDefaults`). Existing zero-argument `toSVG()` implementations
  remain valid, and rendering without a context is byte-for-byte unchanged.

### Fixed

- **ISO 286 shaft `a` size range**: the shaft coarse letter `a` now extends over
  the full 0–500 mm range (ISO 286-2:2010 Table 17); it was previously truncated
  at 250 mm. `b` and `c` already covered the full range.
- **`exportPDF` on a `Sheet` containing a `View`** no longer throws
  `parseSvg: unrecognized element <g …>`. The PDF exporter's SVG parser now
  recognizes the `<g class="view">` wrapper, rendering the view's (already
  transform-baked) children inline — with no optional-content group, since a
  view is not a togglable layer. Detail/section views now export to PDF as they
  already did to SVG.
- **No more `-0.00` display.** `formatFixed` (and everything built on it —
  dimension values, tolerance limits, ordinate readouts) now drops the sign for
  a value that *rounds* to zero at its precision, so a feature just below an
  axis/origin reads `0.00`, not `-0.00`. Genuinely negative values keep their
  sign.
- **`AngularDimension` rejects degenerate rays.** Two parallel rays (subtending
  0°/360°) previously drew a silent full-circle arc, and a point coincident with
  the vertex threw the cryptic "Cannot normalize a zero-length vector"; both now
  throw a clear, specific error.
- **`roundedPolyline` no longer throws on a duplicated consecutive point.** A
  zero-length leg is left sharp (as the per-corner degenerate-skip already
  intended) instead of failing inside `normalize()`.
- **Docs:** clarified that `importDXF` round-trips geometry and text only —
  native `DIMENSION` entities written by `exportDXF` are export-only and are not
  re-imported.

## [0.1.1] - 2026-07-11

### Added

- **`llms.txt`**: a dense, one-line-per-export API index (plus worked
  examples) sized for an AI coding agent's context window, shipped in the
  published package at `node_modules/@invisra/draft/llms.txt`.

### Changed

- Packaging/version maintenance — no changes to the public API.

## [0.1.0] - 2026-07-09

Initial release.

### Added

- **Core geometry & SVG rendering**: a Canvas2D-style `Path` builder (line/arc
  segments, CAD-form arcs), physical-unit (mm) Y-up coordinate system,
  `DrawingElement`/`TextElement`/`Layer` primitives, line styles (visible,
  hidden, centerline, phantom) per ASME Y14.2 / ISO 128.
- **Sheets & paper sizes**: `Sheet` with plain/zoned borders, ANSI A–E, ISO
  216 A0–A5, US architectural ARCH sizes, and `customPaperSize()`.
- **Title blocks**: the classic ASME corner-block `TitleBlock`, `GridTitleBlock`
  (generic grid system), `ISO7200TitleBlock`, the ISO 128 / ASME Y14.3
  projection-angle symbol, `RevisionTable`, and `BOMTable` (parts list).
- **Multi-sheet sets**: `DrawingSet` for "N OF M" sheet numbering.
- **Dimensioning**: `LinearDimension`, `RadialDimension`, `DiameterDimension`,
  `AngularDimension`; `chainDimension`/`baselineDimension` and their angular
  equivalents; symmetric/asymmetric tolerances, stacked limits, ASME Y14.5
  basic (boxed) and reference (parenthesized) dimensions; `Callout` and
  `HoleCallout` (with counterbore/countersink/depth).
- **GD&T**: all 14 ASME Y14.5 characteristic symbols, `FeatureControlFrame`,
  `DatumFeatureSymbol`, and `DatumTargetSymbol` (plus point/line/area target
  markers).
- **Surface finish & threads**: `SurfaceFinishSymbol` (ISO 1302 / ASME Y14.36),
  and ASME Y14.6 simplified thread representation (`threadSideView`,
  `threadEndView`).
- **Weld symbols**: `WeldSymbol` (AWS A2.4) — fillet, square/V/bevel groove,
  weld-all-around, field weld, tailed notes.
- **Hatching**: `hatch()` and the ANSI31–ANSI38 material-symbol patterns
  (`hatchPattern()`, converted from AutoCAD's `acad.pat`).
- **Section & detail views**: `CuttingPlaneLine`, `DetailViewCallout`, and
  conventional break lines (`zigzagBreakLine`, `cylindricalBreakLine`).
- **Revision clouds**: `revisionCloud()` (scalloped outward-arc boundary) and
  `RevisionSymbol` (circled per ASME Y14.35, or the common triangular
  "delta" alternative), paired with `RevisionTable`.
- **ISO 2768 general tolerances**: lookup functions for the ISO 2768-1
  linear/angular tolerance tables (f/m/c/v) and the ISO 2768-2 geometric
  tolerance tables (H/K/L — straightness/flatness, perpendicularity,
  symmetry, circular run-out), plus `iso2768Note()` for the standard's
  title-block citation string (e.g. `"ISO 2768-mK"`).
- **Assembly drawings**: `ItemBalloon` (dot/arrow leader terminus) alongside
  `BOMTable`.
- **Export**: `exportDXF()` (geometry + layers, R12/AC1009) and `exportPDF()`
  (the whole rendered sheet, including Optional Content Groups for `Layer`
  visibility).
- **Testing**: an automated SVG/DXF/PDF text-snapshot regression suite
  (`test/regression.test.ts`), alongside per-feature unit tests.
- **API documentation**: a generated static reference site (`npm run docs`,
  via [TypeDoc](https://typedoc.org/)) built from TSDoc comments on every
  exported class, function, interface, and type; CI fails on any
  undocumented public export.
