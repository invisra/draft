import { Path } from "../geometry/path.js";
import { addPoints, normalize, perpendicular, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import { applyViewTransform, type DxfPrimitive, type Explodable, type Renderable, type RenderContext } from "../svg/renderable.js";
import { arrowhead } from "./arrowhead.js";
import { formatMeasurement } from "./format.js";
import { dimensionLabelElements } from "./label.js";
import { mergeDimensionDefaults, resolveDimensionStyle, type DimensionStyle } from "./style.js";
import type { ToleranceOptions } from "./tolerance.js";

/** Options for a {@link JoggedRadiusDimension}. */
export interface JoggedRadiusDimensionOptions extends DimensionStyle, ToleranceOptions {
  /** Size (paper mm) of the zigzag jog. Defaults to 3mm. */
  jogSizeMM?: number;
  /** Where the jog sits along the leader, as a fraction from the arc toward the false center. Defaults to 0.5. */
  jogPosition?: number;
  /** Overrides the auto-formatted value (before the `R` prefix and any tolerance suffix). */
  text?: string;
}

/**
 * A jogged (foreshortened) radius dimension, per ASME Y14.5 §5.9.4: used when an
 * arc's true center is off the sheet, so the radial leader is drawn to a
 * convenient **false center** with a zigzag jog signalling the break in the true
 * radial distance. The arrow touches the arc at `arcPoint`, the leader runs to
 * `falseCenter` with a jog partway, and the label reports the true `radius`
 * (unforeshortened) as `R…`. Both points are model coordinates (they map through
 * an active `View`); the `radius` value is reported as given.
 */
export class JoggedRadiusDimension implements Renderable, Explodable {
  constructor(
    private readonly arcPoint: Point,
    private readonly falseCenter: Point,
    private readonly radius: number,
    private readonly options: JoggedRadiusDimensionOptions,
  ) {}

  /** The dimension's constituent primitives, in draw order (jogged leader, arrowhead, value label); the view transform is baked into the geometry. */
  toElements(context?: RenderContext): DxfPrimitive[] {
    const options = mergeDimensionDefaults(this.options, context?.dimensionDefaults);
    const style = resolveDimensionStyle(options);

    const arcPoint = applyViewTransform(this.arcPoint, context?.transform);
    const falseCenter = applyViewTransform(this.falseCenter, context?.transform);

    const span = subtractPoints(falseCenter, arcPoint);
    const length = Math.hypot(span.x, span.y);
    const u = normalize(span); // arc -> false center
    const n = perpendicular(u);

    const jogPosition = options.jogPosition ?? 0.5;
    const half = Math.min((options.jogSizeMM ?? 3) / 2, length * 0.2);
    const jogCenter = addPoints(arcPoint, scalePoint(u, length * jogPosition));
    const k1 = addPoints(subtractPoints(jogCenter, scalePoint(u, half)), scalePoint(n, half));
    const k2 = subtractPoints(addPoints(jogCenter, scalePoint(u, half)), scalePoint(n, half));

    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };
    const leader = new Path()
      .moveTo(arcPoint.x, arcPoint.y)
      .lineTo(k1.x, k1.y)
      .lineTo(k2.x, k2.y)
      .lineTo(falseCenter.x, falseCenter.y);

    const parts: DxfPrimitive[] = [new DrawingElement(leader, strokeOptions)];
    // Arrow at the arc, pointing outward along the true radial (away from the false center).
    parts.push(arrowhead(arcPoint, scalePoint(u, -1), { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }));

    const nominalText = options.text ?? `R${formatMeasurement(this.radius, style)}`;
    const labelPoint = addPoints(
      scalePoint(addPoints(k2, falseCenter), 0.5),
      scalePoint(n, style.textSizeMM * 0.9 + style.textGapMM),
    );
    const label = dimensionLabelElements(labelPoint, this.radius, nominalText, style.textSizeMM, style, style.color, options, style.strokeWidthMM);
    parts.push(...label.elements);

    return parts;
  }

  toSVG(context?: RenderContext): string {
    return this.toElements(context)
      .map((el) => el.toSVG())
      .join("\n");
  }
}
