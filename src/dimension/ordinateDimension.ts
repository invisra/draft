import { Path } from "../geometry/path.js";
import { circle } from "../geometry/shapes.js";
import type { BoundingBox } from "../geometry/bbox.js";
import { addPoints, point, scalePoint, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import { applyViewTransform, viewScale, type DxfPrimitive, type Explodable, type Renderable, type RenderContext } from "../svg/renderable.js";
import { fromMM } from "../units.js";
import type { DimensionDXFData, DimensionPicture } from "./dxfData.js";
import { formatMeasurement } from "./format.js";
import { renderDimensionLabel } from "./label.js";
import { DEFAULT_DIMENSION_STYLE, mergeDimensionDefaults, resolveDimensionStyle, type DimensionStyle } from "./style.js";
import { formatToleranceText, type ToleranceOptions } from "./tolerance.js";

/** Which coordinate an {@link OrdinateDimension} reads out from the origin: `"x"` (horizontal position) or `"y"` (vertical position). */
export type OrdinateAxis = "x" | "y";

/** Options for an {@link OrdinateDimension}. */
export interface OrdinateDimensionOptions extends DimensionStyle, ToleranceOptions {
  /** Which coordinate to read out from the origin. */
  axis: OrdinateAxis;
  /**
   * Signed length of the extension line running from the feature out to the
   * value readout, perpendicular to the measured axis. For `axis: "x"` positive
   * is up (+Y); for `axis: "y"` positive is right (+X).
   */
  offset: number;
  /**
   * Optional lateral dogleg near the readout end, *along* the measured axis, to
   * keep the values of closely-spaced features from overlapping (the standard
   * ordinate "jog"). Signed; 0 (default) draws a straight extension line.
   */
  jog?: number;
  /** Overrides the auto-formatted measured value. */
  text?: string;
}

/**
 * A single ordinate (arrowless) dimension: ASME Y14.5 rectangular-coordinate
 * dimensioning without dimension lines. Draws a plain extension line from
 * `feature` — no arrowheads, no dimension line — ending in the feature's
 * distance from `origin` along one axis, so every feature is dimensioned from a
 * common datum (the origin, value 0). The value honors the style's display
 * `unit`/`zeroHandling`, and text is kept horizontal (unidirectional), same as
 * every other dimension class. Use `jog` (or separate instances) to destagger
 * crowded readouts.
 */
export class OrdinateDimension implements Renderable {
  constructor(
    private readonly origin: Point,
    private readonly feature: Point,
    private readonly options: OrdinateDimensionOptions,
  ) {}

  toSVG(context?: RenderContext): string {
    const options = mergeDimensionDefaults(this.options, context?.dimensionDefaults);
    const style = resolveDimensionStyle(options);
    const { axis, offset } = options;
    const jog = options.jog ?? 0;
    // origin/feature map to paper; the readout value divides back to true model size
    const origin = applyViewTransform(this.origin, context?.transform);
    const feature = applyViewTransform(this.feature, context?.transform);

    const measured =
      Math.abs((axis === "x" ? feature.x : feature.y) - (axis === "x" ? origin.x : origin.y)) / viewScale(context?.transform);
    const measuredDisplay = fromMM(measured, style.unit);
    const nominalText = options.text ?? formatMeasurement(measured, style);

    // `perp` runs the extension line out to the readout level; `lat` (the measured axis) is the jog direction.
    const perp = axis === "x" ? point(0, 1) : point(1, 0);
    const lat = axis === "x" ? point(1, 0) : point(0, 1);
    const dirSign = Math.sign(offset) || 1;

    const elbow = addPoints(feature, scalePoint(perp, offset));
    const end = addPoints(elbow, scalePoint(lat, jog));
    const textCenter = addPoints(end, scalePoint(perp, dirSign * (style.textGapMM + style.textSizeMM * 0.7)));

    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };
    const parts: string[] = [
      new DrawingElement(new Path().moveTo(feature.x, feature.y).lineTo(elbow.x, elbow.y), strokeOptions).toSVG(),
    ];
    if (jog !== 0) {
      parts.push(new DrawingElement(new Path().moveTo(elbow.x, elbow.y).lineTo(end.x, end.y), strokeOptions).toSVG());
    }

    const label = renderDimensionLabel(textCenter, measuredDisplay, nominalText, style.textSizeMM, style, style.color, options, style.strokeWidthMM);
    parts.push(label.svg);

    return parts.join("\n");
  }

  /**
   * Data for a native DXF `DIMENSION` (dimtype 6, ordinate; the X-datum bit 64 is set for
   * `axis: "x"`): group 10 at the origin/datum, group 13 at the feature, group 14 at the leader
   * end. Computed in model space (no view transform), so the readout is the true model distance.
   */
  dimensionDXF(): DimensionDXFData {
    const style = resolveDimensionStyle(this.options);
    const { axis, offset } = this.options;
    const jog = this.options.jog ?? 0;
    const { origin, feature } = this;

    const measured = Math.abs((axis === "x" ? feature.x : feature.y) - (axis === "x" ? origin.x : origin.y));
    const nominalText = this.options.text ?? formatMeasurement(measured, style);
    const text = formatToleranceText(nominalText, this.options, style);

    const perp = axis === "x" ? point(0, 1) : point(1, 0);
    const lat = axis === "x" ? point(1, 0) : point(0, 1);
    const dirSign = Math.sign(offset) || 1;
    const elbow = addPoints(feature, scalePoint(perp, offset));
    const end = addPoints(elbow, scalePoint(lat, jog));
    const textCenter = addPoints(end, scalePoint(perp, dirSign * (style.textGapMM + style.textSizeMM * 0.7)));

    const picture: DimensionPicture[] = [{ kind: "line", a: feature, b: elbow }];
    if (jog !== 0) picture.push({ kind: "line", a: elbow, b: end });
    picture.push({ kind: "text", center: textCenter, text, sizeMM: style.textSizeMM });

    return {
      dimType: axis === "x" ? 6 | 64 : 6,
      dimLinePoint: origin,
      textMidpoint: textCenter,
      text,
      defPoints: [
        { code: 13, point: feature },
        { code: 14, point: end },
      ],
      picture,
      textSizeMM: style.textSizeMM,
      arrowLengthMM: style.arrowLengthMM,
      arrowWidthMM: style.arrowWidthMM,
    };
  }
}

/**
 * A group of {@link OrdinateDimension}s reading one axis from a common `origin`
 * — one per point in `features`, all sharing the same `options`. Returns a
 * plain `OrdinateDimension[]` you `.add()` individually, the same "caller
 * controls the collection" pattern as `chainDimension`/`baselineDimension`. To
 * show the datum's own `0`, include `origin` in `features`; add an
 * {@link OrdinateOrigin} at the same point for the standard open-circle origin
 * indicator. Closely-spaced features may still overlap — give those their own
 * instance with a per-feature `jog`, since one shared `jog` shifts them all the
 * same way.
 */
export function ordinateDimensions(origin: Point, features: readonly Point[], options: OrdinateDimensionOptions): OrdinateDimension[] {
  return features.map((f) => new OrdinateDimension(origin, f, options));
}

/** Options for an {@link OrdinateOrigin} indicator. */
export interface OrdinateOriginOptions {
  /** Diameter of the open circle, in paper mm. Defaults to 3 (ASME Y14.5 §10.3 / ISO 129 — roughly 3mm / 0.12in). */
  diameterMM?: number;
  /** Stroke width in mm. Defaults to the dimension style's `strokeWidthMM` (0.25). */
  strokeWidthMM?: number;
  /** Circle color. Defaults to the dimension style's `color` ("black"). */
  color?: string;
}

/**
 * The ASME Y14.5 §10.3 / ISO 129 ordinate **origin indicator**: a small open
 * circle marking the datum (value 0) that rectangular-coordinate (ordinate)
 * dimensions read from. Place one at the origin and pair it with
 * {@link ordinateDimensions}, whose readouts give each feature's distance from
 * this datum. Like arrowheads and text, the circle stays paper-size — its
 * position maps through any active `View` transform, but its diameter does not
 * scale.
 */
export class OrdinateOrigin implements Renderable, Explodable {
  constructor(
    private readonly origin: Point,
    private readonly options: OrdinateOriginOptions = {},
  ) {}

  /** The open circle, built in paper space (the origin already mapped through any view transform). */
  private element(context?: RenderContext): DrawingElement {
    const center = applyViewTransform(this.origin, context?.transform);
    const diameter = this.options.diameterMM ?? 3;
    const color = this.options.color ?? DEFAULT_DIMENSION_STYLE.color;
    const strokeWidthMM = this.options.strokeWidthMM ?? DEFAULT_DIMENSION_STYLE.strokeWidthMM;
    return new DrawingElement(circle(center.x, center.y, diameter / 2), { stroke: { color, width: strokeWidthMM } });
  }

  /** The origin indicator's single circle primitive (view transform baked into geometry). */
  toElements(context?: RenderContext): DxfPrimitive[] {
    return [this.element(context)];
  }

  toSVG(context?: RenderContext): string {
    // Geometry is already in paper space, so render it context-free (no second transform, no scaling).
    return this.element(context).toSVG();
  }

  /** Paper-space bounds of the origin circle (position mapped through any view transform; diameter unscaled). */
  bounds(context?: RenderContext): BoundingBox | null {
    return this.element(context).bounds();
  }
}
