import { Path } from "../geometry/path.js";
import { addPoints, dot, normalize, perpendicular, point, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { breakSegmentAtCrossings, type LineBreakObstacle } from "../geometry/intersect.js";
import { DrawingElement } from "../svg/element.js";
import { applyViewTransform, viewScale, type RenderContext, type Renderable, type ViewTransform } from "../svg/renderable.js";
import { fromMM } from "../units.js";
import { arrowhead } from "./arrowhead.js";
import { dualSecondary } from "./dual.js";
import { formatMeasurement } from "./format.js";
import { renderDimensionLabel } from "./label.js";
import { mergeDimensionDefaults, resolveDimensionStyle, type DimensionStyle } from "./style.js";
import { formatToleranceText, type ToleranceOptions } from "./tolerance.js";

/** A `LinearDimension`'s axis: parallel to its two points, or forced horizontal/vertical. */
export type DimensionOrientation = "aligned" | "horizontal" | "vertical";

/** Maps a break obstacle from model space into paper space, so it lines up with the drawn (view-transformed) geometry. */
function transformObstacle(o: LineBreakObstacle, transform: ViewTransform | undefined): LineBreakObstacle {
  if (o.kind === "circle") {
    return { kind: "circle", center: applyViewTransform(o.center, transform), radius: o.radius * viewScale(transform) };
  }
  return { kind: "segment", p1: applyViewTransform(o.p1, transform), p2: applyViewTransform(o.p2, transform) };
}

/** Options for a {@link LinearDimension}. */
export interface LinearDimensionOptions extends DimensionStyle, ToleranceOptions {
  /** "aligned" (default): parallel to p1->p2. "horizontal"/"vertical": force the dimension onto that axis, even if p1/p2 aren't exactly aligned. */
  orientation?: DimensionOrientation;
  /**
   * Signed perpendicular distance from p1 to the dimension line. Positive is
   * 90 degrees counterclockwise from the measurement axis: "up" for horizontal,
   * "left" for vertical, left-of-direction for aligned.
   */
  offset: number;
  /** Overrides the auto-formatted measured value (before any tolerance suffix is appended). */
  text?: string;
  /** ASME Y14.5 §3.3.7 square feature: prefixes the value with `□`, meaning the cross-section is square (one dimension covers both sides). Ignored when `text` is given. */
  square?: boolean;
  /**
   * ASME Y14.5 / ISO 129 **half (symmetry) dimension**, for a feature drawn as a half view about an
   * axis of symmetry: `p1` is taken to be on the symmetry axis and only the `p2` side is drawn — one
   * extension line and one arrowhead, with the dimension line running past the axis (no arrowhead
   * there). The displayed value is the **full** symmetric size, i.e. twice the `p1`→`p2` distance
   * (unless overridden by `text`). The native DXF `DIMENSION` export emits the ordinary two-sided
   * picture with the same full value.
   */
  half?: boolean;
  /**
   * Obstacles (in model coordinates) to break this dimension's extension and dimension lines around
   * where they cross — the AutoCAD `DIMBREAK` convention. Each crossing leaves a `breakGapMM` gap.
   * Only affects the SVG render; the native DXF `DIMENSION` (see {@link LinearDimension.dimensionData})
   * is unaffected.
   */
  breakAt?: readonly LineBreakObstacle[];
  /** Gap size (mm) for {@link LinearDimensionOptions.breakAt} crossings. Defaults to 1.5. */
  breakGapMM?: number;
}

/**
 * A two-point linear dimension: extension lines from the measured points, a
 * dimension line broken around a centered text label, and arrowheads at each end.
 * Text is always kept horizontal (unidirectional dimensioning), regardless of
 * the dimension line's orientation.
 */
export class LinearDimension implements Renderable {
  constructor(
    private readonly p1: Point,
    private readonly p2: Point,
    private readonly options: LinearDimensionOptions,
  ) {}

  toSVG(context?: RenderContext): string {
    const options = mergeDimensionDefaults(this.options, context?.dimensionDefaults);
    const style = resolveDimensionStyle(options);
    const orientation = options.orientation ?? "aligned";
    // In a View, anchor points map to paper space (so the geometry scales) while
    // the reported value is divided back to true model size below.
    const p1 = applyViewTransform(this.p1, context?.transform);
    const p2 = applyViewTransform(this.p2, context?.transform);

    const axis =
      orientation === "horizontal" ? point(1, 0) : orientation === "vertical" ? point(0, 1) : normalize(subtractPoints(p2, p1));
    const n = perpendicular(axis);
    const side = Math.sign(options.offset) || 1;

    const a1 = dot(p1, axis);
    const a2 = dot(p2, axis);
    const dimPerp = dot(p1, n) + options.offset;

    const dimP1 = addPoints(scalePoint(axis, a1), scalePoint(n, dimPerp));
    const dimP2 = addPoints(scalePoint(axis, a2), scalePoint(n, dimPerp));
    const dimAxis = scalePoint(axis, Math.sign(a2 - a1) || 1);

    const half = options.half ?? false;
    const measuredHalf = Math.abs(a2 - a1) / viewScale(context?.transform);
    const measured = half ? measuredHalf * 2 : measuredHalf;
    const measuredDisplay = fromMM(measured, style.unit);
    const prefix = options.square ? "□" : "";
    const nominalText = options.text ?? `${prefix}${formatMeasurement(measured, style)}`;
    const mid = scalePoint(addPoints(dimP1, dimP2), 0.5);

    const dual = options.text === undefined ? dualSecondary(measured, prefix, options, options) : undefined;
    const label = renderDimensionLabel(mid, measuredDisplay, nominalText, style.textSizeMM, style, style.color, options, style.strokeWidthMM, dual);
    const halfGap = (orientation === "vertical" ? label.height : label.width) / 2 + style.textGapMM;

    const parts: string[] = [];
    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };

    // Obstacles to break lines around (DIMBREAK), mapped into paper space to match the drawn geometry.
    const obstacles = (options.breakAt ?? []).map((o) => transformObstacle(o, context?.transform));
    const breakGap = options.breakGapMM ?? 1.5;
    const drawLine = (a: Point, b: Point): void => {
      const segments = obstacles.length > 0 ? breakSegmentAtCrossings(a, b, obstacles, breakGap) : [[a, b] as [Point, Point]];
      for (const [s, e] of segments) {
        parts.push(new DrawingElement(new Path().moveTo(s.x, s.y).lineTo(e.x, e.y), strokeOptions).toSVG());
      }
    };

    // In a half dimension, only the p2 (visible-edge) side gets an extension line; p1 sits on the axis of symmetry.
    const extPairs = half ? ([[p2, dimP2]] as const) : ([[p1, dimP1], [p2, dimP2]] as const);
    for (const [p, dimP] of extPairs) {
      const extStart = addPoints(p, scalePoint(n, side * style.extensionGapMM));
      const extEnd = addPoints(dimP, scalePoint(n, side * style.extensionOvershootMM));
      drawLine(extStart, extEnd);
    }

    const lineNear1 = addPoints(dimP1, scalePoint(dimAxis, style.arrowLengthMM));
    const lineFar1 = subtractPoints(mid, scalePoint(dimAxis, halfGap));
    const lineNear2 = subtractPoints(dimP2, scalePoint(dimAxis, style.arrowLengthMM));
    const lineFar2 = addPoints(mid, scalePoint(dimAxis, halfGap));

    if (half) {
      // p1 side runs past the symmetry axis with no arrowhead; p2 side is a normal arrowed end.
      const overshootEnd = subtractPoints(dimP1, scalePoint(dimAxis, style.arrowLengthMM + style.extensionOvershootMM));
      drawLine(overshootEnd, lineFar1);
      drawLine(lineNear2, lineFar2);
      parts.push(arrowhead(dimP2, dimAxis, { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }).toSVG());
    } else {
      drawLine(lineNear1, lineFar1);
      drawLine(lineNear2, lineFar2);
      parts.push(
        arrowhead(dimP1, scalePoint(dimAxis, -1), { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }).toSVG(),
      );
      parts.push(arrowhead(dimP2, dimAxis, { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }).toSVG());
    }

    parts.push(label.svg);

    return parts.join("\n");
  }

  /**
   * The data an exporter needs to emit this as a native DXF `DIMENSION` entity:
   * the definition points, the value text, the dimension-line rotation, and the
   * picture geometry (extension lines, dimension line, arrowheads) for its
   * anonymous block. Computed in paper space (no view transform). Used by
   * `exportDXF`; not part of the SVG render path.
   */
  dimensionData(): LinearDimensionDXFData {
    const style = resolveDimensionStyle(this.options);
    const orientation = this.options.orientation ?? "aligned";
    const { p1, p2 } = this;
    const axis = orientation === "horizontal" ? point(1, 0) : orientation === "vertical" ? point(0, 1) : normalize(subtractPoints(p2, p1));
    const n = perpendicular(axis);
    const side = Math.sign(this.options.offset) || 1;

    const a1 = dot(p1, axis);
    const a2 = dot(p2, axis);
    const dimPerp = dot(p1, n) + this.options.offset;
    const dimP1 = addPoints(scalePoint(axis, a1), scalePoint(n, dimPerp));
    const dimP2 = addPoints(scalePoint(axis, a2), scalePoint(n, dimPerp));
    const dimAxis = scalePoint(axis, Math.sign(a2 - a1) || 1);
    const mid = scalePoint(addPoints(dimP1, dimP2), 0.5);

    const measured = this.options.half ? Math.abs(a2 - a1) * 2 : Math.abs(a2 - a1);
    const prefix = this.options.square ? "□" : "";
    const nominalText = this.options.text ?? `${prefix}${formatMeasurement(measured, style)}`;
    const text = formatToleranceText(nominalText, this.options, style);

    const extLines = ([[p1, dimP1], [p2, dimP2]] as const).map(([p, dimP]) => [
      addPoints(p, scalePoint(n, side * style.extensionGapMM)),
      addPoints(dimP, scalePoint(n, side * style.extensionOvershootMM)),
    ] as [Point, Point]);

    return {
      defPoint1: p1,
      defPoint2: p2,
      dimLinePoint: dimP1,
      textMidpoint: mid,
      text,
      rotationDeg: (Math.atan2(axis.y, axis.x) * 180) / Math.PI,
      aligned: orientation === "aligned",
      extLines,
      dimLine: [dimP1, dimP2],
      arrows: [
        { tip: dimP1, dir: scalePoint(dimAxis, -1) },
        { tip: dimP2, dir: dimAxis },
      ],
      arrowLengthMM: style.arrowLengthMM,
      arrowWidthMM: style.arrowWidthMM,
      textSizeMM: style.textSizeMM,
    };
  }
}

/** One arrowhead of a dimension's block picture: its `tip` point and unit `dir`ection of travel. */
export interface DimensionArrow {
  /** The arrowhead tip point. */
  tip: Point;
  /** Unit vector the arrowhead points along. */
  dir: Point;
}

/** The geometry + definition a `LinearDimension` exposes for native DXF `DIMENSION` export (see {@link LinearDimension.dimensionData}). */
export interface LinearDimensionDXFData {
  /** First extension-line origin (DXF group 13/23) — the feature point `p1`. */
  defPoint1: Point;
  /** Second extension-line origin (DXF group 14/24) — the feature point `p2`. */
  defPoint2: Point;
  /** A point on the dimension line (DXF group 10/20). */
  dimLinePoint: Point;
  /** Text midpoint (DXF group 11/21). */
  textMidpoint: Point;
  /** The measurement text (nominal value plus any inline tolerance). */
  text: string;
  /** Dimension-line rotation, in degrees. */
  rotationDeg: number;
  /** Whether this is an aligned dimension (DXF dimtype 1) vs. rotated (dimtype 0). */
  aligned: boolean;
  /** The two extension-line segments, for the anonymous block picture. */
  extLines: [Point, Point][];
  /** The dimension-line segment, for the block picture. */
  dimLine: [Point, Point];
  /** The two arrowheads (tip + unit direction), for the block picture. */
  arrows: DimensionArrow[];
  /** Arrowhead length (mm), for drawing the block arrows. */
  arrowLengthMM: number;
  /** Arrowhead base width (mm), for drawing the block arrows. */
  arrowWidthMM: number;
  /** Text height (mm), for the block's MTEXT. */
  textSizeMM: number;
}
