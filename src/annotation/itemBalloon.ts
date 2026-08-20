import { circle as circleShape } from "../geometry/shapes.js";
import { addPoints, point, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";
import { TextElement } from "../svg/text.js";
import { computeLeaderGeometry, leaderLineElements, type LeaderOptions } from "../dimension/leader.js";
import { resolveDimensionStyle } from "../dimension/style.js";

/** Options for an {@link ItemBalloon}. */
export interface ItemBalloonOptions extends LeaderOptions {
  /** Direction (degrees, 0 = +X axis) the leader points, from the part outward to the balloon. */
  angleDeg: number;
  /**
   * How the leader terminates at `touchPoint`: `"dot"` (default) for pointing at a general
   * surface/area, `"arrow"` for pointing precisely at an edge/profile — the conventional
   * distinction between the two leader-terminus styles.
   */
  terminus?: "dot" | "arrow";
  /** Balloon circle radius. Defaults to ~1.1x the text size. */
  radiusMM?: number;
}

/**
 * A circled item/find number with a leader — the "balloon" that cross-references a part in an
 * assembly view to its row in a `BOMTable`. Built on the same elbow-leader geometry as
 * `Callout`/`DetailViewCallout`; the circle sits at the end of the leader's horizontal shoulder, its
 * near edge touching the shoulder so the leader visually runs into it.
 */
export class ItemBalloon implements Renderable, Explodable {
  constructor(
    private readonly touchPoint: Point,
    private readonly itemNumber: string | number,
    private readonly options: ItemBalloonOptions,
  ) {}

  /** The balloon's constituent primitives, in draw order (leader line, terminus dot, circle, item number). */
  toElements(): DxfPrimitive[] {
    const { touchPoint, options } = this;
    const style = resolveDimensionStyle(options);
    const terminus = options.terminus ?? "dot";
    const radiusMM = options.radiusMM ?? style.textSizeMM * 1.1;
    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };

    const geometry = computeLeaderGeometry(touchPoint, options.angleDeg, options);
    const parts: DxfPrimitive[] = [...leaderLineElements(touchPoint, options.angleDeg, geometry, { ...options, arrow: terminus === "arrow" })];

    if (terminus === "dot") {
      parts.push(new DrawingElement(circleShape(touchPoint.x, touchPoint.y, style.strokeWidthMM * 1.5), { fill: style.color, stroke: "none" }));
    }

    const circleCenter = addPoints(geometry.shoulderEnd, point(geometry.shoulderSign * radiusMM, 0));
    parts.push(new DrawingElement(circleShape(circleCenter.x, circleCenter.y, radiusMM), strokeOptions));
    parts.push(
      new TextElement({ x: circleCenter.x, y: circleCenter.y - style.textSizeMM * 0.35 }, `${this.itemNumber}`, {
        size: style.textSizeMM,
        anchor: "middle",
        color: style.color,
      }),
    );

    return parts;
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}
