import { point, type Point } from "../geometry/point.js";
import type { BoundingBox } from "../geometry/bbox.js";
import { applyViewTransform, type RenderContext } from "./renderable.js";
import { textWidth } from "./fontMetrics.js";
import { escapeXMLAttr, escapeXMLText, formatNumber } from "../util.js";

/** SVG `text-anchor` value: horizontal alignment relative to a text element's position. */
export type TextAnchor = "start" | "middle" | "end";
/** "middle"/"hanging" rely on dominant-baseline, which some SVG renderers (e.g. librsvg) ignore. Prefer "auto" with a manually computed y for portability. */
export type TextBaseline = "auto" | "middle" | "hanging";

/** Rendering options for a {@link TextElement}. */
export interface TextOptions {
  /** Font size in millimeters. */
  size?: number;
  /** Horizontal alignment relative to `position`. Defaults to "start". */
  anchor?: TextAnchor;
  /** Vertical alignment relative to `position`. Defaults to "auto". */
  baseline?: TextBaseline;
  /** CSS font-family string. Defaults to `"Arial, sans-serif"`. */
  fontFamily?: string;
  /** Text color (any valid SVG color string). Defaults to "black". */
  color?: string;
  /** Defaults to "normal". */
  weight?: "normal" | "bold";
  /** Underlines the text (SVG `text-decoration`). Used for ASME Y14.5 not-to-scale dimension values. Defaults to false. */
  underline?: boolean;
  /** SVG `id` attribute, for CSS/JS targeting downstream. */
  id?: string;
  /**
   * Baseline-to-baseline spacing (mm) between lines of multi-line text. Defaults to
   * `size * 1.2`. Applies only when the content spans more than one line (hard `\n`
   * breaks or wrapping via {@link TextOptions.maxWidthMM}).
   */
  lineHeightMM?: number;
  /**
   * Word-wrap width (mm). When set, each hard-break segment is greedily wrapped to
   * lines no wider than this (measured with the same AFM metrics as `bounds`); a
   * single word wider than the limit is kept whole on its own line. Omit for no
   * wrapping (only explicit `\n` breaks the text).
   */
  maxWidthMM?: number;
}

/**
 * A run of text — one line by default, or several when the content carries hard
 * `\n` breaks or is word-wrapped to {@link TextOptions.maxWidthMM}. Sheets render
 * their contents Y-up (see Sheet/renderSVGDocument), which would otherwise flip
 * text upside down — this element carries its own local counter-flip so callers
 * can just give it a Y-up position and get upright text. Multi-line content stacks
 * downward from `position` (the first line's reference point) by
 * {@link TextOptions.lineHeightMM}, in paper units (line spacing, like text size,
 * does not scale with a `View`).
 */
export class TextElement {
  constructor(
    /** Y-up reference position of the first line; interpreted per `options.anchor`/`options.baseline`. */
    public readonly position: Point,
    /** The text to render. May contain `\n` for hard line breaks. */
    public readonly content: string,
    /** Font/color/alignment options. */
    public readonly options: TextOptions = {},
  ) {}

  /**
   * The content resolved into display lines: split on hard `\n` breaks, then each
   * segment greedily word-wrapped to {@link TextOptions.maxWidthMM} (when set) using
   * the same AFM metrics as {@link bounds}. Always at least one line (`[""]` for
   * empty content). Shared by SVG/PDF/DXF export and `bounds`.
   */
  lines(): string[] {
    const { size = 3, weight = "normal", maxWidthMM } = this.options;
    const segments = this.content.split("\n");
    if (!maxWidthMM || maxWidthMM <= 0) return segments;
    const font = weight === "bold" ? "Helvetica-Bold" : "Helvetica";
    const out: string[] = [];
    for (const segment of segments) {
      const words = segment.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        out.push("");
        continue;
      }
      let current = "";
      for (const word of words) {
        const trial = current ? `${current} ${word}` : word;
        if (current && textWidth(trial, font, size) > maxWidthMM) {
          out.push(current);
          current = word;
        } else {
          current = trial;
        }
      }
      out.push(current);
    }
    return out;
  }

  /** Baseline-to-baseline line spacing (mm), resolved from `options.lineHeightMM` or `size * 1.2`. */
  private lineHeightMM(): number {
    const size = this.options.size ?? 3;
    return this.options.lineHeightMM ?? size * 1.2;
  }

  /** Renders one already-positioned line as a counter-flip `<g><text>`. */
  private renderLine(text: string, position: Point): string {
    const { size = 3, anchor = "start", baseline = "auto", fontFamily = "Arial, sans-serif", color = "black", weight = "normal", underline = false, id } =
      this.options;
    const attrs = [
      `font-size="${formatNumber(size)}"`,
      `text-anchor="${escapeXMLAttr(anchor)}"`,
      `dominant-baseline="${escapeXMLAttr(baseline)}"`,
      `font-family="${escapeXMLAttr(fontFamily)}"`,
      `fill="${escapeXMLAttr(color)}"`,
      `font-weight="${escapeXMLAttr(weight)}"`,
    ];
    if (underline) attrs.push(`text-decoration="underline"`);
    if (id) attrs.push(`id="${escapeXMLAttr(id)}"`);
    const x = formatNumber(position.x);
    const y = formatNumber(position.y);
    return `<g transform="translate(${x} ${y}) scale(1,-1)"><text x="0" y="0" ${attrs.join(" ")}>${escapeXMLText(text)}</text></g>`;
  }

  /**
   * Renders this text as one SVG `<text>` element (in a counter-flip `<g>`) per
   * line. The first line's position is mapped through the active `View` transform
   * (if any); subsequent lines stack downward in paper units. The text size stays
   * in paper units.
   */
  toSVG(context?: RenderContext): string {
    const base = applyViewTransform(this.position, context?.transform);
    const lineHeight = this.lineHeightMM();
    return this.lines()
      .map((text, i) => this.renderLine(text, point(base.x, base.y - i * lineHeight)))
      .join("\n");
  }

  /**
   * An approximate paper-space bounding box for this text run: the position mapped
   * through any active view transform, extended by the AFM-estimated width (per the
   * anchor) and one text height per line (stacked downward by the line height). Text
   * stays paper-size and upright, so only the position is transformed. Returns
   * `null` for empty content.
   */
  bounds(context?: RenderContext): BoundingBox | null {
    const lines = this.lines();
    if (lines.every((l) => l === "")) return null;
    const { size = 3, anchor = "start", weight = "normal" } = this.options;
    const font = weight === "bold" ? "Helvetica-Bold" : "Helvetica";
    const base = applyViewTransform(this.position, context?.transform);
    const lineHeight = this.lineHeightMM();
    const width = Math.max(...lines.map((l) => textWidth(l, font, size)));
    const left = anchor === "start" ? base.x : anchor === "end" ? base.x - width : base.x - width / 2;
    const lastY = base.y - (lines.length - 1) * lineHeight;
    return { minX: left, minY: lastY - size / 2, maxX: left + width, maxY: base.y + size / 2 };
  }
}
