import { Path } from "../geometry/path.js";
import { addPoints, point, subtractPoints, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import { applyViewTransform, type DxfPrimitive, type Explodable, type Renderable, type RenderContext } from "../svg/renderable.js";
import { TextElement, type TextAnchor } from "../svg/text.js";
import { arrowhead } from "./arrowhead.js";
import { type LeaderOptions } from "./leader.js";
import { mergeDimensionDefaults, resolveDimensionStyle } from "./style.js";

/** Options for a {@link MultiLeader}. */
export interface MultiLeaderOptions extends LeaderOptions {
  /** The convergence point where every leader meets and the horizontal shoulder (leading to the note) begins. */
  landing: Point;
  /** Which way the shoulder + text run from the landing: `1` = right, `-1` = left. Defaults to the side away from the targets. */
  shoulderSign?: 1 | -1;
}

/**
 * A multileader: several leader lines converging from multiple feature points to
 * a single `landing`, then one horizontal shoulder into a shared note — the
 * standard way to tie one callout to several identical features ("4 holes",
 * "typ."). Each leader gets an arrowhead at its target (unless `arrow: false`);
 * `text` may be an array for stacked lines. Targets and landing are model
 * coordinates and map through an active `View`; text/arrow sizes stay in paper
 * units, like every other leader annotation.
 */
export class MultiLeader implements Renderable, Explodable {
  constructor(
    private readonly targets: readonly Point[],
    private readonly text: string | readonly string[],
    private readonly options: MultiLeaderOptions,
  ) {}

  /** The multileader's constituent leader/arrow/shoulder/text primitives, in draw order (view transform baked into geometry). */
  toElements(context?: RenderContext): DxfPrimitive[] {
    const options = mergeDimensionDefaults(this.options, context?.dimensionDefaults);
    const style = resolveDimensionStyle(options);
    const showArrow = options.arrow ?? true;
    const elbowLength = options.elbowLengthMM ?? 4;

    const targets = this.targets.map((t) => applyViewTransform(t, context?.transform));
    const landing = applyViewTransform(options.landing, context?.transform);

    const centroidX = targets.reduce((s, t) => s + t.x, 0) / (targets.length || 1);
    const shoulderSign: 1 | -1 = options.shoulderSign ?? (landing.x >= centroidX ? 1 : -1);
    const shoulderEnd = addPoints(landing, point(shoulderSign * elbowLength, 0));
    const textAnchor: TextAnchor = shoulderSign >= 0 ? "start" : "end";
    const textX = shoulderEnd.x + shoulderSign * 1;

    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };
    const parts: DxfPrimitive[] = [];

    for (const target of targets) {
      parts.push(new DrawingElement(new Path().moveTo(target.x, target.y).lineTo(landing.x, landing.y), strokeOptions));
      if (showArrow) {
        parts.push(arrowhead(target, subtractPoints(target, landing), { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }));
      }
    }

    parts.push(new DrawingElement(new Path().moveTo(landing.x, landing.y).lineTo(shoulderEnd.x, shoulderEnd.y), strokeOptions));

    const lines = typeof this.text === "string" ? [this.text] : this.text;
    const lineSpacing = style.textSizeMM * 1.3;
    lines.forEach((line, i) => {
      parts.push(
        new TextElement({ x: textX, y: shoulderEnd.y - style.textSizeMM * 0.35 - i * lineSpacing }, line, {
          size: style.textSizeMM,
          anchor: textAnchor,
          color: style.color,
        }),
      );
    });

    return parts;
  }

  toSVG(context?: RenderContext): string {
    return this.toElements(context)
      .map((el) => el.toSVG())
      .join("\n");
  }
}
