import type { Point } from "./point.js";

/**
 * Boolean operations on **polygons** (closed rings of points), via the
 * Greiner–Hormann algorithm. Operate on flat `Point[]` rings — flatten a `Path`
 * with arcs/béziers first (`path.flatten()`). Each operation returns zero or
 * more result rings (a difference can produce a hole as a reversed-winding ring,
 * which the even-odd fill rule — as `hatch()` uses — renders correctly).
 *
 * Scope: simple (non-self-intersecting) polygons in general position. Shared
 * vertices / exactly-collinear overlapping edges are degenerate for this
 * algorithm and may give wrong results — nudge one polygon by an epsilon if you
 * hit that. Winding direction of the inputs doesn't matter.
 */

const EPS = 1e-9;

interface Vertex {
  x: number;
  y: number;
  next: Vertex;
  prev: Vertex;
  intersect: boolean;
  neighbour: Vertex | null;
  entry: boolean;
  visited: boolean;
  alpha: number;
}

function makeVertex(x: number, y: number): Vertex {
  const v: Vertex = { x, y, next: null as unknown as Vertex, prev: null as unknown as Vertex, intersect: false, neighbour: null, entry: false, visited: false, alpha: 0 };
  v.next = v;
  v.prev = v;
  return v;
}

/** Builds a circular doubly-linked ring, returning its first vertex and the original (non-intersection) vertices in order. */
function buildRing(points: readonly Point[]): { first: Vertex; originals: Vertex[] } {
  const originals = points.map((p) => makeVertex(p.x, p.y));
  const n = originals.length;
  for (let i = 0; i < n; i++) {
    originals[i]!.next = originals[(i + 1) % n]!;
    originals[i]!.prev = originals[(i - 1 + n) % n]!;
  }
  return { first: originals[0]!, originals };
}

/** Even-odd ray-cast point-in-polygon test (boundary result is undefined — we assume general position). */
function pointInPolygon(p: { x: number; y: number }, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

interface Crossing {
  x: number;
  y: number;
  alpha: number;
  beta: number;
}

/** Proper intersection (both parameters strictly inside 0..1) of segments a→b and c→d, or null. */
function segmentCross(a: Vertex, b: Vertex, c: Vertex, d: Vertex): Crossing | null {
  const dx1 = b.x - a.x;
  const dy1 = b.y - a.y;
  const dx2 = d.x - c.x;
  const dy2 = d.y - c.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < EPS) return null;
  const alpha = ((c.x - a.x) * dy2 - (c.y - a.y) * dx2) / denom;
  const beta = ((c.x - a.x) * dy1 - (c.y - a.y) * dx1) / denom;
  if (alpha <= EPS || alpha >= 1 - EPS || beta <= EPS || beta >= 1 - EPS) return null;
  return { x: a.x + alpha * dx1, y: a.y + alpha * dy1, alpha, beta };
}

/** Inserts an intersection vertex into the ring between original vertices `start` and `end`, keeping intersections sorted by `alpha`. */
function insertBetween(v: Vertex, start: Vertex, end: Vertex): void {
  let curr = start.next;
  while (curr !== end && curr.alpha < v.alpha) curr = curr.next;
  v.next = curr;
  v.prev = curr.prev;
  curr.prev.next = v;
  curr.prev = v;
}

/** Marks each intersection on `ring` as an entry or exit relative to `other`; `flip` inverts the labeling (for union / difference's clip side). */
function markEntryExit(first: Vertex, other: readonly Point[], flip: boolean): void {
  let inside = pointInPolygon(first, other);
  if (flip) inside = !inside;
  let v = first;
  do {
    if (v.intersect) {
      v.entry = !inside;
      inside = !inside;
    }
    v = v.next;
  } while (v !== first);
}

type Operation = "union" | "intersection" | "difference";

/** Handles the case where the two polygons don't cross (one contains the other, or they're disjoint). */
function noCrossingResult(op: Operation, subject: readonly Point[], clip: readonly Point[]): Point[][] {
  const sInC = pointInPolygon(subject[0]!, clip);
  const cInS = pointInPolygon(clip[0]!, subject);
  const subj = [...subject];
  const clp = [...clip];
  if (op === "intersection") {
    if (sInC) return [subj];
    if (cInS) return [clp];
    return [];
  }
  if (op === "union") {
    if (sInC) return [clp];
    if (cInS) return [subj];
    return [subj, clp];
  }
  // difference (subject − clip)
  if (cInS) return [subj, [...clp].reverse()]; // clip punches a hole (reversed winding)
  if (sInC) return [];
  return [subj];
}

function booleanOp(op: Operation, subjectPoints: readonly Point[], clipPoints: readonly Point[]): Point[][] {
  if (subjectPoints.length < 3 || clipPoints.length < 3) return [];
  const subject = buildRing(subjectPoints);
  const clip = buildRing(clipPoints);

  // Phase 1: find and insert intersections, cross-linking the two rings.
  let anyCrossing = false;
  const sn = subject.originals.length;
  const cn = clip.originals.length;
  for (let i = 0; i < sn; i++) {
    const a = subject.originals[i]!;
    const b = subject.originals[(i + 1) % sn]!;
    for (let j = 0; j < cn; j++) {
      const c = clip.originals[j]!;
      const d = clip.originals[(j + 1) % cn]!;
      const x = segmentCross(a, b, c, d);
      if (!x) continue;
      anyCrossing = true;
      const sv = makeVertex(x.x, x.y);
      const cv = makeVertex(x.x, x.y);
      sv.intersect = cv.intersect = true;
      sv.alpha = x.alpha;
      cv.alpha = x.beta;
      sv.neighbour = cv;
      cv.neighbour = sv;
      insertBetween(sv, a, b);
      insertBetween(cv, c, d);
    }
  }

  if (!anyCrossing) return noCrossingResult(op, subjectPoints, clipPoints);

  // Phase 2: entry/exit labeling per operation.
  markEntryExit(subject.first, clipPoints, op === "union");
  markEntryExit(clip.first, subjectPoints, op === "union" || op === "difference");

  // Phase 3: trace result contours.
  const result: Point[][] = [];
  const intersections: Vertex[] = [];
  let v = subject.first;
  do {
    if (v.intersect) intersections.push(v);
    v = v.next;
  } while (v !== subject.first);

  for (const start of intersections) {
    if (start.visited) continue;
    const contour: Point[] = [];
    let current: Vertex = start;
    do {
      current.visited = true;
      if (current.neighbour) current.neighbour.visited = true;
      const forward = current.entry;
      do {
        current = forward ? current.next : current.prev;
        contour.push({ x: current.x, y: current.y });
      } while (!current.intersect);
      current.visited = true;
      current = current.neighbour!;
    } while (current !== start && !current.visited);
    if (contour.length >= 3) result.push(contour);
  }
  return result;
}

/** Union of two polygons (rings of points). Returns the combined outline(s). See the module note for scope. */
export function polygonUnion(subject: readonly Point[], clip: readonly Point[]): Point[][] {
  return booleanOp("union", subject, clip);
}

/** Intersection (overlap) of two polygons. Returns the shared region(s), or `[]` if they don't overlap. */
export function polygonIntersection(subject: readonly Point[], clip: readonly Point[]): Point[][] {
  return booleanOp("intersection", subject, clip);
}

/** Difference `subject − clip`: the part of `subject` outside `clip`. A `clip` fully inside `subject` returns the outer ring plus a reversed hole ring. */
export function polygonDifference(subject: readonly Point[], clip: readonly Point[]): Point[][] {
  return booleanOp("difference", subject, clip);
}

/** Signed area of a polygon ring (positive = counterclockwise); handy for testing/orienting boolean results. */
export function polygonArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}
