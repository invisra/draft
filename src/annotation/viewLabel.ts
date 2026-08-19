import { addPoints, point, scalePoint, type Point } from "../geometry/point.js";
import { Path } from "../geometry/path.js";
import { arrowhead } from "../dimension/arrowhead.js";
import { estimateTextWidth } from "../dimension/label.js";
import { DrawingElement } from "../svg/element.js";
import { applyViewTransform, type DxfPrimitive, type Explodable, type Renderable, type RenderContext } from "../svg/renderable.js";
import { TextElement, type TextAnchor } from "../svg/text.js";

/** Options for a {@link ViewLabel}. */
export interface ViewLabelOptions {
  /** Optional scale caption drawn (smaller) below the title, e.g. `"SCALE 2:1"`. */
  scale?: string;
  /** Title text height in mm. Defaults to 5. */
  textSizeMM?: number;
  /** Scale-caption text height in mm. Defaults to `textSizeMM * 0.6`. */
  scaleSizeMM?: number;
  /** Horizontal alignment relative to `position`. Defaults to `"middle"`. */
  anchor?: TextAnchor;
  /** Draw a thick rule beneath the title (common on ISO / older ASME view titles). Defaults to false. */
  underline?: boolean;
  /** Underline stroke width in mm. Defaults to 0.5. */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

/**
 * A view **title** — `"SECTION A-A"`, `"VIEW A"`, `"DETAIL B"`, and the like — as
 * a bold caption placed beneath (or beside) a drawn view, with an optional
 * smaller `"SCALE 2:1"` caption below it and an optional underline. This is the
 * title the section/detail *markers* (`CuttingPlaneLine`, `DetailViewCallout`)
 * deliberately don't draw: pass the full title string (the caller owns the
 * `SECTION`/`VIEW`/`DETAIL` wording and letter). `position` is the title's
 * reference point (centered by default); the block grows downward.
 */
export class ViewLabel implements Renderable, Explodable {
  constructor(
    private readonly position: Point,
    private readonly title: string,
    private readonly options: ViewLabelOptions = {},
  ) {}

  /** The label's constituent primitives, in draw order (title, optional underline, optional scale caption); the view transform is baked into each position. */
  toElements(context?: RenderContext): DxfPrimitive[] {
    const size = this.options.textSizeMM ?? 5;
    const scaleSize = this.options.scaleSizeMM ?? size * 0.6;
    const anchor = this.options.anchor ?? "middle";
    const color = this.options.color ?? "black";

    const parts: DxfPrimitive[] = [
      new TextElement(applyViewTransform(this.position, context?.transform), this.title, { size, anchor, weight: "bold", color }),
    ];

    if (this.options.underline) {
      // Computed in paper space (position mapped through any view transform); the rule sits just
      // below the title's glyphs, spanning its estimated width per the anchor.
      const base = applyViewTransform(this.position, context?.transform);
      const width = estimateTextWidth(this.title, size, true);
      const left = anchor === "start" ? base.x : anchor === "end" ? base.x - width : base.x - width / 2;
      const ruleY = base.y - size * 0.5;
      const strokeWidthMM = this.options.strokeWidthMM ?? 0.5;
      parts.push(new DrawingElement(new Path().moveTo(left, ruleY).lineTo(left + width, ruleY), { stroke: { color, width: strokeWidthMM } }));
    }

    if (this.options.scale) {
      const scaleY = this.position.y - size * 1.25;
      parts.push(new TextElement(applyViewTransform({ x: this.position.x, y: scaleY }, context?.transform), this.options.scale, { size: scaleSize, anchor, color }));
    }

    return parts;
  }

  toSVG(context?: RenderContext): string {
    return this.toElements(context)
      .map((el) => el.toSVG())
      .join("\n");
  }
}

/** Options for a {@link ViewArrow}. */
export interface ViewArrowOptions {
  /** Direction of sight (degrees, 0 = +X axis) — the arrow points this way, toward what the referenced view looks at. */
  angleDeg: number;
  /** The identifying letter, e.g. `"A"` — the referenced view is titled `"VIEW A"` (build that with {@link ViewLabel}). */
  label: string;
  /** Shaft length in mm. Defaults to 12. */
  lengthMM?: number;
  /** Arrowhead length in mm. Defaults to 3.5. */
  arrowLengthMM?: number;
  /** Arrowhead base width in mm. Defaults to 1.2. */
  arrowWidthMM?: number;
  /** Label text height in mm. Defaults to 5. */
  labelSizeMM?: number;
  /** Shaft/arrow stroke width in mm. Defaults to 0.6 (thick, like a cutting-plane line). */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

/**
 * The ISO 128-30 **arrow (viewing-direction) method** indicator: a thick arrow
 * pointing in the direction of sight with a bold capital letter at its tail,
 * used to call out an auxiliary or other view taken from that direction. The
 * referenced view elsewhere is titled with the same letter (`"VIEW A"`, via
 * {@link ViewLabel}). Distinct from `CuttingPlaneLine`, which is for sections.
 * `tail` is the arrow's start; the tip is `lengthMM` away along `angleDeg`.
 */
export class ViewArrow implements Renderable, Explodable {
  constructor(
    private readonly tail: Point,
    private readonly options: ViewArrowOptions,
  ) {}

  /** The arrow's constituent primitives, in draw order (shaft, arrowhead, label); the view transform is baked into the geometry. */
  toElements(context?: RenderContext): DxfPrimitive[] {
    const length = this.options.lengthMM ?? 12;
    const arrowLength = this.options.arrowLengthMM ?? 3.5;
    const arrowWidth = this.options.arrowWidthMM ?? 1.2;
    const labelSize = this.options.labelSizeMM ?? 5;
    const strokeWidthMM = this.options.strokeWidthMM ?? 0.6;
    const color = this.options.color ?? "black";

    // Geometry maps through any active view transform; sizes stay paper-relative.
    const tail = applyViewTransform(this.tail, context?.transform);
    const rad = (this.options.angleDeg * Math.PI) / 180;
    const dir = point(Math.cos(rad), Math.sin(rad));
    const tip = addPoints(tail, scalePoint(dir, length));

    const strokeOptions = { stroke: { color, width: strokeWidthMM } };
    const labelPos = addPoints(tail, scalePoint(dir, -labelSize * 0.9));

    return [
      new DrawingElement(new Path().moveTo(tail.x, tail.y).lineTo(tip.x, tip.y), strokeOptions),
      arrowhead(tip, dir, { length: arrowLength, width: arrowWidth, color }),
      new TextElement({ x: labelPos.x, y: labelPos.y - labelSize * 0.35 }, this.options.label, {
        size: labelSize,
        anchor: "middle",
        weight: "bold",
        color,
      }),
    ];
  }

  toSVG(context?: RenderContext): string {
    return this.toElements(context)
      .map((el) => el.toSVG())
      .join("\n");
  }
}
