import { rectangle } from "../geometry/shapes.js";
import { Path } from "../geometry/path.js";
import { addPoints, perpendicular, point, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";
import { TextElement } from "../svg/text.js";

/** Options for a {@link DatumFeatureSymbol}. */
export interface DatumFeatureSymbolOptions {
  /** Direction (degrees, 0 = +X axis) the leader points, from the touched surface outward. */
  angleDeg: number;
  /** Defaults to 8mm. */
  leaderLengthMM?: number;
  /** Defaults to 6mm. */
  boxSizeMM?: number;
  /** Defaults to 0.25mm. */
  strokeWidthMM?: number;
  /** Defaults to `boxSizeMM * 0.55`. */
  textSizeMM?: number;
  /** Defaults to "black". */
  color?: string;
  /** Solid triangle (current common practice) vs. outline. Defaults to true. */
  filled?: boolean;
}

/**
 * A datum feature symbol: a filled triangle touching the referenced surface,
 * a leader, and a boxed datum letter — tags a feature as datum "A", "B", etc.
 * Distinct from a `FeatureControlFrame`'s datum reference compartment, which
 * cites an already-tagged datum rather than establishing one.
 */
export class DatumFeatureSymbol implements Renderable, Explodable {
  constructor(
    private readonly touchPoint: Point,
    private readonly letter: string,
    private readonly options: DatumFeatureSymbolOptions,
  ) {}

  /** The symbol's constituent primitives, in draw order (triangle, leader, box, letter). */
  toElements(): DxfPrimitive[] {
    const strokeWidthMM = this.options.strokeWidthMM ?? 0.25;
    const boxSize = this.options.boxSizeMM ?? 6;
    const textSize = this.options.textSizeMM ?? boxSize * 0.55;
    const leaderLength = this.options.leaderLengthMM ?? 8;
    const color = this.options.color ?? "black";
    const filled = this.options.filled ?? true;
    const triHeight = boxSize * 0.6;
    const triWidth = triHeight * 0.75;

    const rad = (this.options.angleDeg * Math.PI) / 180;
    const dir = point(Math.cos(rad), Math.sin(rad));
    const n = perpendicular(dir);

    const tip = this.touchPoint;
    const baseCenter = addPoints(tip, scalePoint(dir, triHeight));
    const corner1 = addPoints(baseCenter, scalePoint(n, triWidth / 2));
    const corner2 = subtractPoints(baseCenter, scalePoint(n, triWidth / 2));

    const trianglePath = new Path().moveTo(tip.x, tip.y).lineTo(corner1.x, corner1.y).lineTo(corner2.x, corner2.y).close();
    const triangleOptions = filled ? { fill: color, stroke: "none" as const } : { stroke: { color, width: strokeWidthMM } };
    const triangleEl = new DrawingElement(trianglePath, triangleOptions);

    const leaderEnd = addPoints(tip, scalePoint(dir, leaderLength));
    // stop the line at the box's edge, not its center — the box has no fill, so a line
    // running through it would show through and cross the letter
    const lineEnd = subtractPoints(leaderEnd, scalePoint(dir, boxSize / 2));
    const leaderLine = new DrawingElement(new Path().moveTo(baseCenter.x, baseCenter.y).lineTo(lineEnd.x, lineEnd.y), {
      stroke: { color, width: strokeWidthMM },
    });

    const boxPath = rectangle(leaderEnd.x - boxSize / 2, leaderEnd.y - boxSize / 2, boxSize, boxSize);
    const boxEl = new DrawingElement(boxPath, { stroke: { color, width: strokeWidthMM } });
    const letterEl = new TextElement({ x: leaderEnd.x, y: leaderEnd.y - textSize * 0.35 }, this.letter, {
      size: textSize,
      anchor: "middle",
      color,
    });

    return [triangleEl, leaderLine, boxEl, letterEl];
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}
