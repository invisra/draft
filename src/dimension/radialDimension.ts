import { point, scalePoint, addPoints, type Point } from "../geometry/point.js";
import { applyViewTransform, viewScale, type Renderable, type RenderContext } from "../svg/renderable.js";
import { appendDual } from "./dual.js";
import type { DimensionDXFData, DimensionDefPoint, DimensionPicture } from "./dxfData.js";
import { formatMeasurement } from "./format.js";
import { computeLeaderGeometry, renderElbowLeader, type LeaderOptions } from "./leader.js";
import { estimateTextWidth, renderBasicBox } from "./label.js";
import { mergeDimensionDefaults, resolveDimensionStyle, type ResolvedDimensionStyle } from "./style.js";
import { formatToleranceText, type ToleranceOptions } from "./tolerance.js";

/** Options for a {@link RadialDimension} or {@link DiameterDimension}. */
export interface RadialDimensionOptions extends LeaderOptions, ToleranceOptions {
  /** Direction (degrees, 0 = +X axis) the leader points, from the circle's surface outward. */
  angleDeg: number;
  /** Overrides the auto-formatted value (before any tolerance suffix — pass the full label including R/⌀ if used). */
  text?: string;
  /** ASME Y14.5 §3.3.6 spherical feature: prefixes the value with `S` — `SR` on a {@link RadialDimension}, `S⌀` on a {@link DiameterDimension}. Ignored when `text` is given. */
  spherical?: boolean;
}

function pointOnCircle(center: Point, radius: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return addPoints(center, scalePoint(point(Math.cos(rad), Math.sin(rad)), radius));
}

/** The leader + text, plus a basic-dimension box around the text if requested — `renderElbowLeader` itself has no concept of a box, so this draws one as a separate overlay using the same geometry it computes internally. */
function renderLeaderLabel(start: Point, angleDeg: number, text: string, options: RadialDimensionOptions): string {
  const style = resolveDimensionStyle(options);
  const leader = renderElbowLeader(start, angleDeg, text, options);
  if (!options.basic) return leader;

  const geometry = computeLeaderGeometry(start, angleDeg, options);
  const padding = style.textSizeMM * 0.3;
  const width = estimateTextWidth(text, style.textSizeMM);
  const height = style.textSizeMM * 1.4;
  const box = renderBasicBox(geometry.textX, geometry.shoulderEnd.y, width, height, geometry.textAnchor, padding, style.color, style.strokeWidthMM);
  return [leader, box].join("\n");
}

/**
 * The native-DXF data for a leader-style radius/diameter dimension: the leader line + elbow +
 * shoulder + arrowhead picture, the value text, and the DXF definition points. Shared by
 * {@link RadialDimension} and {@link DiameterDimension}; computed in model space (no view transform).
 */
function leaderDimensionDXF(
  start: Point,
  angleDeg: number,
  text: string,
  dimType: number,
  defPoints: DimensionDefPoint[],
  options: RadialDimensionOptions,
  style: ResolvedDimensionStyle,
): DimensionDXFData {
  const geometry = computeLeaderGeometry(start, angleDeg, options);
  const rad = (angleDeg * Math.PI) / 180;
  const outward = point(Math.cos(rad), Math.sin(rad));
  const width = estimateTextWidth(text, style.textSizeMM);
  const textCenter = point(geometry.textX + (geometry.shoulderSign * width) / 2, geometry.shoulderEnd.y);
  const picture: DimensionPicture[] = [
    { kind: "line", a: start, b: geometry.elbow },
    { kind: "line", a: geometry.elbow, b: geometry.shoulderEnd },
  ];
  if (options.arrow !== false) picture.push({ kind: "arrow", tip: start, dir: scalePoint(outward, -1) });
  picture.push({ kind: "text", center: textCenter, text, sizeMM: style.textSizeMM });
  return {
    dimType,
    dimLinePoint: start,
    textMidpoint: textCenter,
    text,
    defPoints,
    picture,
    textSizeMM: style.textSizeMM,
    arrowLengthMM: style.arrowLengthMM,
    arrowWidthMM: style.arrowWidthMM,
  };
}

/** A radius ("R 4.00") leader dimension, touching the arc at `angleDeg` from center. */
export class RadialDimension implements Renderable {
  constructor(
    private readonly center: Point,
    private readonly radius: number,
    private readonly options: RadialDimensionOptions,
  ) {}

  toSVG(context?: RenderContext): string {
    const options = mergeDimensionDefaults(this.options, context?.dimensionDefaults);
    const style = resolveDimensionStyle(options);
    // center/radius map to paper (geometry scales); the label reports the true model radius
    const center = applyViewTransform(this.center, context?.transform);
    const arcPoint = pointOnCircle(center, this.radius * viewScale(context?.transform), options.angleDeg);
    const prefix = options.spherical ? "SR" : "R";
    const nominalText = options.text ?? `${prefix}${formatMeasurement(this.radius, style)}`;
    const primary = formatToleranceText(nominalText, options, style);
    const text = options.text === undefined ? appendDual(primary, this.radius, prefix, options, options) : primary;
    return renderLeaderLabel(arcPoint, options.angleDeg, text, options);
  }

  /** Data for a native DXF `DIMENSION` (dimtype 4, radius): group 10 on the circle, group 15 at the center. Computed in model space. */
  dimensionDXF(): DimensionDXFData {
    const style = resolveDimensionStyle(this.options);
    const arcPoint = pointOnCircle(this.center, this.radius, this.options.angleDeg);
    const prefix = this.options.spherical ? "SR" : "R";
    const nominalText = this.options.text ?? `${prefix}${formatMeasurement(this.radius, style)}`;
    const primary = formatToleranceText(nominalText, this.options, style);
    const text = this.options.text === undefined ? appendDual(primary, this.radius, prefix, this.options, this.options) : primary;
    return leaderDimensionDXF(arcPoint, this.options.angleDeg, text, 4, [{ code: 15, point: this.center }], this.options, style);
  }
}

/** A diameter ("⌀ 8.00") leader dimension, touching the circle at `angleDeg` from center. */
export class DiameterDimension implements Renderable {
  constructor(
    private readonly center: Point,
    private readonly radius: number,
    private readonly options: RadialDimensionOptions,
  ) {}

  toSVG(context?: RenderContext): string {
    const options = mergeDimensionDefaults(this.options, context?.dimensionDefaults);
    const style = resolveDimensionStyle(options);
    const center = applyViewTransform(this.center, context?.transform);
    const arcPoint = pointOnCircle(center, this.radius * viewScale(context?.transform), options.angleDeg);
    const prefix = options.spherical ? "S⌀" : "⌀";
    const nominalText = options.text ?? `${prefix}${formatMeasurement(this.radius * 2, style)}`;
    const primary = formatToleranceText(nominalText, options, style);
    const text = options.text === undefined ? appendDual(primary, this.radius * 2, prefix, options, options) : primary;
    return renderLeaderLabel(arcPoint, options.angleDeg, text, options);
  }

  /** Data for a native DXF `DIMENSION` (dimtype 3, diameter): group 10 on the circle, group 15 at the diametrically opposite point. Computed in model space. */
  dimensionDXF(): DimensionDXFData {
    const style = resolveDimensionStyle(this.options);
    const arcPoint = pointOnCircle(this.center, this.radius, this.options.angleDeg);
    const opposite = pointOnCircle(this.center, this.radius, this.options.angleDeg + 180);
    const prefix = this.options.spherical ? "S⌀" : "⌀";
    const nominalText = this.options.text ?? `${prefix}${formatMeasurement(this.radius * 2, style)}`;
    const primary = formatToleranceText(nominalText, this.options, style);
    const text = this.options.text === undefined ? appendDual(primary, this.radius * 2, prefix, this.options, this.options) : primary;
    return leaderDimensionDXF(arcPoint, this.options.angleDeg, text, 3, [{ code: 15, point: opposite }], this.options, style);
  }
}
