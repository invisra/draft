import { point, type Point } from "./point.js";

/** A straight line segment. */
export interface LineSegment {
  /** Discriminant for the {@link Segment} union. */
  readonly type: "line";
  /** Segment start point. */
  readonly start: Point;
  /** Segment end point. */
  readonly end: Point;
}

/**
 * A circular arc, stored in CAD-style center/radius/angle form (not SVG's
 * endpoint form) so the sweep direction is unambiguous. Angles are radians,
 * measured counterclockwise from the +X axis, matching standard math
 * convention.
 */
export interface ArcSegment {
  /** Discriminant for the {@link Segment} union. */
  readonly type: "arc";
  /** Arc center. */
  readonly center: Point;
  /** Arc radius, in mm. */
  readonly radius: number;
  /** Radians, from the +X axis. */
  readonly startAngle: number;
  /** Radians, from the +X axis. */
  readonly endAngle: number;
  /** Sweep direction from `startAngle` to `endAngle`: `true` = counterclockwise, `false` = clockwise. */
  readonly counterclockwise: boolean;
}

/**
 * An elliptical arc, stored in center parameterization: center, the two
 * semi-axes (`rx` along the ellipse's local X, `ry` along its local Y), the
 * `rotation` of that local frame, and start/end **parametric** angles (the
 * eccentric angle `t` in `P(t) = center + Rot(rotation)·(rx·cos t, ry·sin t)`),
 * not the true geometric angle. Reduces to an {@link ArcSegment} when `rx === ry`.
 */
export interface EllipticalArcSegment {
  /** Discriminant for the {@link Segment} union. */
  readonly type: "ellipticalArc";
  /** Ellipse center. */
  readonly center: Point;
  /** Semi-axis along the ellipse's local X, in mm. */
  readonly rx: number;
  /** Semi-axis along the ellipse's local Y, in mm. */
  readonly ry: number;
  /** Rotation of the ellipse's local X-axis, radians CCW from the world +X axis. */
  readonly rotation: number;
  /** Start parametric (eccentric) angle, radians. */
  readonly startAngle: number;
  /** End parametric (eccentric) angle, radians. */
  readonly endAngle: number;
  /** Sweep direction from `startAngle` to `endAngle`: `true` = counterclockwise (increasing parametric angle). */
  readonly counterclockwise: boolean;
}

/** A cubic Bézier curve segment: from `start` to `end` shaped by two control points. */
export interface CubicBezierSegment {
  /** Discriminant for the {@link Segment} union. */
  readonly type: "bezier";
  /** Curve start point. */
  readonly start: Point;
  /** First control point (governs the departure from `start`). */
  readonly control1: Point;
  /** Second control point (governs the approach to `end`). */
  readonly control2: Point;
  /** Curve end point. */
  readonly end: Point;
}

/** A single segment of a {@link Path}: a {@link LineSegment}, {@link ArcSegment}, {@link EllipticalArcSegment}, or {@link CubicBezierSegment}. */
export type Segment = LineSegment | ArcSegment | EllipticalArcSegment | CubicBezierSegment;

/** Constructs a {@link LineSegment}. */
export function lineSegment(start: Point, end: Point): LineSegment {
  return { type: "line", start, end };
}

/** Constructs an {@link ArcSegment}. Throws if `radius` is not positive. */
export function arcSegment(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  counterclockwise = false,
): ArcSegment {
  if (radius <= 0) {
    throw new Error(`Arc radius must be positive, got ${radius}`);
  }
  return { type: "arc", center, radius, startAngle, endAngle, counterclockwise };
}

/** The point on `arc`'s circle at the given angle (radians). */
export function arcPointAt(arc: ArcSegment, angle: number): Point {
  return point(arc.center.x + arc.radius * Math.cos(angle), arc.center.y + arc.radius * Math.sin(angle));
}

/** Constructs an {@link EllipticalArcSegment}. Throws if `rx` or `ry` is not positive. */
export function ellipticalArcSegment(
  center: Point,
  rx: number,
  ry: number,
  rotation: number,
  startAngle: number,
  endAngle: number,
  counterclockwise = false,
): EllipticalArcSegment {
  if (rx <= 0 || ry <= 0) {
    throw new Error(`Elliptical arc semi-axes must be positive, got rx=${rx}, ry=${ry}`);
  }
  return { type: "ellipticalArc", center, rx, ry, rotation, startAngle, endAngle, counterclockwise };
}

/** The point on `arc`'s ellipse at the given parametric (eccentric) angle (radians). */
export function ellipticalArcPointAt(arc: EllipticalArcSegment, angle: number): Point {
  const cosR = Math.cos(arc.rotation);
  const sinR = Math.sin(arc.rotation);
  const ex = arc.rx * Math.cos(angle);
  const ey = arc.ry * Math.sin(angle);
  return point(arc.center.x + ex * cosR - ey * sinR, arc.center.y + ex * sinR + ey * cosR);
}

/** Constructs a {@link CubicBezierSegment}. */
export function cubicBezierSegment(start: Point, control1: Point, control2: Point, end: Point): CubicBezierSegment {
  return { type: "bezier", start, control1, control2, end };
}

/** The point on a cubic Bézier at parameter `t` in [0, 1] (de Casteljau / direct evaluation). */
export function bezierPointAt(seg: CubicBezierSegment, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return point(
    a * seg.start.x + b * seg.control1.x + c * seg.control2.x + d * seg.end.x,
    a * seg.start.y + b * seg.control1.y + c * seg.control2.y + d * seg.end.y,
  );
}

/** Points needed for an exact bounding box of a cubic Bézier: both endpoints plus the axis-aligned extrema (where dx/dt or dy/dt is zero). */
export function bezierExtremaPoints(seg: CubicBezierSegment): Point[] {
  const points = [seg.start, seg.end];
  const axisExtrema = (p0: number, c1: number, c2: number, p3: number): number[] => {
    // B'(t)/3 = a·t² + b·t + c, with A=c1−p0, Bb=c2−c1, C=p3−c2
    const A = c1 - p0;
    const Bb = c2 - c1;
    const C = p3 - c2;
    const a = A - 2 * Bb + C;
    const b = 2 * (Bb - A);
    const c = A;
    const ts: number[] = [];
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) > 1e-12) ts.push(-c / b);
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const sq = Math.sqrt(disc);
        ts.push((-b + sq) / (2 * a), (-b - sq) / (2 * a));
      }
    }
    return ts.filter((t) => t > 0 && t < 1);
  };
  const ts = [...axisExtrema(seg.start.x, seg.control1.x, seg.control2.x, seg.end.x), ...axisExtrema(seg.start.y, seg.control1.y, seg.control2.y, seg.end.y)];
  for (const t of ts) points.push(bezierPointAt(seg, t));
  return points;
}

/** The segment's starting point. */
export function segmentStart(segment: Segment): Point {
  switch (segment.type) {
    case "line":
      return segment.start;
    case "arc":
      return arcPointAt(segment, segment.startAngle);
    case "ellipticalArc":
      return ellipticalArcPointAt(segment, segment.startAngle);
    case "bezier":
      return segment.start;
  }
}

/** The segment's ending point. */
export function segmentEnd(segment: Segment): Point {
  switch (segment.type) {
    case "line":
      return segment.end;
    case "arc":
      return arcPointAt(segment, segment.endAngle);
    case "ellipticalArc":
      return ellipticalArcPointAt(segment, segment.endAngle);
    case "bezier":
      return segment.end;
  }
}

const TWO_PI = Math.PI * 2;

/** Reduces an angle (radians) to the equivalent value in `[0, 2*PI)`. */
export function normalizeAngle(angle: number): number {
  const a = angle % TWO_PI;
  return a < 0 ? a + TWO_PI : a;
}

/** Angular span (radians, `(0, 2*PI]`) swept from `startAngle` to `endAngle` in the given direction. */
function sweptSpan(startAngle: number, endAngle: number, counterclockwise: boolean): number {
  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);
  const span = counterclockwise ? end - start : start - end;
  return span <= 0 ? span + TWO_PI : span;
}

/** True if the (normalized) `angle` lies on the arc between its start and end, given `span` already swept. */
function angleWithinSweep(angle: number, startAngle: number, counterclockwise: boolean, span: number): boolean {
  const target = normalizeAngle(angle);
  const start = normalizeAngle(startAngle);
  const traversed = counterclockwise ? normalizeAngle(target - start) : normalizeAngle(start - target);
  return traversed <= span;
}

/** Angular span traversed by the arc, in its own sweep direction, in radians (0, 2*PI]. */
export function arcSpan(arc: ArcSegment): number {
  return sweptSpan(arc.startAngle, arc.endAngle, arc.counterclockwise);
}

/** Parametric span traversed by the elliptical arc (in eccentric-angle terms), radians (0, 2*PI]. */
export function ellipticalArcSpan(arc: EllipticalArcSegment): number {
  return sweptSpan(arc.startAngle, arc.endAngle, arc.counterclockwise);
}

function angleWithinArc(angle: number, arc: ArcSegment): boolean {
  return angleWithinSweep(angle, arc.startAngle, arc.counterclockwise, arcSpan(arc));
}

/** Points needed for an exact bounding box: both endpoints plus any cardinal extrema the arc passes through. */
export function arcExtremaPoints(arc: ArcSegment): Point[] {
  const points = [arcPointAt(arc, arc.startAngle), arcPointAt(arc, arc.endAngle)];
  const cardinals = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  for (const angle of cardinals) {
    if (angleWithinArc(angle, arc)) {
      points.push(arcPointAt(arc, angle));
    }
  }
  return points;
}

/**
 * Points needed for an exact bounding box of an elliptical arc: both endpoints
 * plus the axis-aligned extrema (the parametric angles where dx/dt or dy/dt is
 * zero) that the arc actually passes through.
 */
export function ellipticalArcExtremaPoints(arc: EllipticalArcSegment): Point[] {
  const points = [ellipticalArcPointAt(arc, arc.startAngle), ellipticalArcPointAt(arc, arc.endAngle)];
  const cosR = Math.cos(arc.rotation);
  const sinR = Math.sin(arc.rotation);
  // dx/dt = 0 at t = atan2(-ry·sinR, rx·cosR); dy/dt = 0 at t = atan2(ry·cosR, rx·sinR); each repeats at t+PI.
  const tX = Math.atan2(-arc.ry * sinR, arc.rx * cosR);
  const tY = Math.atan2(arc.ry * cosR, arc.rx * sinR);
  const span = ellipticalArcSpan(arc);
  for (const base of [tX, tY]) {
    for (const t of [base, base + Math.PI]) {
      if (angleWithinSweep(t, arc.startAngle, arc.counterclockwise, span)) {
        points.push(ellipticalArcPointAt(arc, t));
      }
    }
  }
  return points;
}
