import { type Point } from "../geometry/point.js";
import { isometricProjection, type IsometricPlane } from "../geometry/isometric.js";
import { applyViewTransform, type DxfPrimitive, type Explodable, type Renderable, type RenderContext } from "../svg/renderable.js";
import { TextElement, type TextAnchor } from "../svg/text.js";
import { escapeXMLAttr, escapeXMLText, formatNumber } from "../util.js";

/** Rendering options for {@link IsometricText}. */
export interface IsometricTextOptions {
  /**
   * Which isometric face the text lies on, choosing sensible non-mirrored default reading/height
   * axes: `top` reads along +X (height toward −Y), `right` along +X (height +Z), `left` along −Y
   * (height +Z). Defaults to `"top"`. Ignored when both {@link IsometricTextOptions.right} and
   * {@link IsometricTextOptions.up} are given.
   */
  plane?: IsometricPlane;
  /** Explicit in-plane reading (baseline) direction — a unit vector in the drawing plane. Overrides `plane`; pair with `up`. */
  right?: Point;
  /** Explicit in-plane height (up) direction — a unit vector in the drawing plane. Overrides `plane`; pair with `right`. */
  up?: Point;
  /** Font size in millimeters. Defaults to 3. */
  size?: number;
  /** Horizontal alignment relative to `position`, along the reading direction. Defaults to "start". */
  anchor?: TextAnchor;
  /** CSS font-family string. Defaults to `"Arial, sans-serif"`. */
  fontFamily?: string;
  /** Text color. Defaults to "black". */
  color?: string;
  /** Defaults to "normal". */
  weight?: "normal" | "bold";
  /** SVG `id` attribute. */
  id?: string;
}

const neg = (p: Point): Point => ({ x: -p.x, y: -p.y });

/** The default (non-mirrored) reading/height in-plane unit axes for each isometric face. */
function planeBasis(plane: IsometricPlane): { right: Point; up: Point } {
  const X = isometricProjection({ x: 1, y: 0, z: 0 });
  const Y = isometricProjection({ x: 0, y: 1, z: 0 });
  const Z = isometricProjection({ x: 0, y: 0, z: 1 });
  switch (plane) {
    case "top":
      return { right: X, up: neg(Y) };
    case "right":
      return { right: X, up: Z };
    case "left":
      return { right: neg(Y), up: Z };
  }
}

/**
 * Text lettered **onto an isometric face** — the obliqued lettering a pictorial
 * drawing uses to label faces and add notes that appear to lie in the plane.
 * Unlike a plain upright `TextElement`, this
 * shears the glyphs onto the plane via an SVG matrix built from the face's two
 * in-plane axes. The default axes per `plane` are chosen so text is never
 * mirrored; pass explicit unit `right`/`up` vectors for full control (e.g. the
 * projected axes from `isometricAxisDirections`). `position` is the drawing-plane
 * anchor (mapped through any active `View` transform); the glyph size stays in
 * paper units.
 */
export class IsometricText implements Renderable, Explodable {
  constructor(
    private readonly position: Point,
    private readonly content: string,
    private readonly options: IsometricTextOptions = {},
  ) {}

  /**
   * For DXF export: a single **upright** {@link TextElement} at the (view-transformed) anchor. DXF
   * `TEXT` can't be sheared onto an isometric plane the way {@link toSVG} shears it, so the exported
   * text stands upright at the same anchor point rather than obliqued — the faithful representation
   * the format allows. Unlike most annotations here, `toSVG` is therefore **not** derived from this.
   */
  toElements(context?: RenderContext): DxfPrimitive[] {
    const { size = 3, anchor = "start", fontFamily = "Arial, sans-serif", color = "black", weight = "normal", id } = this.options;
    const p = applyViewTransform(this.position, context?.transform);
    return [new TextElement(p, this.content, { size, anchor, fontFamily, color, weight, ...(id !== undefined ? { id } : {}) })];
  }

  toSVG(context?: RenderContext): string {
    const { size = 3, anchor = "start", fontFamily = "Arial, sans-serif", color = "black", weight = "normal", id } = this.options;
    const basis = this.options.right && this.options.up ? { right: this.options.right, up: this.options.up } : planeBasis(this.options.plane ?? "top");
    const p = applyViewTransform(this.position, context?.transform);

    // Map font space (x right, y down) to the drawing plane: fontRight → `right`, fontUp (−y) → `up`,
    // i.e. matrix(right.x, right.y, −up.x, −up.y, px, py). This composes with the sheet's Y-flip to
    // land the glyphs on the plane, un-mirrored (the default bases have det(right, up) > 0).
    const m = [basis.right.x, basis.right.y, -basis.up.x, -basis.up.y, p.x, p.y].map((n) => formatNumber(n)).join(" ");
    const attrs = [
      `font-size="${formatNumber(size)}"`,
      `text-anchor="${escapeXMLAttr(anchor)}"`,
      `font-family="${escapeXMLAttr(fontFamily)}"`,
      `fill="${escapeXMLAttr(color)}"`,
      `font-weight="${escapeXMLAttr(weight)}"`,
    ];
    if (id) attrs.push(`id="${escapeXMLAttr(id)}"`);
    return `<g transform="matrix(${m})"><text x="0" y="0" ${attrs.join(" ")}>${escapeXMLText(this.content)}</text></g>`;
  }
}
