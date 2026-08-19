import type { Path } from "../geometry/path.js";
import type { BoundingBox } from "../geometry/bbox.js";
import { LINE_STYLES, type LineStyleName } from "./lineStyles.js";
import type { RenderContext } from "./renderable.js";
import type { Stroke } from "./style.js";
import { escapeXMLAttr } from "../util.js";

/** Rendering options for a {@link DrawingElement}. */
export interface DrawingElementOptions {
  /** Defaults to the "visible" line style. Pass "none" to omit the stroke entirely. */
  stroke?: Stroke | "none";
  /** Base line-type preset (weight + dash pattern); fields set on `stroke` override it. Defaults to "visible". */
  lineStyle?: LineStyleName;
  /** Fill color (any valid SVG color string). Defaults to "none" (unfilled). */
  fill?: string;
  /** SVG `id` attribute, for CSS/JS targeting downstream. */
  id?: string;
}

/** A single stroked/filled `<path>` — the basic building block for all drawn geometry. */
export class DrawingElement {
  constructor(
    /** The geometry to render. */
    public readonly path: Path,
    /** Stroke/fill rendering options. */
    public readonly options: DrawingElementOptions = {},
  ) {}

  /** Renders this element as a single SVG `<path>`. Geometry is mapped through the active `View` transform (if any); stroke weight and dash pattern stay in paper units. */
  toSVG(context?: RenderContext): string {
    const t = context?.transform;
    const path = t ? this.path.transformed(t.scale, t.translate, t.rotation ?? 0) : this.path;
    const d = path.toSVGPathData();
    const attrs = [`d="${d}"`, `fill="${escapeXMLAttr(this.options.fill ?? "none")}"`];

    const stroke = this.options.stroke;
    if (stroke !== "none") {
      const base = LINE_STYLES[this.options.lineStyle ?? "visible"];
      const color = stroke?.color ?? base.color ?? "black";
      const width = stroke?.width ?? base.width ?? 0.25;
      const dasharray = stroke?.dasharray ?? base.dasharray;
      const linecap = stroke?.linecap ?? base.linecap;
      const linejoin = stroke?.linejoin ?? base.linejoin;
      attrs.push(`stroke="${escapeXMLAttr(color)}"`, `stroke-width="${width}"`);
      if (dasharray) attrs.push(`stroke-dasharray="${dasharray.join(",")}"`);
      if (linecap) attrs.push(`stroke-linecap="${escapeXMLAttr(linecap)}"`);
      if (linejoin) attrs.push(`stroke-linejoin="${escapeXMLAttr(linejoin)}"`);
    }
    if (this.options.id) attrs.push(`id="${escapeXMLAttr(this.options.id)}"`);

    return `<path ${attrs.join(" ")} />`;
  }

  /** The path's exact bounding box in paper space (through any active view transform), or `null` if the path is empty. */
  bounds(context?: RenderContext): BoundingBox | null {
    const t = context?.transform;
    const path = t ? this.path.transformed(t.scale, t.translate, t.rotation ?? 0) : this.path;
    try {
      return path.boundingBox();
    } catch {
      return null; // empty path
    }
  }
}
