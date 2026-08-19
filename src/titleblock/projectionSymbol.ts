import { Path } from "../geometry/path.js";
import { circle as circlePath } from "../geometry/shapes.js";
import { DrawingElement } from "../svg/element.js";
import type { Point } from "../geometry/point.js";

/** ISO 128 / ASME Y14.3 projection method: first-angle or third-angle. */
export type ProjectionAngle = "first-angle" | "third-angle";

/** Options for {@link projectionSymbol}. */
export interface ProjectionSymbolOptions {
  /** Defaults to 0.2mm. */
  strokeWidthMM?: number;
  /** Overall radius of the larger circle, in mm; the rest of the symbol scales from it. */
  size?: number;
}

/**
 * The ISO 128 / ASME Y14.3 projection-method symbol: a truncated cone (frustum), shown
 * in profile as a trapezoid, next to its end-on view as two concentric circles (outer
 * = the cone's large end, inner = its near/small end).
 *
 * Third-angle: the cone's narrow end faces the circles (trapezoid's short side is nearest).
 * First-angle: the cone's wide end faces the circles (trapezoid's long side is nearest).
 *
 * Returns the constituent {@link DrawingElement}s (two circles + the trapezoid), for both SVG
 * ({@link projectionSymbol}) and DXF export.
 */
export function projectionSymbolElements(center: Point, angle: ProjectionAngle, options: ProjectionSymbolOptions = {}): DrawingElement[] {
  const strokeWidth = options.strokeWidthMM ?? 0.2;
  const rOuter = options.size ?? 3.2;
  const rInner = rOuter / 2;
  const gap = rOuter * 0.4;
  const depth = rOuter * 2.5;

  const nearHalf = angle === "third-angle" ? rInner : rOuter;
  const farHalf = angle === "third-angle" ? rOuter : rInner;
  const x1 = center.x + rOuter + gap;
  const x2 = x1 + depth;

  const trapezoid = new Path()
    .moveTo(x1, center.y - nearHalf)
    .lineTo(x1, center.y + nearHalf)
    .lineTo(x2, center.y + farHalf)
    .lineTo(x2, center.y - farHalf)
    .close();

  const strokeOptions = { stroke: { color: "black", width: strokeWidth } };
  return [
    new DrawingElement(circlePath(center.x, center.y, rOuter), strokeOptions),
    new DrawingElement(circlePath(center.x, center.y, rInner), strokeOptions),
    new DrawingElement(trapezoid, strokeOptions),
  ];
}

/** SVG form of {@link projectionSymbolElements} — the ISO 128 / ASME Y14.3 projection-method pictogram. */
export function projectionSymbol(center: Point, angle: ProjectionAngle, options: ProjectionSymbolOptions = {}): string {
  return projectionSymbolElements(center, angle, options)
    .map((el) => el.toSVG())
    .join("\n");
}
