/** A 2D point/vector in millimeters, Y-up (drafting convention: +X right, +Y up). */
export interface Point {
  /** Millimeters, +X right. */
  readonly x: number;
  /** Millimeters, +Y up. */
  readonly y: number;
}

/** Constructs a {@link Point}. */
export function point(x: number, y: number): Point {
  return { x, y };
}

/** Vector addition, `a + b`. */
export function addPoints(a: Point, b: Point): Point {
  return point(a.x + b.x, a.y + b.y);
}

/** Vector subtraction, `a - b`. */
export function subtractPoints(a: Point, b: Point): Point {
  return point(a.x - b.x, a.y - b.y);
}

/** Scalar multiplication, `p * factor`. */
export function scalePoint(p: Point, factor: number): Point {
  return point(p.x * factor, p.y * factor);
}

/** Euclidean distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The point halfway between `a` and `b`. */
export function midpoint(a: Point, b: Point): Point {
  return point((a.x + b.x) / 2, (a.y + b.y) / 2);
}

/** Rotates `p` by `angleRad` radians (standard math convention: positive = counterclockwise) about `origin`. */
export function rotatePoint(p: Point, angleRad: number, origin: Point = point(0, 0)): Point {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return point(origin.x + dx * cos - dy * sin, origin.y + dx * sin + dy * cos);
}

/** Dot product of two vectors. */
export function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

/** Vector length (Euclidean norm). */
export function magnitude(v: Point): number {
  return Math.hypot(v.x, v.y);
}

/** Returns `v` scaled to unit length. Throws if `v` is the zero vector. */
export function normalize(v: Point): Point {
  const len = magnitude(v);
  if (len === 0) {
    throw new Error("Cannot normalize a zero-length vector");
  }
  return point(v.x / len, v.y / len);
}

/** Rotates a vector 90 degrees counterclockwise. */
export function perpendicular(v: Point): Point {
  return point(-v.y, v.x);
}
