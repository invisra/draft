import { addPoints, distance, normalize, perpendicular, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { Path } from "../geometry/path.js";
import { projectIsoPlane, type IsometricPlane } from "../geometry/isometric.js";
import { DrawingElement } from "../svg/element.js";
import { applyViewTransform, type DxfPrimitive, type Explodable, type Renderable, type RenderContext } from "../svg/renderable.js";
import { arrowhead } from "../dimension/arrowhead.js";
import { formatMeasurement } from "../dimension/format.js";
import { mergeDimensionDefaults, resolveDimensionStyle, type DimensionStyle } from "../dimension/style.js";
import { formatToleranceText, type ToleranceOptions } from "../dimension/tolerance.js";
import { IsometricText } from "./isometricText.js";

/** Options for an {@link IsometricLinearDimension}. */
export interface IsometricLinearDimensionOptions extends DimensionStyle, ToleranceOptions {
  /** Which isometric face the dimension lies on — its two endpoints are in that face's 2D `(x, y)` coordinates. */
  plane: IsometricPlane;
  /**
   * Signed perpendicular distance (in face coordinates) from the measured edge out to the dimension
   * line. Positive is 90° counterclockwise from the p1→p2 direction *within the face*.
   */
  offset: number;
  /** Overrides the auto-formatted measured value (before any tolerance/count suffix). */
  text?: string;
}

/** 2D cross product, for the mirror check when orienting the value text. */
function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

/**
 * A linear dimension drawn **on an isometric face**: extension lines, a dimension
 * line, arrowheads, and the value text all lying in the plane. The two endpoints
 * are given in the face's own 2D `(x, y)` coordinates (as with
 * {@link projectIsoPlane}); the measured length is their true in-plane distance,
 * formatted with the usual display `unit`/`zeroHandling`/tolerances. The value is
 * lettered onto the plane with {@link IsometricText} (aligned to the dimension's
 * axis, kept non-mirrored). Arrowheads are drawn flat, pointing along the
 * projected dimension line. SVG/PDF only — a native DXF `DIMENSION` can't
 * represent an isometric view.
 */
export class IsometricLinearDimension implements Renderable, Explodable {
  constructor(
    private readonly p1: Point,
    private readonly p2: Point,
    private readonly options: IsometricLinearDimensionOptions,
  ) {}

  /** The dimension's geometry (extension/dimension lines, arrowheads) plus the obliqued value text, shared by {@link toSVG} and {@link toElements}. */
  private build(context?: RenderContext): { geometry: DrawingElement[]; value: IsometricText } {
    const options = mergeDimensionDefaults(this.options, context?.dimensionDefaults);
    const style = resolveDimensionStyle(options);
    const { plane, offset } = options;
    const side = Math.sign(offset) || 1;

    // Work in face coordinates: the measured axis and its in-plane perpendicular.
    const axis = normalize(subtractPoints(this.p2, this.p1));
    const n = perpendicular(axis);
    const dimP1 = addPoints(this.p1, scalePoint(n, offset));
    const dimP2 = addPoints(this.p2, scalePoint(n, offset));

    // Project a face point to paper, then through any active view transform.
    const pp = (fp: Point): Point => projectIsoPlane(plane, fp);
    const toPaper = (fp: Point): Point => applyViewTransform(pp(fp), context?.transform);

    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };
    const geometry: DrawingElement[] = [];

    // Extension lines (feature point → just past the dimension line, in face coords).
    for (const [feat, dim] of [
      [this.p1, dimP1],
      [this.p2, dimP2],
    ] as const) {
      const extStart = toPaper(addPoints(feat, scalePoint(n, side * style.extensionGapMM)));
      const extEnd = toPaper(addPoints(dim, scalePoint(n, side * style.extensionOvershootMM)));
      geometry.push(new DrawingElement(new Path().moveTo(extStart.x, extStart.y).lineTo(extEnd.x, extEnd.y), strokeOptions));
    }

    // Dimension line + arrowheads (flat, along the projected axis).
    const d1 = toPaper(dimP1);
    const d2 = toPaper(dimP2);
    geometry.push(new DrawingElement(new Path().moveTo(d1.x, d1.y).lineTo(d2.x, d2.y), strokeOptions));
    const dir = normalize(subtractPoints(d2, d1));
    geometry.push(arrowhead(d1, scalePoint(dir, -1), { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }));
    geometry.push(arrowhead(d2, dir, { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }));

    // Value text, obliqued onto the plane, sitting just off the dimension line on the offset side.
    const length = distance(this.p1, this.p2);
    const nominalText = options.text ?? formatMeasurement(length, style);
    const value = formatToleranceText(nominalText, options, style);
    const textFace = addPoints(
      addPoints(this.p1, scalePoint(axis, distance(this.p1, this.p2) / 2)),
      scalePoint(n, offset + side * style.textSizeMM * 0.8),
    );
    // Text reading direction / height as projected in-plane unit vectors (flip up to avoid mirroring).
    const right = normalize(subtractPoints(pp(addPoints(this.p1, axis)), pp(this.p1)));
    let up = normalize(subtractPoints(pp(addPoints(this.p1, n)), pp(this.p1)));
    if (cross(right, up) < 0) up = scalePoint(up, -1);
    const valueText = new IsometricText(pp(textFace), value, {
      right,
      up,
      size: style.textSizeMM,
      anchor: "middle",
      color: style.color,
    });

    return { geometry, value: valueText };
  }

  /**
   * The dimension's constituent primitives for DXF export: the extension/dimension-line and
   * arrowhead geometry, plus the value as an **upright** `TextElement` (see {@link IsometricText.toElements}
   * — DXF text can't be obliqued onto the plane). `toSVG` keeps the obliqued value text.
   */
  toElements(context?: RenderContext): DxfPrimitive[] {
    const { geometry, value } = this.build(context);
    return [...geometry, ...value.toElements(context)];
  }

  toSVG(context?: RenderContext): string {
    const { geometry, value } = this.build(context);
    return [...geometry.map((el) => el.toSVG()), value.toSVG(context)].join("\n");
  }
}
