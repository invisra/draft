import { addPoints, distance, midpoint, scalePoint, subtractPoints, type Point } from "./point.js";

/** Tolerance (mm) below which a determinant/denominator is treated as zero (collinear points, degenerate constructions). */
const EPS = 1e-9;

/** A circle as a center + radius, returned by {@link circleThrough3Points}. */
export interface Circle {
  /** Circle center. */
  center: Point;
  /** Circle radius (mm). */
  radius: number;
}

/**
 * The unique circle passing through three points — the circumcircle, the classic
 * "arc through three points" construction (fit an arc/hole to three measured
 * points, reconstruct a radius from a chord and a point on it). Returns `null`
 * when the points are collinear (or two coincide), so no finite circle exists.
 * Center is the circumcenter (equidistant from all three); pair it with the
 * distance to any of the points, or with `Path.arc`, to draw the arc.
 */
export function circleThrough3Points(a: Point, b: Point, c: Point): Circle | null {
  // Circumcenter via the standard determinant form; `d` is twice the signed area of triangle abc.
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < EPS) return null; // collinear or coincident
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const center = {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
  return { center, radius: distance(center, a) };
}

/**
 * The two points on a circle where the tangent lines from an **external** point
 * `from` touch it — the tangent-from-a-point construction (draw a leader or a
 * belt line that just grazes a circular boundary). The touch points are the feet
 * of the two tangents; the tangent lines themselves are `from`→each point.
 * Returns both points ordered so the first is on the left of the `from`→`center`
 * axis; a single point (`from` exactly on the circle); or `[]` when `from` is
 * inside the circle (no real tangent). Throws if `radius` is not positive.
 */
export function tangentPointsFromPoint(center: Point, radius: number, from: Point): Point[] {
  if (radius <= 0) throw new Error(`Circle radius must be positive, got ${radius}`);
  const toCenter = subtractPoints(center, from);
  const dist = Math.hypot(toCenter.x, toCenter.y);
  if (dist < radius - EPS) return []; // inside: no tangent
  if (dist <= radius + EPS) {
    // On the circle: the tangent touches at `from` itself.
    return [from];
  }
  // The tangent length and the angle between the from→center axis and each tangent.
  const axis = scalePoint(toCenter, 1 / dist);
  const perp = { x: -axis.y, y: axis.x }; // 90° CCW ("left" of from→center)
  // Touch point = center − radius·(cosα·axis ∓ sinα·perp), with α the half-angle at the circle.
  const cos = radius / dist; // adjacent (radius) over hypotenuse (dist)
  const sin = Math.sqrt(Math.max(1 - cos * cos, 0));
  const along = scalePoint(axis, -radius * cos);
  const off = radius * sin;
  const base = addPoints(center, along);
  return [addPoints(base, scalePoint(perp, off)), subtractPoints(base, scalePoint(perp, off))];
}

/**
 * The perpendicular bisector of the segment `a`-`b`, returned as two points on it
 * (its midpoint, and the midpoint offset one perpendicular step) — for mirroring,
 * finding a circle center from a chord, or constructing symmetric geometry. The
 * returned line has the same length as `a`-`b`, centered on the midpoint. Returns
 * `null` when `a` and `b` coincide (no defined direction).
 */
export function perpendicularBisector(a: Point, b: Point): [Point, Point] | null {
  const span = subtractPoints(b, a);
  const len = Math.hypot(span.x, span.y);
  if (len < EPS) return null;
  const mid = midpoint(a, b);
  const perp = { x: -span.y, y: span.x }; // same length as a-b, rotated 90°
  return [mid, addPoints(mid, perp)];
}

/**
 * The foot of the perpendicular from point `p` onto the **infinite** line through
 * `a` and `b` — the orthogonal projection of `p` (the nearest point on the line,
 * used for offset distances, witness lines, and "drop a perpendicular"
 * constructions). Returns `a` when `a` and `b` coincide (a degenerate line).
 */
export function perpendicularFoot(p: Point, a: Point, b: Point): Point {
  const span = subtractPoints(b, a);
  const lenSq = span.x * span.x + span.y * span.y;
  if (lenSq < EPS) return a;
  const t = ((p.x - a.x) * span.x + (p.y - a.y) * span.y) / lenSq;
  return addPoints(a, scalePoint(span, t));
}
