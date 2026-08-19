import { rectangle } from "../geometry/shapes.js";
import type { Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive } from "../svg/renderable.js";
import { textWidth } from "../svg/fontMetrics.js";
import { TextElement, type TextAnchor } from "../svg/text.js";
import { toMeasurementFormat, type ResolvedMeasurementFormat } from "./format.js";
import { formatLimits, formatToleranceText, type ToleranceOptions } from "./tolerance.js";

/** A rendered dimension label plus its estimated on-page footprint. */
export interface DimensionLabelResult {
  /** The rendered label's SVG markup. */
  svg: string;
  /** Estimated rendered width in mm — the gap size to use when breaking a horizontal/aligned dimension line. */
  width: number;
  /** Estimated rendered height in mm — the gap size to use when breaking a vertical dimension line. */
  height: number;
}

/** A dimension label decomposed into primitives (for DXF export) plus its estimated on-page footprint. */
export interface DimensionLabelElements {
  /** The label's constituent text (and basic-box) primitives. */
  elements: DxfPrimitive[];
  /** Estimated rendered width in mm. */
  width: number;
  /** Estimated rendered height in mm. */
  height: number;
}

/**
 * Estimated rendered width of `text` at font `size` (mm), from the real Adobe AFM
 * per-glyph advance widths (see `fontMetrics.ts`) rather than a flat per-character
 * factor — so digit-heavy values, wide caps (M/W), and the drafting symbols size
 * correctly. Used to size dimension-line gaps and the boxes around GD&T frames and
 * basic dimensions. `bold` selects the Helvetica-Bold metrics.
 */
export function estimateTextWidth(text: string, size: number, bold = false): number {
  return textWidth(text, bold ? "Helvetica-Bold" : "Helvetica", size);
}

/**
 * Draws a rectangle around a text run, for the ASME Y14.5 "basic dimension" box. `x`/`y` and
 * `anchor` match the same convention `TextElement` itself uses (`y` is the vertically-centered
 * reference point dimension code already computes baselines from, not a literal baseline), so a
 * box drawn here lines up with the text exactly as previously rendered, without needing to touch
 * that rendering.
 */
export function basicBoxElement(x: number, y: number, width: number, height: number, anchor: TextAnchor, padding: number, color: string, strokeWidthMM: number): DrawingElement {
  const left = anchor === "start" ? x - padding : anchor === "end" ? x - width - padding : x - width / 2 - padding;
  const bottom = y - height / 2 - padding;
  return new DrawingElement(rectangle(left, bottom, width + padding * 2, height + padding * 2), {
    stroke: { color, width: strokeWidthMM },
  });
}

/** SVG form of {@link basicBoxElement}. */
export function renderBasicBox(x: number, y: number, width: number, height: number, anchor: TextAnchor, padding: number, color: string, strokeWidthMM: number): string {
  return basicBoxElement(x, y, width, height, anchor, padding, color, strokeWidthMM).toSVG();
}

/**
 * Renders a dimension's text label, centered at `center`: either a single line
 * (plain nominal, or nominal + inline tolerance), or — for `toleranceDisplay:
 * "limits"` — two stacked lines (upper limit above lower limit, no nominal).
 * Also reports an estimated width, so the caller can size the gap it breaks
 * its dimension line/arc around.
 */
export function dimensionLabelElements(
  center: Point,
  measured: number,
  nominalText: string,
  textSizeMM: number,
  format: number | ResolvedMeasurementFormat,
  color: string,
  toleranceOpts: ToleranceOptions,
  strokeWidthMM = 0.25,
  dual?: string,
): DimensionLabelElements {
  const fmt = toMeasurementFormat(format);
  const underline = toleranceOpts.notToScale ?? false;
  if (toleranceOpts.tolerance !== undefined && toleranceOpts.toleranceDisplay === "limits") {
    const { upper, lower } = formatLimits(measured, toleranceOpts.tolerance, fmt);
    const lineSize = textSizeMM * 0.8;
    const lineGap = lineSize * 1.15;
    const elements: DxfPrimitive[] = [
      new TextElement({ x: center.x, y: center.y + lineGap / 2 - lineSize * 0.35 }, upper, { size: lineSize, anchor: "middle", color, underline }),
      new TextElement({ x: center.x, y: center.y - lineGap / 2 - lineSize * 0.35 }, lower, { size: lineSize, anchor: "middle", color, underline }),
    ];
    return { elements, width: Math.max(estimateTextWidth(upper, lineSize), estimateTextWidth(lower, lineSize)), height: lineGap + lineSize };
  }

  const primary = formatToleranceText(nominalText, toleranceOpts, fmt);
  const text = dual ? `${primary} [${dual}]` : primary;
  const textEl = new TextElement({ x: center.x, y: center.y - textSizeMM * 0.35 }, text, { size: textSizeMM, anchor: "middle", color, underline });
  const width = estimateTextWidth(text, textSizeMM);
  const height = textSizeMM * 1.4;

  if (toleranceOpts.basic) {
    const padding = textSizeMM * 0.3;
    const box = basicBoxElement(center.x, center.y, width, height, "middle", padding, color, strokeWidthMM);
    return { elements: [textEl, box], width: width + padding * 2, height: height + padding * 2 };
  }

  return { elements: [textEl], width, height };
}

/**
 * Renders a dimension's text label, centered at `center`: either a single line
 * (plain nominal, or nominal + inline tolerance), or — for `toleranceDisplay:
 * "limits"` — two stacked lines (upper limit above lower limit, no nominal).
 * Also reports an estimated width, so the caller can size the gap it breaks
 * its dimension line/arc around. See {@link dimensionLabelElements} for the
 * element list the DXF export uses.
 */
export function renderDimensionLabel(
  center: Point,
  measured: number,
  nominalText: string,
  textSizeMM: number,
  format: number | ResolvedMeasurementFormat,
  color: string,
  toleranceOpts: ToleranceOptions,
  strokeWidthMM = 0.25,
  dual?: string,
): DimensionLabelResult {
  const { elements, width, height } = dimensionLabelElements(center, measured, nominalText, textSizeMM, format, color, toleranceOpts, strokeWidthMM, dual);
  return { svg: elements.map((el) => el.toSVG()).join("\n"), width, height };
}
