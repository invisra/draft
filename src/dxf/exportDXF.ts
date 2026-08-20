import { LinearDimension, type LinearDimensionDXFData } from "../dimension/linearDimension.js";
import { RadialDimension, DiameterDimension } from "../dimension/radialDimension.js";
import { AngularDimension } from "../dimension/angularDimension.js";
import { OrdinateDimension } from "../dimension/ordinateDimension.js";
import type { DimensionDXFData } from "../dimension/dxfData.js";
import { DEFAULT_DIMENSION_STYLE } from "../dimension/style.js";
import { addPoints, perpendicular, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import { BlockInstance, type Block } from "../svg/block.js";
import { LINE_STYLES, type LineStyleName } from "../svg/lineStyles.js";
import { TextElement } from "../svg/text.js";
import { applyViewTransform, isExplodable, type DxfPrimitive, type Explodable, type Renderable, type ViewTransform } from "../svg/renderable.js";
import type { DimensionPicture } from "../dimension/dxfData.js";
import { CompositeFeatureControlFrame, FeatureControlFrame, MultipleSingleSegmentFrame } from "../gdt/featureControlFrame.js";
import { DatumFeatureSymbol } from "../gdt/datumFeatureSymbol.js";
import { DatumTargetSymbol } from "../gdt/datumTarget.js";
import { BOMTable } from "../titleblock/bomTable.js";
import { RevisionTable } from "../titleblock/revisionTable.js";
import type { TitleBlockLike, TitleBlockRenderContext } from "../titleblock/titleBlock.js";
import { pathToPolyline } from "./polylineConversion.js";

/** A `DrawingElement` plus explicit DXF layer/linetype/color overrides, for {@link exportDXF}. */
export interface DXFElementInput {
  /** The geometry to export. */
  element: DrawingElement;
  /** Overrides the layer normally inferred from the element's lineStyle (defaults to "VISIBLE"). */
  layer?: string;
  /** Only meaningful together with `layer`; a recognized lineStyle already implies its own linetype. */
  linetype?: "CONTINUOUS" | "HIDDEN" | "CENTER" | "PHANTOM";
  /** AutoCAD Color Index. Defaults to the color implied by the element's lineStyle (or 7/white-black if `layer` is overridden without one). */
  colorIndex?: number;
}

/** A `TextElement` plus explicit DXF layer/color overrides, for {@link exportDXF}. */
export interface DXFTextInput {
  /** The text to export as a DXF `TEXT` entity. */
  text: TextElement;
  /** Layer to place the text on. Defaults to `"TEXT"`. */
  layer?: string;
  /** AutoCAD Color Index. Defaults to 7 (foreground); the `TextElement`'s CSS `color` is not mapped to an ACI. */
  colorIndex?: number;
}

/** A compound GD&T annotation that exports by exploding into `POLYLINE`/`TEXT` on a `GDT` layer. */
export type GDTFrame = FeatureControlFrame | CompositeFeatureControlFrame | MultipleSingleSegmentFrame | DatumFeatureSymbol | DatumTargetSymbol;

/** A {@link TitleBlockLike} plus the render context it needs and optional layer/color overrides, for {@link exportDXF}. */
export interface DXFTitleBlockInput {
  /** The title block to explode into DXF geometry/text (must implement `renderElements`). */
  titleBlock: TitleBlockLike;
  /** The same sheet context `Sheet` would pass — its width/margin position the block at the sheet's bottom-right. */
  context: TitleBlockRenderContext;
  /** Layer for the exploded geometry/text. Defaults to `"TITLEBLOCK"`. */
  layer?: string;
  /** AutoCAD Color Index applied to every exploded piece. Defaults to 7 (foreground). */
  colorIndex?: number;
}

/** A {@link GDTFrame} plus explicit DXF layer/color overrides, for {@link exportDXF}. */
export interface DXFGdtInput {
  /** The GD&T annotation to explode into DXF geometry/text. */
  gdt: GDTFrame;
  /** Layer for the exploded geometry/text. Defaults to `"GDT"`. */
  layer?: string;
  /** AutoCAD Color Index applied to every exploded piece. Defaults to 7 (foreground). */
  colorIndex?: number;
}

/** Every {@link exportDXF} input except the compound GD&T ones — each resolves to a single DXF entity group. */
export type DXFPrimitiveInput =
  | DrawingElement
  | DXFElementInput
  | TextElement
  | DXFTextInput
  | LinearDimension
  | RadialDimension
  | DiameterDimension
  | AngularDimension
  | OrdinateDimension
  | BlockInstance;

/** A native dimension whose definition points are baked through a view transform before export — see {@link DXFTransformedDimensionInput}. */
export type TransformableDimension = LinearDimension | RadialDimension | DiameterDimension | AngularDimension | OrdinateDimension;

/**
 * A native dimension to export inside a scaled/rotated view: its definition points, picture geometry,
 * and (for a linear dimension) rotation are transformed by `transform`, while the displayed value text
 * is left at the true model measurement. Used by {@link Sheet.toDXF} for view-nested dimensions.
 */
export interface DXFTransformedDimensionInput {
  /** The native dimension whose geometry is transformed for export. */
  dimension: TransformableDimension;
  /** The enclosing view's transform, baked into the dimension's definition points and picture geometry. */
  transform: ViewTransform;
}

/**
 * A single {@link exportDXF} input: geometry (a bare `DrawingElement` or a
 * {@link DXFElementInput} with overrides), text (a bare `TextElement` or a
 * {@link DXFTextInput} with overrides), a {@link LinearDimension} (exported as
 * a native DXF `DIMENSION` entity), a radial / diameter / angular / ordinate
 * dimension (each also a native `DIMENSION` entity), a `BlockInstance` (exported
 * as a shared `BLOCK` definition plus an `INSERT`), or a GD&T annotation — a
 * {@link FeatureControlFrame}, {@link CompositeFeatureControlFrame},
 * {@link DatumFeatureSymbol}, or {@link DatumTargetSymbol} (bare or wrapped in a
 * {@link DXFGdtInput}) — which is exploded into `POLYLINE`/`TEXT` on a `GDT` layer;
 * a title block / table — a {@link DXFTitleBlockInput} (title block + context),
 * or a bare `BOMTable`/`RevisionTable` — exploded onto a `TITLEBLOCK` layer; or a
 * {@link DXFTransformedDimensionInput} (a native dimension carrying a view transform).
 */
export type DXFExportInput =
  | DXFPrimitiveInput
  | GDTFrame
  | DXFGdtInput
  | BOMTable
  | RevisionTable
  | DXFTitleBlockInput
  | DXFTransformedDimensionInput
  | (Renderable & Explodable);

/** Layer that native `DIMENSION` entities (and their block geometry) are placed on. */
const DIMENSION_LAYER = "DIMENSIONS";

/** Default layer for exploded GD&T geometry/text. */
const GDT_LAYER = "GDT";

/** Default layer for exploded title-block and table geometry/text. */
const TITLEBLOCK_LAYER = "TITLEBLOCK";

/** Default layer for any other exploded annotation (callouts, leaders, notes, symbols, tags). */
const ANNOTATIONS_LAYER = "ANNOTATIONS";

/** Options for {@link exportDXF}. */
export interface DXFExportOptions {
  /** Decimal places for coordinate/bulge values. Defaults to 6. */
  precision?: number;
}

const LINE_STYLE_LAYER: Record<LineStyleName, string> = {
  visible: "VISIBLE",
  hidden: "HIDDEN",
  centerline: "CENTER",
  phantom: "PHANTOM",
  break: "BREAK",
  section: "SECTION",
  cutting: "CUTTING",
};

const LINE_STYLE_LINETYPE: Record<LineStyleName, "CONTINUOUS" | "HIDDEN" | "CENTER" | "PHANTOM"> = {
  visible: "CONTINUOUS",
  hidden: "HIDDEN",
  centerline: "CENTER",
  phantom: "PHANTOM",
  break: "CONTINUOUS",
  section: "CONTINUOUS",
  cutting: "CENTER", // long-dash/short-dash, like the centerline pattern
};

// AutoCAD Color Index — arbitrary but distinguishable per layer; DXF has no standard
// color-per-linetype binding the way it does for linetype *names*, so this is a sensible
// default, not a spec requirement.
const LINE_STYLE_COLOR: Record<LineStyleName, number> = {
  visible: 7, // white/black (foreground)
  hidden: 1, // red
  centerline: 3, // green
  phantom: 5, // blue
  break: 7,
  section: 7,
  cutting: 6, // magenta
};

interface ResolvedGeometry {
  kind: "geometry";
  element: DrawingElement;
  layer: string;
  linetype: "CONTINUOUS" | "HIDDEN" | "CENTER" | "PHANTOM";
  colorIndex: number;
}

interface ResolvedText {
  kind: "text";
  text: TextElement;
  layer: string;
  colorIndex: number;
}

interface ResolvedDimension {
  kind: "dimension";
  data: LinearDimensionDXFData;
  layer: string;
  colorIndex: number;
}

/** A radial / diameter / angular / ordinate dimension exposing the generic {@link DimensionDXFData}. */
interface ResolvedGenericDimension {
  kind: "gdim";
  data: DimensionDXFData;
  layer: string;
  colorIndex: number;
}

interface ResolvedInsert {
  kind: "insert";
  placement: ReturnType<BlockInstance["placement"]>;
}

type Resolved = ResolvedGeometry | ResolvedText | ResolvedDimension | ResolvedGenericDimension | ResolvedInsert;

function resolve(input: DXFPrimitiveInput): Resolved {
  if (input instanceof DrawingElement) {
    const lineStyle = input.options.lineStyle ?? "visible";
    return { kind: "geometry", element: input, layer: LINE_STYLE_LAYER[lineStyle], linetype: LINE_STYLE_LINETYPE[lineStyle], colorIndex: LINE_STYLE_COLOR[lineStyle] };
  }
  if (input instanceof BlockInstance) {
    return { kind: "insert", placement: input.placement() };
  }
  if (input instanceof LinearDimension) {
    return { kind: "dimension", data: input.dimensionData(), layer: DIMENSION_LAYER, colorIndex: 7 };
  }
  if (
    input instanceof RadialDimension ||
    input instanceof DiameterDimension ||
    input instanceof AngularDimension ||
    input instanceof OrdinateDimension
  ) {
    return { kind: "gdim", data: input.dimensionDXF(), layer: DIMENSION_LAYER, colorIndex: 7 };
  }
  if (input instanceof TextElement) {
    return { kind: "text", text: input, layer: "TEXT", colorIndex: 7 };
  }
  if ("text" in input) {
    return { kind: "text", text: input.text, layer: input.layer ? sanitizeDxfString(input.layer) : "TEXT", colorIndex: input.colorIndex ?? 7 };
  }
  const element = input.element;
  const lineStyle = element.options.lineStyle ?? "visible";
  if (input.layer) {
    return { kind: "geometry", element, layer: sanitizeDxfString(input.layer), linetype: input.linetype ?? "CONTINUOUS", colorIndex: input.colorIndex ?? 7 };
  }
  return { kind: "geometry", element, layer: LINE_STYLE_LAYER[lineStyle], linetype: LINE_STYLE_LINETYPE[lineStyle], colorIndex: LINE_STYLE_COLOR[lineStyle] };
}

/** True for a bare GD&T annotation (as opposed to a wrapped {@link DXFGdtInput} or a primitive input). */
function isGdtFrame(input: DXFExportInput): input is GDTFrame {
  return (
    input instanceof FeatureControlFrame ||
    input instanceof CompositeFeatureControlFrame ||
    input instanceof MultipleSingleSegmentFrame ||
    input instanceof DatumFeatureSymbol ||
    input instanceof DatumTargetSymbol
  );
}

/** Explodes a list of `DrawingElement`/`TextElement` primitives onto `layer`, forcing `colorIndex`. */
function explodeElements(elements: readonly DxfPrimitive[], layer: string, colorIndex: number): Resolved[] {
  return elements.map((el): Resolved => {
    const r = resolve(el); // only DrawingElement/TextElement reach here, so r is geometry or text
    if (r.kind === "geometry") return { ...r, layer, colorIndex };
    if (r.kind === "text") return { ...r, layer, colorIndex };
    return r;
  });
}

/** True for a bare BOM/revision table (an anchored {@link Explodable} needing no render context). */
function isTable(input: DXFExportInput): input is BOMTable | RevisionTable {
  return input instanceof BOMTable || input instanceof RevisionTable;
}

/** Rotates a direction/vector by a view-transform rotation only (no scale or translation — unit directions stay unit). */
function rotateVec(v: Point, rotation: number): Point {
  if (!rotation) return v;
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** Bakes a view transform into a linear dimension's DXF data — points move, the value text stays the true measurement (§ View semantics). */
function transformLinearDimensionData(d: LinearDimensionDXFData, t: ViewTransform): LinearDimensionDXFData {
  const p = (pt: Point) => applyViewTransform(pt, t);
  const rot = t.rotation ?? 0;
  return {
    ...d,
    defPoint1: p(d.defPoint1),
    defPoint2: p(d.defPoint2),
    dimLinePoint: p(d.dimLinePoint),
    textMidpoint: p(d.textMidpoint),
    rotationDeg: d.rotationDeg + (rot * 180) / Math.PI,
    extLines: d.extLines.map(([a, b]) => [p(a), p(b)] as [Point, Point]),
    dimLine: [p(d.dimLine[0]), p(d.dimLine[1])],
    arrows: d.arrows.map((ar) => ({ ...ar, tip: p(ar.tip), dir: rotateVec(ar.dir, rot) })),
    // text, arrowLengthMM, arrowWidthMM, textSizeMM stay in paper space (annotation size is not scaled)
  };
}

function transformPicture(pic: DimensionPicture, p: (pt: Point) => Point, rot: number, scale: number): DimensionPicture {
  switch (pic.kind) {
    case "line":
      return { ...pic, a: p(pic.a), b: p(pic.b) };
    case "arc":
      return { ...pic, center: p(pic.center), radius: pic.radius * scale, startRad: pic.startRad + rot, endRad: pic.endRad + rot };
    case "arrow":
      return { ...pic, tip: p(pic.tip), dir: rotateVec(pic.dir, rot) };
    case "text":
      return { ...pic, center: p(pic.center) };
  }
}

/** Bakes a view transform into a radial/diameter/angular/ordinate dimension's DXF data; the value text stays the true measurement. */
function transformDimensionData(d: DimensionDXFData, t: ViewTransform): DimensionDXFData {
  const p = (pt: Point) => applyViewTransform(pt, t);
  const rot = t.rotation ?? 0;
  const out: DimensionDXFData = {
    ...d,
    dimLinePoint: p(d.dimLinePoint),
    textMidpoint: p(d.textMidpoint),
    picture: d.picture.map((pic) => transformPicture(pic, p, rot, t.scale)),
  };
  if (d.defPoints) out.defPoints = d.defPoints.map((dp) => ({ ...dp, point: p(dp.point) }));
  return out;
}

/** Resolves one input to one or more DXF entity groups — GD&T/title-block/table annotations explode into several, everything else into exactly one. */
function resolveAll(input: DXFExportInput): Resolved[] {
  if (isGdtFrame(input)) return explodeElements(input.toElements(), GDT_LAYER, 7);
  if (typeof input === "object" && input !== null && "dimension" in input && "transform" in input) {
    const { dimension, transform } = input;
    if (dimension instanceof LinearDimension) {
      return [{ kind: "dimension", data: transformLinearDimensionData(dimension.dimensionData(), transform), layer: DIMENSION_LAYER, colorIndex: 7 }];
    }
    return [{ kind: "gdim", data: transformDimensionData(dimension.dimensionDXF(), transform), layer: DIMENSION_LAYER, colorIndex: 7 }];
  }
  if (isTable(input)) return explodeElements(input.toElements(), TITLEBLOCK_LAYER, 7);
  if (typeof input === "object" && input !== null && "gdt" in input) {
    return explodeElements(input.gdt.toElements(), input.layer ? sanitizeDxfString(input.layer) : GDT_LAYER, input.colorIndex ?? 7);
  }
  if (typeof input === "object" && input !== null && "titleBlock" in input) {
    const tb = input.titleBlock;
    if (!tb.renderElements) {
      throw new Error("This title block does not support DXF export (it implements only render(), not renderElements()).");
    }
    return explodeElements(tb.renderElements(input.context), input.layer ? sanitizeDxfString(input.layer) : TITLEBLOCK_LAYER, input.colorIndex ?? 7);
  }
  // Any other Explodable annotation (callouts, leaders, and — in later batches — notes/symbols/tags)
  // explodes onto a generic ANNOTATIONS layer. GD&T and tables are handled above with their own layers.
  if (isExplodable(input)) return explodeElements(input.toElements(), ANNOTATIONS_LAYER, 7);
  return [resolve(input as DXFPrimitiveInput)];
}

function fmt(n: number, precision: number): string {
  return n.toFixed(precision);
}

/**
 * DXF is a line-delimited `code\nvalue\n` format, so a raw `\r`/`\n` inside a
 * string value (e.g. a caller-supplied layer name or text content) would inject
 * arbitrary group-code pairs / entities. Collapse newlines to a single space
 * and strip other control characters. DXF R12 has no legal multiline string, so
 * this is lossless for well-formed input.
 */
function sanitizeDxfString(s: string): string {
  return s.replace(/[\r\n]+/g, " ").replace(/[\x00-\x1f]/g, "");
}

function pair(code: number, value: string | number): string {
  return `${code}\n${value}\n`;
}

function ltypePattern(name: "HIDDEN" | "CENTER" | "PHANTOM", dasharray: readonly number[], precision: number): string {
  const total = dasharray.reduce((a, b) => a + b, 0);
  const segments = dasharray.map((v, i) => (i % 2 === 0 ? v : -v));
  let out = pair(0, "LTYPE") + pair(2, name) + pair(70, 0) + pair(3, "") + pair(72, 65) + pair(73, segments.length) + pair(40, fmt(total, precision));
  for (const s of segments) out += pair(49, fmt(s, precision)) + pair(74, 0);
  return out;
}

function layerTableEntry(name: string, linetype: string, colorIndex: number): string {
  return pair(0, "LAYER") + pair(2, name) + pair(70, 0) + pair(62, colorIndex) + pair(6, linetype);
}

/** A minimal STANDARD text style, referenced by every `TEXT` entity (its group 7 defaults to STANDARD). */
function standardStyleEntry(): string {
  return (
    pair(0, "STYLE") +
    pair(2, "STANDARD") +
    pair(70, 0) +
    pair(40, 0) + // fixed text height 0 = not fixed (each TEXT sets its own height)
    pair(41, 1) + // width factor
    pair(50, 0) + // oblique angle
    pair(71, 0) +
    pair(42, 2.5) + // last height used
    pair(3, "txt") + // primary font file
    pair(4, "") // bigfont file
  );
}

function polylineEntity(resolved: ResolvedGeometry, precision: number): string | null {
  const { vertices, closed } = pathToPolyline(resolved.element.path);
  if (vertices.length < 2) return null;

  // Classic (R12-style) POLYLINE/VERTEX/SEQEND rather than LWPOLYLINE: LWPOLYLINE needs the
  // AC1015+ subclass-marker/handle entity structure to parse cleanly, while POLYLINE's per-vertex
  // bulge (group 42) gives the same exact-arc representation with a far simpler, handle-free format.
  let out = pair(0, "POLYLINE") + pair(8, resolved.layer) + pair(62, resolved.colorIndex) + pair(66, 1) + pair(70, closed ? 1 : 0);
  for (const v of vertices) {
    out += pair(0, "VERTEX") + pair(8, resolved.layer) + pair(10, fmt(v.x, precision)) + pair(20, fmt(v.y, precision));
    if (v.bulge !== 0) out += pair(42, fmt(v.bulge, precision));
  }
  out += pair(0, "SEQEND");
  return out;
}

/**
 * A `TextElement` becomes one `TEXT` entity per display line (R12 `TEXT` is
 * single-line; `MTEXT` is R13+, which this writer doesn't target). Lines stack
 * downward from the element's position by its resolved line height, matching the
 * SVG layout.
 */
function textEntity(resolved: ResolvedText, precision: number): string {
  const { position, options } = resolved.text;
  const height = options.size ?? 3;
  const lineHeight = options.lineHeightMM ?? height * 1.2;
  const anchor = options.anchor ?? "start";
  const baseline = options.baseline ?? "auto";
  // DXF group 72: 0 left, 1 center, 2 right. group 73: 0 baseline, 2 middle, 3 top.
  const hJust = anchor === "middle" ? 1 : anchor === "end" ? 2 : 0;
  const vJust = baseline === "middle" ? 2 : baseline === "hanging" ? 3 : 0;

  return resolved.text
    .lines()
    .map((line, i) => {
      const y = position.y - i * lineHeight;
      let out =
        pair(0, "TEXT") +
        pair(8, resolved.layer) +
        pair(62, resolved.colorIndex) +
        pair(10, fmt(position.x, precision)) +
        pair(20, fmt(y, precision)) +
        pair(40, fmt(height, precision)) +
        pair(1, sanitizeDxfString(line));
      if (options.weight === "bold") out += pair(7, "STANDARD"); // no bold SHX; keep STANDARD, weight is cosmetic in SVG only
      // When justified, DXF ignores group 10/20 and uses the second alignment point (11/21).
      if (hJust !== 0 || vJust !== 0) {
        out += pair(72, hJust) + pair(73, vJust) + pair(11, fmt(position.x, precision)) + pair(21, fmt(y, precision));
      }
      return out;
    })
    .join("");
}

function lineEntity(a: Point, b: Point, layer: string, precision: number): string {
  return pair(0, "LINE") + pair(8, layer) + pair(10, fmt(a.x, precision)) + pair(20, fmt(a.y, precision)) + pair(11, fmt(b.x, precision)) + pair(21, fmt(b.y, precision));
}

/** A filled triangle as a DXF `SOLID` (the arrowhead in a dimension block). */
function solidTriangle(p1: Point, p2: Point, p3: Point, layer: string, precision: number): string {
  // SOLID fills the quad p1-p2-p4-p3; setting p4 = p3 makes it a triangle.
  return (
    pair(0, "SOLID") + pair(8, layer) +
    pair(10, fmt(p1.x, precision)) + pair(20, fmt(p1.y, precision)) +
    pair(11, fmt(p2.x, precision)) + pair(21, fmt(p2.y, precision)) +
    pair(12, fmt(p3.x, precision)) + pair(22, fmt(p3.y, precision)) +
    pair(13, fmt(p3.x, precision)) + pair(23, fmt(p3.y, precision))
  );
}

/** A centered `TEXT` entity (used inside a dimension block for the value). */
function centeredText(pos: Point, text: string, height: number, layer: string, precision: number): string {
  return (
    pair(0, "TEXT") + pair(8, layer) +
    pair(10, fmt(pos.x, precision)) + pair(20, fmt(pos.y, precision)) + pair(40, fmt(height, precision)) +
    pair(1, sanitizeDxfString(text)) +
    pair(72, 1) + pair(73, 2) + pair(11, fmt(pos.x, precision)) + pair(21, fmt(pos.y, precision)) // centered/middle
  );
}

/** The anonymous block holding a dimension's picture (extension lines, dimension line, arrows, value text). */
function dimensionBlock(name: string, d: LinearDimensionDXFData, precision: number): string {
  let out = pair(0, "BLOCK") + pair(8, DIMENSION_LAYER) + pair(2, name) + pair(70, 1) + pair(10, "0.0") + pair(20, "0.0") + pair(30, "0.0") + pair(3, name);
  for (const [a, b] of d.extLines) out += lineEntity(a, b, DIMENSION_LAYER, precision);
  out += lineEntity(d.dimLine[0], d.dimLine[1], DIMENSION_LAYER, precision);
  for (const arrow of d.arrows) {
    const base = subtractPoints(arrow.tip, scalePoint(arrow.dir, d.arrowLengthMM));
    const perp = perpendicular(arrow.dir);
    const left = addPoints(base, scalePoint(perp, d.arrowWidthMM / 2));
    const right = subtractPoints(base, scalePoint(perp, d.arrowWidthMM / 2));
    out += solidTriangle(arrow.tip, left, right, DIMENSION_LAYER, precision);
  }
  out += centeredText(d.textMidpoint, d.text, d.textSizeMM, DIMENSION_LAYER, precision);
  out += pair(0, "ENDBLK") + pair(8, DIMENSION_LAYER);
  return out;
}

/** The native `DIMENSION` entity referencing its picture block `name`. */
function dimensionEntity(name: string, d: LinearDimensionDXFData, precision: number): string {
  return (
    pair(0, "DIMENSION") + pair(8, DIMENSION_LAYER) + pair(2, name) +
    pair(10, fmt(d.dimLinePoint.x, precision)) + pair(20, fmt(d.dimLinePoint.y, precision)) + pair(30, "0.0") +
    pair(11, fmt(d.textMidpoint.x, precision)) + pair(21, fmt(d.textMidpoint.y, precision)) + pair(31, "0.0") +
    pair(70, d.aligned ? 1 : 0) + // dimtype: 1 aligned, 0 rotated/horizontal/vertical
    pair(1, sanitizeDxfString(d.text)) +
    pair(3, "STANDARD") +
    pair(13, fmt(d.defPoint1.x, precision)) + pair(23, fmt(d.defPoint1.y, precision)) + pair(33, "0.0") +
    pair(14, fmt(d.defPoint2.x, precision)) + pair(24, fmt(d.defPoint2.y, precision)) + pair(34, "0.0") +
    pair(50, fmt(d.rotationDeg, precision))
  );
}

/** A circular `ARC` entity (used inside an angular dimension's block picture). Angles in degrees, CCW. */
function arcEntity(center: Point, radius: number, startRad: number, endRad: number, layer: string, precision: number): string {
  const deg = (r: number): number => (((r * 180) / Math.PI) % 360 + 360) % 360;
  return (
    pair(0, "ARC") + pair(8, layer) +
    pair(10, fmt(center.x, precision)) + pair(20, fmt(center.y, precision)) + pair(30, "0.0") +
    pair(40, fmt(radius, precision)) +
    pair(50, fmt(deg(startRad), precision)) + pair(51, fmt(deg(endRad), precision))
  );
}

/** The anonymous block holding a radial/diameter/angular/ordinate dimension's picture. */
function genericDimensionBlock(name: string, d: DimensionDXFData, precision: number): string {
  let out = pair(0, "BLOCK") + pair(8, DIMENSION_LAYER) + pair(2, name) + pair(70, 1) + pair(10, "0.0") + pair(20, "0.0") + pair(30, "0.0") + pair(3, name);
  for (const prim of d.picture) {
    if (prim.kind === "line") {
      out += lineEntity(prim.a, prim.b, DIMENSION_LAYER, precision);
    } else if (prim.kind === "arc") {
      out += arcEntity(prim.center, prim.radius, prim.startRad, prim.endRad, DIMENSION_LAYER, precision);
    } else if (prim.kind === "arrow") {
      const base = subtractPoints(prim.tip, scalePoint(prim.dir, d.arrowLengthMM));
      const perp = perpendicular(prim.dir);
      const left = addPoints(base, scalePoint(perp, d.arrowWidthMM / 2));
      const right = subtractPoints(base, scalePoint(perp, d.arrowWidthMM / 2));
      out += solidTriangle(prim.tip, left, right, DIMENSION_LAYER, precision);
    } else {
      out += centeredText(prim.center, prim.text, prim.sizeMM, DIMENSION_LAYER, precision);
    }
  }
  return out + pair(0, "ENDBLK") + pair(8, DIMENSION_LAYER);
}

/** The native `DIMENSION` entity for a radial/diameter/angular/ordinate dimension, referencing its picture block `name`. */
function genericDimensionEntity(name: string, d: DimensionDXFData, precision: number): string {
  let out =
    pair(0, "DIMENSION") + pair(8, DIMENSION_LAYER) + pair(2, name) +
    pair(10, fmt(d.dimLinePoint.x, precision)) + pair(20, fmt(d.dimLinePoint.y, precision)) + pair(30, "0.0") +
    pair(11, fmt(d.textMidpoint.x, precision)) + pair(21, fmt(d.textMidpoint.y, precision)) + pair(31, "0.0") +
    pair(70, d.dimType) +
    pair(1, sanitizeDxfString(d.text)) +
    pair(3, "STANDARD");
  for (const dp of d.defPoints ?? []) {
    out += pair(dp.code, fmt(dp.point.x, precision)) + pair(dp.code + 10, fmt(dp.point.y, precision)) + pair(dp.code + 20, "0.0");
  }
  return out;
}

/** A minimal STANDARD dimension style (DIMSTYLE table entry) that every `DIMENSION` references via its group 3. */
function dimstyleEntry(): string {
  return (
    pair(0, "DIMSTYLE") + pair(2, "STANDARD") + pair(70, 0) +
    pair(40, 1) + // DIMSCALE
    pair(41, DEFAULT_DIMENSION_STYLE.arrowLengthMM) + // DIMASZ arrow size
    pair(42, DEFAULT_DIMENSION_STYLE.extensionGapMM) + // DIMEXO extension offset
    pair(44, DEFAULT_DIMENSION_STYLE.extensionOvershootMM) + // DIMEXE extension beyond dim line
    pair(140, DEFAULT_DIMENSION_STYLE.textSizeMM) // DIMTXT text height
  );
}

/** Resolves a block's own child renderables to DXF geometry/text; only `DrawingElement`/`TextElement` children are emitted inside a block (nested blocks, dimensions, etc. are skipped). */
function resolveBlockChildren(block: Block): (ResolvedGeometry | ResolvedText)[] {
  const out: (ResolvedGeometry | ResolvedText)[] = [];
  for (const el of block.getElements()) {
    if (el instanceof DrawingElement || el instanceof TextElement) {
      const r = resolve(el);
      if (r.kind === "geometry" || r.kind === "text") out.push(r);
    }
  }
  return out;
}

/** A `BLOCK` definition holding a block's child geometry, authored at the block's local origin. */
function blockDefinition(name: string, children: readonly (ResolvedGeometry | ResolvedText)[], precision: number): string {
  let out = pair(0, "BLOCK") + pair(8, "0") + pair(2, name) + pair(70, 0) + pair(10, "0.0") + pair(20, "0.0") + pair(30, "0.0") + pair(3, name);
  for (const c of children) out += c.kind === "geometry" ? (polylineEntity(c, precision) ?? "") : textEntity(c, precision);
  return out + pair(0, "ENDBLK") + pair(8, "0");
}

/** An `INSERT` placing a named block at a position, with a uniform scale and rotation. */
function insertEntity(name: string, placement: ResolvedInsert["placement"], precision: number): string {
  let out =
    pair(0, "INSERT") + pair(8, "0") + pair(2, name) + pair(10, fmt(placement.position.x, precision)) + pair(20, fmt(placement.position.y, precision));
  if (placement.scale !== 1) {
    out += pair(41, fmt(placement.scale, precision)) + pair(42, fmt(placement.scale, precision)) + pair(43, fmt(placement.scale, precision));
  }
  if (placement.rotationDeg !== 0) out += pair(50, fmt(placement.rotationDeg, precision));
  return out;
}

/**
 * Exports a drawing as a minimal, valid DXF (R12/AC1009) file: `HEADER`
 * (units = mm), `TABLES` (`LTYPE`/`LAYER`, plus a `STYLE` table when any text is
 * present), and `ENTITIES`.
 *
 * Each `DrawingElement`'s `Path` becomes one `POLYLINE`, with true circular arcs
 * preserved as per-vertex bulge values (elliptical arcs are tessellated, since
 * bulge is circular-only) — so exported geometry round-trips exactly rather than
 * being flattened the way `Path.flatten()` does for hatching. Each
 * `TextElement` (or {@link DXFTextInput}) becomes a `TEXT` entity, honoring its
 * height and horizontal/vertical justification; text defaults to a `"TEXT"`
 * layer. `hidden`/`centerline`/`phantom` line styles map to DXF's own standard
 * linetypes of the same name, built from the same dash-array values as the SVG
 * output, so both stay visually consistent.
 *
 * A {@link LinearDimension} becomes a **native `DIMENSION` entity** (not exploded
 * lines/text): the exporter emits a `DIMSTYLE` table, a `BLOCKS` section with one
 * anonymous block per dimension holding its picture (extension lines, dimension
 * line, `SOLID` arrowheads, value `TEXT`), and the `DIMENSION` entity referencing
 * that block — so the receiving CAD sees an editable dimension on a `DIMENSIONS`
 * layer. `LinearDimension`, `RadialDimension`, `DiameterDimension`,
 * `AngularDimension`, and `OrdinateDimension` all export as native `DIMENSION`
 * entities (dimtypes 0/1, 4, 3, 2, and 6 respectively), each with its picture in an
 * anonymous block; angular pictures use `ARC` entities for the dimension arc.
 *
 * A GD&T annotation — a {@link FeatureControlFrame}, {@link CompositeFeatureControlFrame},
 * {@link DatumFeatureSymbol}, or {@link DatumTargetSymbol}, passed bare or wrapped in a
 * {@link DXFGdtInput} for a layer/color override — is **exploded** into its constituent
 * `POLYLINE`/`TEXT` entities on a `"GDT"` layer (R12 has no native feature-control-frame
 * entity). The same element list backs the SVG rendering, so the two stay consistent.
 *
 * A title block or table is exploded the same way, onto a `"TITLEBLOCK"` layer: a
 * {@link DXFTitleBlockInput} pairs a `TitleBlock`/`GridTitleBlock`/`ISO7200TitleBlock` with the
 * sheet `context` that positions it (the same context a `Sheet` supplies), and a bare `BOMTable`
 * or `RevisionTable` (anchored, so no context needed) explodes directly. Any other
 * {@link Explodable} annotation — the callout/leader family (`Callout`, `MultiLeader`,
 * `DetailViewCallout`) and the symbol/note families — explodes onto a generic
 * `"ANNOTATIONS"` layer. `MTEXT` isn't used — it's an R13+ entity, and this writer targets
 * R12/`AC1009`.
 *
 * A {@link BlockInstance} becomes a shared **`BLOCK` definition plus an `INSERT`**:
 * each distinct source `Block` is written once into the `BLOCKS` section (its
 * `DrawingElement`/`TextElement` children authored at the block's local origin, on
 * layer `0`), and every placement emits an `INSERT` carrying the instance's
 * position, uniform scale, and rotation — so repeated symbols stay reusable in the
 * receiving CAD instead of being duplicated as flat geometry. Only geometry and
 * text inside a block are emitted; nested blocks and dimensions within a block are
 * skipped.
 */
export function exportDXF(elements: readonly DXFExportInput[], options: DXFExportOptions = {}): string {
  const precision = options.precision ?? 6;
  const resolved = elements.flatMap(resolveAll);
  // Every dimension (linear or radial/diameter/angular/ordinate) gets a picture block, named *D1.. in
  // resolved order so the DIMENSION entity and its block agree.
  const dimBlockName = new Map<Resolved, string>();
  for (const r of resolved) {
    if (r.kind === "dimension" || r.kind === "gdim") dimBlockName.set(r, `*D${dimBlockName.size + 1}`);
  }
  const hasDimension = dimBlockName.size > 0;

  // Collect unique blocks referenced by inserts (deduped by object identity), each with a DXF name.
  const blockNameOf = new Map<Block, string>();
  const usedNames = new Set<string>();
  const uniqueBlocks: { name: string; children: (ResolvedGeometry | ResolvedText)[] }[] = [];
  for (const r of resolved) {
    if (r.kind !== "insert" || blockNameOf.has(r.placement.block)) continue;
    const base = r.placement.block.name ? sanitizeDxfString(r.placement.block.name).toUpperCase() : `BLOCK${uniqueBlocks.length + 1}`;
    let name = base;
    for (let i = 2; usedNames.has(name); i++) name = `${base}_${i}`;
    usedNames.add(name);
    blockNameOf.set(r.placement.block, name);
    uniqueBlocks.push({ name, children: resolveBlockChildren(r.placement.block) });
  }
  const hasBlocks = uniqueBlocks.length > 0;

  // Layer/linetype/style tables draw from top-level content *and* the geometry inside block definitions.
  const blockChildren = uniqueBlocks.flatMap((b) => b.children);
  const layerSources = [
    ...resolved.filter((r): r is ResolvedGeometry | ResolvedText | ResolvedDimension | ResolvedGenericDimension => r.kind !== "insert"),
    ...blockChildren,
  ];
  const hasText = layerSources.some((r) => r.kind === "text");

  const layers = new Map<string, { linetype: string; colorIndex: number }>();
  for (const r of layerSources) {
    const linetype = r.kind === "geometry" ? r.linetype : "CONTINUOUS";
    if (!layers.has(r.layer)) layers.set(r.layer, { linetype, colorIndex: r.colorIndex });
  }
  if (hasBlocks && !layers.has("0")) layers.set("0", { linetype: "CONTINUOUS", colorIndex: 7 }); // BLOCK/ENDBLK/INSERT sit on layer 0

  const usedLinetypes = new Set(Array.from(layers.values()).map((l) => l.linetype));

  let header = pair(0, "SECTION") + pair(2, "HEADER") + pair(9, "$ACADVER") + pair(1, "AC1009") + pair(9, "$INSUNITS") + pair(70, 4);
  header += pair(0, "ENDSEC");

  let ltypeTable = pair(0, "TABLE") + pair(2, "LTYPE") + pair(70, usedLinetypes.size);
  if (usedLinetypes.has("HIDDEN")) ltypeTable += ltypePattern("HIDDEN", LINE_STYLES.hidden.dasharray!, precision);
  if (usedLinetypes.has("CENTER")) ltypeTable += ltypePattern("CENTER", LINE_STYLES.centerline.dasharray!, precision);
  if (usedLinetypes.has("PHANTOM")) ltypeTable += ltypePattern("PHANTOM", LINE_STYLES.phantom.dasharray!, precision);
  ltypeTable += pair(0, "ENDTAB");

  let layerTable = pair(0, "TABLE") + pair(2, "LAYER") + pair(70, layers.size);
  for (const [name, { linetype, colorIndex }] of layers) {
    layerTable += layerTableEntry(name, linetype, colorIndex);
  }
  layerTable += pair(0, "ENDTAB");

  // text style is needed for both TEXT entities and the TEXT inside dimension blocks
  const styleTable = hasText || hasDimension ? pair(0, "TABLE") + pair(2, "STYLE") + pair(70, 1) + standardStyleEntry() + pair(0, "ENDTAB") : "";
  const dimstyleTable = hasDimension ? pair(0, "TABLE") + pair(2, "DIMSTYLE") + pair(70, 1) + dimstyleEntry() + pair(0, "ENDTAB") : "";

  const tables = pair(0, "SECTION") + pair(2, "TABLES") + ltypeTable + layerTable + styleTable + dimstyleTable + pair(0, "ENDSEC");

  // BLOCKS section: one anonymous block per dimension holding its picture geometry, plus one
  // named block per reusable symbol referenced by an INSERT.
  let blocks = "";
  if (hasDimension || hasBlocks) {
    blocks = pair(0, "SECTION") + pair(2, "BLOCKS");
    for (const r of resolved) {
      if (r.kind === "dimension") blocks += dimensionBlock(dimBlockName.get(r)!, r.data, precision);
      else if (r.kind === "gdim") blocks += genericDimensionBlock(dimBlockName.get(r)!, r.data, precision);
    }
    for (const b of uniqueBlocks) {
      blocks += blockDefinition(b.name, b.children, precision);
    }
    blocks += pair(0, "ENDSEC");
  }

  let entities = pair(0, "SECTION") + pair(2, "ENTITIES");
  for (const r of resolved) {
    if (r.kind === "geometry") {
      const entity = polylineEntity(r, precision);
      if (entity) entities += entity;
    } else if (r.kind === "text") {
      entities += textEntity(r, precision);
    } else if (r.kind === "insert") {
      entities += insertEntity(blockNameOf.get(r.placement.block)!, r.placement, precision);
    } else if (r.kind === "dimension") {
      entities += dimensionEntity(dimBlockName.get(r)!, r.data, precision);
    } else {
      entities += genericDimensionEntity(dimBlockName.get(r)!, r.data, precision);
    }
  }
  entities += pair(0, "ENDSEC");

  return header + tables + blocks + entities + pair(0, "EOF");
}
