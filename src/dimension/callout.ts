import type { Point } from "../geometry/point.js";
import { applyViewTransform, type DxfPrimitive, type Explodable, type Renderable, type RenderContext } from "../svg/renderable.js";
import { elbowLeaderElements, type LeaderOptions } from "./leader.js";
import { mergeDimensionDefaults } from "./style.js";

/** Options for a {@link Callout}. */
export interface CalloutOptions extends LeaderOptions {
  /** Direction (degrees, 0 = +X axis) the leader points, from `point` outward. */
  angleDeg: number;
}

/** A generic elbow-leader callout: an arrow at a point, a leader, and arbitrary text (e.g. "TYP 4X"). */
export class Callout implements Renderable, Explodable {
  constructor(
    private readonly targetPoint: Point,
    private readonly text: string,
    private readonly options: CalloutOptions,
  ) {}

  /** The callout's constituent leader/arrow/text primitives, in draw order (view transform baked into geometry). */
  toElements(context?: RenderContext): DxfPrimitive[] {
    const options = mergeDimensionDefaults(this.options, context?.dimensionDefaults);
    const target = applyViewTransform(this.targetPoint, context?.transform);
    return elbowLeaderElements(target, options.angleDeg, this.text, options);
  }

  toSVG(context?: RenderContext): string {
    return this.toElements(context)
      .map((el) => el.toSVG())
      .join("\n");
  }
}
