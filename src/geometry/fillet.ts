import { Path } from "./path.js";
import { addPoints, distance, dot, normalize, scalePoint, subtractPoints, type Point } from "./point.js";
import { normalizeAngle } from "./segments.js";

/** The tangent arc that rounds a corner, as returned by {@link filletCorner}. */
export interface FilletResult {
  /** Center of the tangent arc. */
  center: Point;
  /** Arc radius (mm) — may be less than requested if it was clamped to fit the legs. */
  radius: number;
  /** Where the arc meets the first leg (on the `corner→p1` ray). */
  tangentStart: Point;
  /** Where the arc meets the second leg (on the `corner→p2` ray). */
  tangentEnd: Point;
  /** Arc start angle at `tangentStart` (radians, from +X). */
  startAngle: number;
  /** Arc end angle at `tangentEnd` (radians, from +X). */
  endAngle: number;
  /** Sweep direction from `startAngle` to `endAngle` (true = counterclockwise) — the minor arc. */
  counterclockwise: boolean;
}

/**
 * Computes the arc of radius `radius` that is tangent to both legs of the corner
 * at `corner` (the legs being the rays toward `p1` and `p2`) — the standard
 * "round" / fillet construction. The returned tangent points are where the
 * straight legs should stop and the arc begins. Throws if the corner is
 * straight or degenerate (the legs are collinear), or if `radius` is not
 * positive. `p1`/`p2` only give the leg *directions*; their distance from
 * `corner` doesn't matter.
 */
export function filletCorner(p1: Point, corner: Point, p2: Point, radius: number): FilletResult {
  if (radius <= 0) throw new Error(`Fillet radius must be positive, got ${radius}`);
  const u1 = normalize(subtractPoints(p1, corner));
  const u2 = normalize(subtractPoints(p2, corner));
  const cosTheta = Math.max(-1, Math.min(1, dot(u1, u2)));
  const theta = Math.acos(cosTheta); // included angle between the legs, (0, π)
  if (theta < 1e-9 || Math.PI - theta < 1e-9) {
    throw new Error("Cannot fillet a straight or degenerate corner (legs are collinear)");
  }

  const tangentDist = radius / Math.tan(theta / 2);
  const centerDist = radius / Math.sin(theta / 2);
  const tangentStart = addPoints(corner, scalePoint(u1, tangentDist));
  const tangentEnd = addPoints(corner, scalePoint(u2, tangentDist));
  const bisector = normalize(addPoints(u1, u2)); // points into the corner interior
  const center = addPoints(corner, scalePoint(bisector, centerDist));

  const startAngle = Math.atan2(tangentStart.y - center.y, tangentStart.x - center.x);
  const endAngle = Math.atan2(tangentEnd.y - center.y, tangentEnd.x - center.x);
  // the fillet is always the minor arc (span = π − theta < π): pick the shorter sweep
  const counterclockwise = normalizeAngle(endAngle - startAngle) <= Math.PI;

  return { center, radius, tangentStart, tangentEnd, startAngle, endAngle, counterclockwise };
}

/**
 * A polyline through `points` with every interior corner rounded to `radius`
 * (all corners when `closed`), returned as a single {@link Path} of straight
 * legs joined by tangent arcs — the general-case counterpart to
 * `roundedRectangle`. The radius is clamped per corner so a fillet never
 * overruns half of either adjacent leg (a corner too tight or too straight to
 * round is left sharp). Needs at least 3 points.
 */
export function roundedPolyline(points: readonly Point[], radius: number, closed = false): Path {
  if (points.length < 3) throw new Error("roundedPolyline requires at least 3 points");
  if (radius <= 0) throw new Error(`Fillet radius must be positive, got ${radius}`);
  const n = points.length;
  const cornerIndices = closed ? [...Array(n).keys()] : [...Array(n - 2).keys()].map((i) => i + 1);

  // Per corner, compute a (possibly clamped) fillet, skipping degenerate ones.
  const fillets = new Map<number, FilletResult>();
  for (const i of cornerIndices) {
    const prev = points[(i - 1 + n) % n]!;
    const corner = points[i]!;
    const next = points[(i + 1) % n]!;
    const maxTangent = Math.min(distance(prev, corner), distance(corner, next)) / 2;
    // A zero-length leg (a duplicated consecutive point) can't be filleted — leave it sharp, and
    // guard before normalize(), which throws on a zero-length vector.
    if (maxTangent <= 1e-9) continue;
    const u1 = normalize(subtractPoints(prev, corner));
    const u2 = normalize(subtractPoints(next, corner));
    const theta = Math.acos(Math.max(-1, Math.min(1, dot(u1, u2))));
    if (theta < 1e-6 || Math.PI - theta < 1e-6) continue; // straight/degenerate: leave sharp
    const clampedRadius = Math.min(radius, maxTangent * Math.tan(theta / 2));
    if (clampedRadius <= 1e-9) continue;
    fillets.set(i, filletCorner(prev, corner, next, clampedRadius));
  }

  const path = new Path();
  const arcOf = (f: FilletResult) => ({
    center: f.center,
    radius: f.radius,
    startAngle: f.startAngle,
    endAngle: f.endAngle,
    counterclockwise: f.counterclockwise,
  });

  if (closed) {
    // Start at the first available fillet's tangent end, walk the ring, close.
    const startIdx = cornerIndices.find((i) => fillets.has(i));
    if (startIdx === undefined) {
      // nothing filleted — fall back to a plain closed polyline
      path.moveTo(points[0]!.x, points[0]!.y);
      for (let k = 1; k < n; k++) path.lineTo(points[k]!.x, points[k]!.y);
      return path.close();
    }
    const first = fillets.get(startIdx)!;
    // begin just past the start corner's arc, walk the other corners, then come
    // back and draw the start corner's own arc so every corner is rounded
    path.moveTo(first.tangentEnd.x, first.tangentEnd.y);
    for (let step = 1; step < n; step++) {
      const i = (startIdx + step) % n;
      const f = fillets.get(i);
      if (f) {
        path.lineTo(f.tangentStart.x, f.tangentStart.y);
        path.arc(arcOf(f));
      } else {
        path.lineTo(points[i]!.x, points[i]!.y);
      }
    }
    path.lineTo(first.tangentStart.x, first.tangentStart.y);
    path.arc(arcOf(first));
    return path.close();
  }

  // Open: start at the first endpoint, arc through each interior corner, end at the last.
  path.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < n - 1; i++) {
    const f = fillets.get(i);
    if (f) {
      path.lineTo(f.tangentStart.x, f.tangentStart.y);
      path.arc(arcOf(f));
    } else {
      path.lineTo(points[i]!.x, points[i]!.y);
    }
  }
  path.lineTo(points[n - 1]!.x, points[n - 1]!.y);
  return path;
}
