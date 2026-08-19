import { Path } from "./path.js";
import type { Point } from "./point.js";

/** Options for {@link fitSpline}. */
export interface SplineOptions {
  /** Close the spline into a smooth loop (the curve also flows smoothly across the seam between the last and first point). Defaults to false. */
  closed?: boolean;
  /**
   * Curve tightness, 0–1: `0` (default) is a standard (loose) Catmull-Rom
   * spline; `1` pulls the tangents to zero so the curve degenerates to straight
   * chords between the points. Values in between trade roundness for tautness.
   */
  tension?: number;
}

/**
 * A smooth cubic-Bézier {@link Path} that passes **through** every point in
 * order — a Catmull-Rom interpolating spline, converted to native cubic Béziers
 * (so it serializes to SVG `C` / native PDF beziers and tessellates for DXF like
 * any other `Path`, with an exact bounding box). Use it for cam profiles, faired
 * outlines, section boundaries, and other free-form curves defined by the points
 * they touch rather than by control handles. For an open spline the end tangents
 * are clamped to the end segments; `closed` wraps them around for a seamless
 * loop. Needs at least two points.
 */
export function fitSpline(points: readonly Point[], options: SplineOptions = {}): Path {
  if (points.length < 2) throw new Error("fitSpline requires at least 2 points");
  const closed = options.closed ?? false;
  const tension = options.tension ?? 0;
  const f = (1 - tension) / 6;
  const n = points.length;

  // Neighbor lookup: wrap for a closed spline, clamp to the ends for an open one.
  const at = (i: number): Point => (closed ? points[((i % n) + n) % n]! : points[Math.max(0, Math.min(n - 1, i))]!);

  const first = points[0]!;
  const path = new Path().moveTo(first.x, first.y);
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) * f;
    const c1y = p1.y + (p2.y - p0.y) * f;
    const c2x = p2.x - (p3.x - p1.x) * f;
    const c2y = p2.y - (p3.y - p1.y) * f;
    path.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }
  if (closed) path.close();
  return path;
}
