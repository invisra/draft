import { Path } from "../geometry/path.js";
import { addPoints, normalize, point, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { normalizeAngle } from "../geometry/segments.js";
import { DrawingElement } from "../svg/element.js";
import { applyViewTransform, type Renderable, type RenderContext } from "../svg/renderable.js";
import { formatFixed } from "../util.js";
import type { DimensionDXFData, DimensionPicture } from "./dxfData.js";
import { formatAngleDMS } from "./format.js";
import { arrowhead } from "./arrowhead.js";
import { estimateTextWidth, renderDimensionLabel } from "./label.js";
import { mergeDimensionDefaults, resolveDimensionStyle, type DimensionStyle } from "./style.js";
import { formatToleranceText, type ToleranceOptions } from "./tolerance.js";

/** Options for an {@link AngularDimension}. */
export interface AngularDimensionOptions extends DimensionStyle, ToleranceOptions {
  /** Radius from the vertex where the dimension arc is drawn. */
  radius: number;
  /** Overrides the auto-formatted angle value (degrees, with the degree symbol appended, before any tolerance suffix). */
  text?: string;
}

const tangentAt = (theta: number): Point => point(-Math.sin(theta), Math.cos(theta));

/**
 * The angle at `vertex` between the ray toward `p1` and the ray toward `p2` (any
 * point along each ray, e.g. an edge endpoint) — measured counterclockwise from
 * the p1 ray to the p2 ray. Draws extension lines from p1/p2 out to a dimension
 * arc broken around centered, horizontal text, with arrowheads tangent to the arc.
 */
export class AngularDimension implements Renderable {
  constructor(
    private readonly vertex: Point,
    private readonly p1: Point,
    private readonly p2: Point,
    private readonly options: AngularDimensionOptions,
  ) {}

  toSVG(context?: RenderContext): string {
    // An angular value is degrees, so it must not inherit a document-wide linear
    // display `unit` (or the 3-place precision that unit implies); visual style
    // and an explicit profile `precision` still flow in.
    const options = { ...mergeDimensionDefaults(this.options, context?.dimensionDefaults) };
    if (this.options.unit === undefined) delete options.unit;
    const style = resolveDimensionStyle(options);
    // map the rays to paper (a uniform view scale preserves angles, so the value is unchanged); the arc radius is a paper-space option
    const vertex = applyViewTransform(this.vertex, context?.transform);
    const p1 = applyViewTransform(this.p1, context?.transform);
    const p2 = applyViewTransform(this.p2, context?.transform);
    const radius = options.radius;

    const v1 = subtractPoints(p1, vertex);
    const v2 = subtractPoints(p2, vertex);
    if (Math.hypot(v1.x, v1.y) < 1e-9 || Math.hypot(v2.x, v2.y) < 1e-9) {
      throw new Error("AngularDimension: p1 and p2 must both differ from the vertex (a ray has zero length)");
    }
    const dir1 = normalize(v1);
    const dir2 = normalize(v2);
    const angle1 = Math.atan2(dir1.y, dir1.x);
    const sweep = normalizeAngle(Math.atan2(dir2.y, dir2.x) - angle1);
    // Parallel rays (sweep ≈ 0 or ≈ 2π) subtend no well-defined angle — otherwise the arc silently
    // becomes a zero-length or near-full-circle sweep. (A deliberate reflex angle is still fine.)
    if (sweep < 1e-9 || sweep > 2 * Math.PI - 1e-9) {
      throw new Error("AngularDimension: the two rays are parallel, so the subtended angle is undefined (0° or 360°)");
    }
    const angle2 = angle1 + sweep;

    const arcP1 = addPoints(vertex, scalePoint(dir1, radius));
    const arcP2 = addPoints(vertex, scalePoint(dir2, radius));

    const degrees = (sweep * 180) / Math.PI;
    const nominalText = options.text ?? (style.angleFormat === "dms" ? formatAngleDMS(degrees) : `${formatFixed(degrees, style.precision)}°`);

    const parts: string[] = [];
    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };

    for (const [p, dir, arcP] of [
      [p1, dir1, arcP1],
      [p2, dir2, arcP2],
    ] as const) {
      const extStart = addPoints(p, scalePoint(dir, style.extensionGapMM));
      const extEnd = addPoints(arcP, scalePoint(dir, style.extensionOvershootMM));
      parts.push(new DrawingElement(new Path().moveTo(extStart.x, extStart.y).lineTo(extEnd.x, extEnd.y), strokeOptions).toSVG());
    }

    const midAngle = angle1 + sweep / 2;
    const textPoint = addPoints(vertex, scalePoint(point(Math.cos(midAngle), Math.sin(midAngle)), radius));
    const label = renderDimensionLabel(textPoint, degrees, nominalText, style.textSizeMM, style.precision, style.color, options, style.strokeWidthMM);
    const halfGapAngle = Math.min((label.width / 2 + style.textGapMM) / radius, sweep / 2);

    const arc1 = new Path().arc({ center: vertex, radius, startAngle: angle1, endAngle: midAngle - halfGapAngle, counterclockwise: true });
    const arc2 = new Path().arc({ center: vertex, radius, startAngle: midAngle + halfGapAngle, endAngle: angle2, counterclockwise: true });
    parts.push(new DrawingElement(arc1, strokeOptions).toSVG());
    parts.push(new DrawingElement(arc2, strokeOptions).toSVG());

    parts.push(
      arrowhead(arcP1, scalePoint(tangentAt(angle1), -1), {
        length: style.arrowLengthMM,
        width: style.arrowWidthMM,
        color: style.color,
      }).toSVG(),
    );
    parts.push(
      arrowhead(arcP2, tangentAt(angle2), { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }).toSVG(),
    );

    parts.push(label.svg);

    return parts.join("\n");
  }

  /**
   * Data for a native DXF `DIMENSION` (dimtype 2, two-line angular): the two extension lines, the
   * (text-broken) dimension arc, tangent arrowheads, and the value text, with the two rays as
   * definition points (groups 13/14 and 15/16). Computed in model space (no view transform); a
   * uniform view scale preserves angles, so the value would be unchanged anyway.
   */
  dimensionDXF(): DimensionDXFData {
    const options = { ...this.options };
    if (this.options.unit === undefined) delete options.unit;
    const style = resolveDimensionStyle(options);
    const { vertex, p1, p2 } = this;
    const radius = options.radius;

    const v1 = subtractPoints(p1, vertex);
    const v2 = subtractPoints(p2, vertex);
    if (Math.hypot(v1.x, v1.y) < 1e-9 || Math.hypot(v2.x, v2.y) < 1e-9) {
      throw new Error("AngularDimension: p1 and p2 must both differ from the vertex (a ray has zero length)");
    }
    const dir1 = normalize(v1);
    const dir2 = normalize(v2);
    const angle1 = Math.atan2(dir1.y, dir1.x);
    const sweep = normalizeAngle(Math.atan2(dir2.y, dir2.x) - angle1);
    if (sweep < 1e-9 || sweep > 2 * Math.PI - 1e-9) {
      throw new Error("AngularDimension: the two rays are parallel, so the subtended angle is undefined (0° or 360°)");
    }
    const angle2 = angle1 + sweep;
    const arcP1 = addPoints(vertex, scalePoint(dir1, radius));
    const arcP2 = addPoints(vertex, scalePoint(dir2, radius));

    const degrees = (sweep * 180) / Math.PI;
    const nominalText = options.text ?? (style.angleFormat === "dms" ? formatAngleDMS(degrees) : `${formatFixed(degrees, style.precision)}°`);
    const text = formatToleranceText(nominalText, options, style);

    const midAngle = angle1 + sweep / 2;
    const textPoint = addPoints(vertex, scalePoint(point(Math.cos(midAngle), Math.sin(midAngle)), radius));
    const width = estimateTextWidth(text, style.textSizeMM);
    const halfGapAngle = Math.min((width / 2 + style.textGapMM) / radius, sweep / 2);

    const picture: DimensionPicture[] = [];
    for (const [p, dir, arcP] of [
      [p1, dir1, arcP1],
      [p2, dir2, arcP2],
    ] as const) {
      const extStart = addPoints(p, scalePoint(dir, style.extensionGapMM));
      const extEnd = addPoints(arcP, scalePoint(dir, style.extensionOvershootMM));
      picture.push({ kind: "line", a: extStart, b: extEnd });
    }
    picture.push({ kind: "arc", center: vertex, radius, startRad: angle1, endRad: midAngle - halfGapAngle });
    picture.push({ kind: "arc", center: vertex, radius, startRad: midAngle + halfGapAngle, endRad: angle2 });
    picture.push({ kind: "arrow", tip: arcP1, dir: scalePoint(tangentAt(angle1), -1) });
    picture.push({ kind: "arrow", tip: arcP2, dir: tangentAt(angle2) });
    picture.push({ kind: "text", center: textPoint, text, sizeMM: style.textSizeMM });

    return {
      dimType: 2,
      dimLinePoint: textPoint,
      textMidpoint: textPoint,
      text,
      defPoints: [
        { code: 13, point: p1 },
        { code: 14, point: arcP1 },
        { code: 15, point: p2 },
        { code: 16, point: arcP2 },
      ],
      picture,
      textSizeMM: style.textSizeMM,
      arrowLengthMM: style.arrowLengthMM,
      arrowWidthMM: style.arrowWidthMM,
    };
  }
}
