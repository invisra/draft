import { Path } from "../geometry/path.js";
import { addPoints, point, scalePoint, type Point } from "../geometry/point.js";
import { normalizeAngle } from "../geometry/segments.js";
import { DrawingElement } from "../svg/element.js";
import { applyViewTransform, viewScale, type DxfPrimitive, type Explodable, type Renderable, type RenderContext } from "../svg/renderable.js";
import { fromMM } from "../units.js";
import { arrowhead } from "./arrowhead.js";
import { formatMeasurement } from "./format.js";
import { dimensionLabelElements } from "./label.js";
import { mergeDimensionDefaults, resolveDimensionStyle, type DimensionStyle } from "./style.js";
import type { ToleranceOptions } from "./tolerance.js";

/** Options for an {@link ArcLengthDimension}. */
export interface ArcLengthDimensionOptions extends DimensionStyle, ToleranceOptions {
  /** Radial distance (paper mm) from the measured arc out to the dimension arc — like a `LinearDimension`'s `offset`. */
  offset: number;
  /** Sweep direction from `startAngleDeg` to `endAngleDeg`. Defaults to true (CCW), matching `Path.arc`. */
  counterclockwise?: boolean;
  /** Prefix the value with the ASME arc-length symbol `⌒`. Defaults to true. */
  symbol?: boolean;
  /** Overrides the auto-formatted arc-length value (before the `⌒` prefix and any tolerance suffix). */
  text?: string;
}

const tangentAt = (theta: number): Point => point(-Math.sin(theta), Math.cos(theta));
const radialAt = (theta: number): Point => point(Math.cos(theta), Math.sin(theta));

/**
 * An ASME Y14.5 arc-length dimension: radial extension lines from the two ends
 * of an arc out to a **concentric** dimension arc (offset radially outward),
 * broken around a centered, horizontal value with arrowheads tangent to the arc.
 * The value is the true arc length (`radius × sweep`), prefixed with the arc
 * symbol `⌒`. Same `radius`/angle inputs as `Path.arc`, and — like the radial
 * dimensions — the drawn geometry scales inside a `View` while the reported
 * length stays true to the model.
 */
export class ArcLengthDimension implements Renderable, Explodable {
  constructor(
    private readonly center: Point,
    private readonly radius: number,
    private readonly startAngleDeg: number,
    private readonly endAngleDeg: number,
    private readonly options: ArcLengthDimensionOptions,
  ) {}

  /** The dimension's constituent primitives, in draw order (extension lines, broken dimension arc, arrowheads, value label); the view transform is baked into the geometry. */
  toElements(context?: RenderContext): DxfPrimitive[] {
    const options = mergeDimensionDefaults(this.options, context?.dimensionDefaults);
    const style = resolveDimensionStyle(options);
    const ccw = options.counterclockwise ?? true;

    // center/radius map to paper (geometry scales); the value reports the true model arc length.
    const center = applyViewTransform(this.center, context?.transform);
    const drawnRadius = this.radius * viewScale(context?.transform);
    const dimRadius = drawnRadius + options.offset;

    const startRad = (this.startAngleDeg * Math.PI) / 180;
    const endRad = (this.endAngleDeg * Math.PI) / 180;
    const sweep = ccw ? normalizeAngle(endRad - startRad) : normalizeAngle(startRad - endRad);
    // Angles ordered so the arc always runs CCW from a1 to a2 (Path.arc's positive direction).
    const a1 = ccw ? startRad : endRad;
    const a2 = a1 + sweep;

    const arcLength = this.radius * sweep;
    const measuredDisplay = fromMM(arcLength, style.unit);
    const symbol = (options.symbol ?? true) ? "⌒" : "";
    const nominalText = options.text ?? `${symbol}${formatMeasurement(arcLength, style)}`;

    const parts: DxfPrimitive[] = [];
    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };

    // Radial extension lines from just off the arc out past the dimension arc.
    for (const theta of [a1, a2]) {
      const dir = radialAt(theta);
      const extStart = addPoints(center, scalePoint(dir, drawnRadius + style.extensionGapMM));
      const extEnd = addPoints(center, scalePoint(dir, dimRadius + style.extensionOvershootMM));
      parts.push(new DrawingElement(new Path().moveTo(extStart.x, extStart.y).lineTo(extEnd.x, extEnd.y), strokeOptions));
    }

    const midAngle = a1 + sweep / 2;
    const textPoint = addPoints(center, scalePoint(radialAt(midAngle), dimRadius));
    const label = dimensionLabelElements(textPoint, measuredDisplay, nominalText, style.textSizeMM, style, style.color, options, style.strokeWidthMM);
    const halfGapAngle = Math.min((label.width / 2 + style.textGapMM) / dimRadius, sweep / 2);

    const arc1 = new Path().arc({ center, radius: dimRadius, startAngle: a1, endAngle: midAngle - halfGapAngle, counterclockwise: true });
    const arc2 = new Path().arc({ center, radius: dimRadius, startAngle: midAngle + halfGapAngle, endAngle: a2, counterclockwise: true });
    parts.push(new DrawingElement(arc1, strokeOptions));
    parts.push(new DrawingElement(arc2, strokeOptions));

    const arrowP1 = addPoints(center, scalePoint(radialAt(a1), dimRadius));
    const arrowP2 = addPoints(center, scalePoint(radialAt(a2), dimRadius));
    parts.push(arrowhead(arrowP1, scalePoint(tangentAt(a1), -1), { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }));
    parts.push(arrowhead(arrowP2, tangentAt(a2), { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }));

    parts.push(...label.elements);
    return parts;
  }

  toSVG(context?: RenderContext): string {
    return this.toElements(context)
      .map((el) => el.toSVG())
      .join("\n");
  }
}
