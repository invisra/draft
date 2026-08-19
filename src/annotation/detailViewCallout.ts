import { circle as circleShape } from "../geometry/shapes.js";
import { addPoints, point, scalePoint, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";
import { elbowLeaderElements, type LeaderOptions } from "../dimension/leader.js";

/** Options for a {@link DetailViewCallout}. */
export interface DetailViewCalloutOptions extends LeaderOptions {
  /** Direction (degrees, 0 = +X axis) the leader points, from the circle boundary outward to the label. */
  angleDeg: number;
  /** The detail letter, e.g. "A" — renders "DETAIL A". */
  label: string;
  /** Overrides the auto-formatted label text entirely, e.g. "SEE DETAIL A". */
  text?: string;
  /** Circle stroke width. Defaults to the phantom line style's own width. */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

/**
 * An ASME Y14.3 detail-view callout: a phantom-line circle around the area of a source view
 * that's shown enlarged elsewhere, with an elbow leader (arrow touching the circle boundary) to
 * a "DETAIL X" label. Only the marker on the source view — same scope as `CuttingPlaneLine`: it
 * doesn't draw the detail view itself. Title the enlarged view with a {@link ViewLabel}
 * ("DETAIL A", optional "SCALE 2:1").
 */
export class DetailViewCallout implements Renderable, Explodable {
  constructor(
    private readonly center: Point,
    private readonly radius: number,
    private readonly options: DetailViewCalloutOptions,
  ) {}

  /** The callout's constituent primitives, in draw order (phantom circle, then the elbow leader + label). */
  toElements(): DxfPrimitive[] {
    const { center, radius, options } = this;
    const color = options.color ?? "black";
    const rad = (options.angleDeg * Math.PI) / 180;
    const boundaryPoint = addPoints(center, scalePoint(point(Math.cos(rad), Math.sin(rad)), radius));

    const circleEl = new DrawingElement(circleShape(center.x, center.y, radius), {
      lineStyle: "phantom",
      stroke: { color, ...(options.strokeWidthMM !== undefined ? { width: options.strokeWidthMM } : {}) },
    });

    const text = options.text ?? `DETAIL ${options.label}`;
    return [circleEl, ...elbowLeaderElements(boundaryPoint, options.angleDeg, text, options)];
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}
