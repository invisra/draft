import { lineIntersection } from "./intersect.js";
import { addPoints, normalize, perpendicular, scalePoint, subtractPoints, type Point } from "./point.js";

interface OffsetEdge {
  a: Point;
  b: Point;
}

/**
 * Offsets a polyline through `points` by a signed `distance`, returning the new
 * vertices. Positive `distance` offsets to the **left** of each edge's
 * direction of travel (90° counterclockwise, matching {@link perpendicular});
 * negative offsets to the right. Each edge is shifted by its normal and adjacent
 * shifted edges are re-intersected to form the new corners (a miter join);
 * parallel neighbours fall back to the plain shifted point.
 *
 * `closed` treats the polyline as a ring (last point joins back to the first).
 * This is a straight miter offset — very sharp reflex corners produce long
 * spikes, and it doesn't self-intersection-clean, so it's best on gentle
 * outlines (a typical use is deriving a concentric border or clearance
 * boundary). Needs at least 2 points.
 */
export function offsetPolyline(points: readonly Point[], distance: number, closed = false): Point[] {
  const n = points.length;
  if (n < 2) throw new Error("offsetPolyline requires at least 2 points");
  const edgeCount = closed ? n : n - 1;

  const offsetEdges: OffsetEdge[] = [];
  for (let i = 0; i < edgeCount; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    const normal = scalePoint(perpendicular(normalize(subtractPoints(b, a))), distance);
    offsetEdges.push({ a: addPoints(a, normal), b: addPoints(b, normal) });
  }

  const cornerAt = (prevEdge: OffsetEdge, nextEdge: OffsetEdge): Point =>
    lineIntersection(prevEdge.a, prevEdge.b, nextEdge.a, nextEdge.b) ?? nextEdge.a;

  const result: Point[] = [];
  if (closed) {
    for (let i = 0; i < n; i++) {
      result.push(cornerAt(offsetEdges[(i - 1 + n) % n]!, offsetEdges[i]!));
    }
  } else {
    result.push(offsetEdges[0]!.a);
    for (let i = 1; i < n - 1; i++) {
      result.push(cornerAt(offsetEdges[i - 1]!, offsetEdges[i]!));
    }
    result.push(offsetEdges[edgeCount - 1]!.b);
  }
  return result;
}
