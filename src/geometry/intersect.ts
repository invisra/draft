import { addPoints, scalePoint, subtractPoints, type Point } from "./point.js";

/** Tolerance (mm) below which a determinant/denominator is treated as zero (parallel lines, tangent circles). */
const EPS = 1e-9;

/** 2D cross product (z-component of a×b). Zero when the vectors are parallel. */
function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function dotProduct(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * The intersection of two **infinite** lines, each given by two points on it.
 * Returns `null` when the lines are parallel (or coincident). For bounded
 * segments use {@link segmentIntersection}.
 */
export function lineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const r = subtractPoints(a2, a1);
  const s = subtractPoints(b2, b1);
  const denom = cross(r, s);
  if (Math.abs(denom) < EPS) return null;
  const t = cross(subtractPoints(b1, a1), s) / denom;
  return addPoints(a1, scalePoint(r, t));
}

/**
 * The intersection of two **segments** `a1→a2` and `b1→b2`, or `null` if they
 * don't cross within both spans (or are parallel). Endpoints count as
 * intersections (touching segments intersect). Collinear overlap returns `null`
 * — there's no single crossing point.
 */
export function segmentIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  const r = subtractPoints(a2, a1);
  const s = subtractPoints(b2, b1);
  const denom = cross(r, s);
  if (Math.abs(denom) < EPS) return null;
  const qp = subtractPoints(b1, a1);
  const t = cross(qp, s) / denom;
  const u = cross(qp, r) / denom;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return addPoints(a1, scalePoint(r, t));
}

/** Real roots `t` of the ray `p1 + t·(p2−p1)` hitting the circle, filtered to `keep`. */
function lineCircleParams(p1: Point, p2: Point, center: Point, radius: number, keep: (t: number) => boolean): Point[] {
  const d = subtractPoints(p2, p1);
  const f = subtractPoints(p1, center);
  const a = dotProduct(d, d);
  if (a < EPS) return []; // p1 === p2, not a line
  const b = 2 * dotProduct(f, d);
  const c = dotProduct(f, f) - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < -EPS) return [];
  const sq = Math.sqrt(Math.max(disc, 0));
  const roots = disc < EPS ? [-b / (2 * a)] : [(-b - sq) / (2 * a), (-b + sq) / (2 * a)];
  return roots.filter(keep).map((t) => addPoints(p1, scalePoint(d, t)));
}

/**
 * Where an **infinite** line (through `p1`, `p2`) meets a circle: 0 points
 * (miss), 1 (tangent), or 2 (secant), ordered along `p1→p2`. Throws if
 * `radius` is not positive.
 */
export function lineCircleIntersection(p1: Point, p2: Point, center: Point, radius: number): Point[] {
  if (radius <= 0) throw new Error(`Circle radius must be positive, got ${radius}`);
  return lineCircleParams(p1, p2, center, radius, () => true);
}

/**
 * Where a **segment** `p1→p2` meets a circle: only intersection points that lie
 * within the segment (0, 1, or 2), ordered along `p1→p2`. Throws if `radius` is
 * not positive.
 */
export function segmentCircleIntersection(p1: Point, p2: Point, center: Point, radius: number): Point[] {
  if (radius <= 0) throw new Error(`Circle radius must be positive, got ${radius}`);
  return lineCircleParams(p1, p2, center, radius, (t) => t >= -EPS && t <= 1 + EPS);
}

/**
 * Where two circles meet: 0 points (separate, one inside the other, or coincident),
 * 1 (internally/externally tangent), or 2 (overlapping). The two-point result is
 * ordered so the first point is on the left of the `c1→c2` axis. Throws if either
 * radius is not positive.
 */
export function circleCircleIntersection(c1: Point, r1: number, c2: Point, r2: number): Point[] {
  if (r1 <= 0 || r2 <= 0) throw new Error(`Circle radii must be positive, got ${r1} and ${r2}`);
  const between = subtractPoints(c2, c1);
  const d = Math.hypot(between.x, between.y);
  if (d < EPS) return []; // concentric (coincident when r1===r2): no discrete points
  if (d > r1 + r2 + EPS || d < Math.abs(r1 - r2) - EPS) return []; // too far apart, or one contained in the other
  // Distance from c1 to the chord's midpoint (foot of the radical line) along the c1→c2 axis.
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const axis = scalePoint(between, 1 / d);
  const foot = addPoints(c1, scalePoint(axis, a));
  const hSq = r1 * r1 - a * a;
  if (hSq <= EPS) return [foot]; // tangent: single point
  const h = Math.sqrt(hSq);
  const perp = { x: -axis.y, y: axis.x }; // 90° CCW from the axis (its "left")
  return [addPoints(foot, scalePoint(perp, h)), subtractPoints(foot, scalePoint(perp, h))];
}

/** A straight obstacle that a broken line gaps around (e.g. another dimension/extension line, or a part edge). */
export interface SegmentObstacle {
  /** Discriminant tag. */
  kind: "segment";
  /** One endpoint of the obstacle segment. */
  p1: Point;
  /** The other endpoint of the obstacle segment. */
  p2: Point;
}

/** A circular obstacle that a broken line gaps around (e.g. a hole a dimension line passes over). */
export interface CircleObstacle {
  /** Discriminant tag. */
  kind: "circle";
  /** Center of the obstacle circle. */
  center: Point;
  /** Radius of the obstacle circle. */
  radius: number;
}

/** Something a {@link breakSegmentAtCrossings} line steps around. */
export type LineBreakObstacle = SegmentObstacle | CircleObstacle;

/**
 * Splits the segment `a→b` into the sub-segments that survive after cutting a gap
 * of `gapMM` (centered on each crossing point) wherever it crosses an obstacle —
 * the AutoCAD `DIMBREAK` convention for a dimension or extension line that passes
 * over other geometry. Overlapping gaps merge. Returns `[[a, b]]` unchanged when
 * nothing crosses, and `[]` if the gaps cover the whole segment. A zero-length
 * input segment returns `[]`.
 */
export function breakSegmentAtCrossings(a: Point, b: Point, obstacles: readonly LineBreakObstacle[], gapMM: number): [Point, Point][] {
  const ab = subtractPoints(b, a);
  const lenSq = dotProduct(ab, ab);
  if (lenSq < EPS) return [];
  const len = Math.sqrt(lenSq);
  const paramOf = (p: Point) => dotProduct(subtractPoints(p, a), ab) / lenSq;

  const crossings: number[] = [];
  for (const o of obstacles) {
    if (o.kind === "segment") {
      const pt = segmentIntersection(a, b, o.p1, o.p2);
      if (pt) crossings.push(paramOf(pt));
    } else {
      for (const pt of segmentCircleIntersection(a, b, o.center, o.radius)) crossings.push(paramOf(pt));
    }
  }
  if (crossings.length === 0) return [[a, b]];

  const halfT = gapMM / 2 / len;
  const gaps = crossings
    .map((t): [number, number] => [Math.max(0, t - halfT), Math.min(1, t + halfT)])
    .filter(([s, e]) => e > s)
    .sort((x, y) => x[0] - y[0]);

  const merged: [number, number][] = [];
  for (const g of gaps) {
    const last = merged[merged.length - 1];
    if (last && g[0] <= last[1]) last[1] = Math.max(last[1], g[1]);
    else merged.push([g[0], g[1]]);
  }

  const pointAt = (t: number) => addPoints(a, scalePoint(ab, t));
  const out: [Point, Point][] = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor + EPS) out.push([pointAt(cursor), pointAt(s)]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < 1 - EPS) out.push([pointAt(cursor), pointAt(1)]);
  return out;
}
