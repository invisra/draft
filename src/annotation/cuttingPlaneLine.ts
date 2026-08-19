import { Path } from "../geometry/path.js";
import { addPoints, point, scalePoint, type Point } from "../geometry/point.js";
import { arrowhead } from "../dimension/arrowhead.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";
import { TextElement } from "../svg/text.js";

/** Options for a {@link CuttingPlaneLine}. */
export interface CuttingPlaneLineOptions {
  /** Direction of sight (degrees, 0 = +X axis) — the direction you look through the cut to see the resulting section. Both end arrows point this way. */
  viewDirectionDeg: number;
  /** Shown at both ends, e.g. "A" for a section later labeled "SECTION A-A". */
  label?: string;
  /** Defaults to 0.6mm (thick, per ASME Y14.2). */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
  /** Length of the perpendicular arrow leg at each end. Defaults to 6mm. */
  legLengthMM?: number;
  /** Defaults to 3.5mm. */
  arrowLengthMM?: number;
  /** Defaults to 1.2mm. */
  arrowWidthMM?: number;
  /** Defaults to 4mm. */
  labelSizeMM?: number;
}

// Long-short-short — the same dash rhythm as the "phantom" line style, but drawn thick (see below).
const DASH_PATTERN: readonly number[] = [24, 1.5, 3, 1.5];

/**
 * A section cutting-plane line per ASME Y14.2/Y14.3: a thick (0.6mm default),
 * long-short-short dashed line through 2 or more points (2 for a straight
 * section, more for an offset/stepped section), with a perpendicular arrow
 * leg and bold label at each end. Arrows point in `viewDirectionDeg` — the
 * direction of sight for the resulting section, i.e. toward the material
 * that's kept/viewed, not toward the viewer standing at the cutting plane.
 */
export class CuttingPlaneLine implements Renderable, Explodable {
  constructor(
    private readonly points: readonly Point[],
    private readonly options: CuttingPlaneLineOptions,
  ) {
    if (points.length < 2) {
      throw new Error("CuttingPlaneLine requires at least 2 points");
    }
  }

  /** The cutting-plane line's constituent primitives, in draw order (the dashed line, then each end's leg, arrowhead, and label). */
  toElements(): DxfPrimitive[] {
    const strokeWidthMM = this.options.strokeWidthMM ?? 0.6;
    const color = this.options.color ?? "black";
    const legLength = this.options.legLengthMM ?? 6;
    const arrowLength = this.options.arrowLengthMM ?? 3.5;
    const arrowWidth = this.options.arrowWidthMM ?? 1.2;
    const labelSize = this.options.labelSizeMM ?? 4;

    const strokeOptions = { stroke: { color, width: strokeWidthMM, dasharray: DASH_PATTERN } };
    const rad = (this.options.viewDirectionDeg * Math.PI) / 180;
    const dir = point(Math.cos(rad), Math.sin(rad));

    const first = this.points[0]!;
    const last = this.points[this.points.length - 1]!;
    const parts: DxfPrimitive[] = [];

    const linePath = new Path().moveTo(first.x, first.y);
    for (const p of this.points.slice(1)) linePath.lineTo(p.x, p.y);
    parts.push(new DrawingElement(linePath, strokeOptions));

    for (const end of [first, last]) {
      const legEnd = addPoints(end, scalePoint(dir, legLength));
      parts.push(new DrawingElement(new Path().moveTo(end.x, end.y).lineTo(legEnd.x, legEnd.y), strokeOptions));
      parts.push(arrowhead(legEnd, dir, { length: arrowLength, width: arrowWidth, color }));
      if (this.options.label) {
        const labelPos = addPoints(legEnd, scalePoint(dir, labelSize * 0.9));
        parts.push(
          new TextElement({ x: labelPos.x, y: labelPos.y - labelSize * 0.35 }, this.options.label, {
            size: labelSize,
            anchor: "middle",
            weight: "bold",
            color,
          }),
        );
      }
    }

    return parts;
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}
