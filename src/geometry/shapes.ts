import { Path } from "./path.js";
import { point, type Point } from "./point.js";

/** A closed rectangular {@link Path}, wound counterclockwise, with `(x, y)` as its bottom-left corner. */
export function rectangle(x: number, y: number, width: number, height: number): Path {
  return new Path()
    .moveTo(x, y)
    .lineTo(x + width, y)
    .lineTo(x + width, y + height)
    .lineTo(x, y + height)
    .close();
}

/** A closed rectangular {@link Path} with `radius`-sized rounded corners (clamped to fit `width`/`height`). */
export function roundedRectangle(x: number, y: number, width: number, height: number, radius: number): Path {
  const r = Math.min(radius, width / 2, height / 2);
  const path = new Path();
  path.moveTo(x + r, y);
  path.lineTo(x + width - r, y);
  path.arc({ center: { x: x + width - r, y: y + r }, radius: r, startAngle: -Math.PI / 2, endAngle: 0, counterclockwise: true });
  path.lineTo(x + width, y + height - r);
  path.arc({ center: { x: x + width - r, y: y + height - r }, radius: r, startAngle: 0, endAngle: Math.PI / 2, counterclockwise: true });
  path.lineTo(x + r, y + height);
  path.arc({ center: { x: x + r, y: y + height - r }, radius: r, startAngle: Math.PI / 2, endAngle: Math.PI, counterclockwise: true });
  path.lineTo(x, y + r);
  path.arc({ center: { x: x + r, y: y + r }, radius: r, startAngle: Math.PI, endAngle: (3 * Math.PI) / 2, counterclockwise: true });
  return path.close();
}

/** SVG can't express a full 360deg arc in one command, so a circle is drawn as two semicircles. */
export function circle(cx: number, cy: number, radius: number): Path {
  const path = new Path();
  path.moveTo(cx + radius, cy);
  path.arc({ center: { x: cx, y: cy }, radius, startAngle: 0, endAngle: Math.PI, counterclockwise: true });
  path.arc({ center: { x: cx, y: cy }, radius, startAngle: Math.PI, endAngle: 2 * Math.PI, counterclockwise: true });
  return path.close();
}

/** Options for {@link ellipse}. */
export interface EllipseOptions {
  /** Rotation of the ellipse's X-axis, in degrees counterclockwise. Defaults to 0. */
  rotationDeg?: number;
  /**
   * If set, the ellipse is emitted as a tessellated `segments`-sided closed
   * polyline instead of true elliptical arcs — an escape hatch for consumers
   * that prefer straight edges. Omit for the default (two exact elliptical
   * half-arcs).
   */
  segments?: number;
}

/**
 * A closed elliptical {@link Path} centered at `(cx, cy)` with semi-axes `rx`
 * (X) and `ry` (Y), optionally rotated. By default it's built from two exact
 * elliptical half-arcs (like {@link circle}'s two semicircles, since SVG can't
 * express a full ellipse in one arc command); pass `segments` to get a
 * tessellated polyline approximation instead. Throws if `rx` or `ry` is not
 * positive.
 */
export function ellipse(cx: number, cy: number, rx: number, ry: number, options: EllipseOptions = {}): Path {
  if (rx <= 0 || ry <= 0) throw new Error(`Ellipse semi-axes must be positive, got rx=${rx}, ry=${ry}`);
  const rotation = ((options.rotationDeg ?? 0) * Math.PI) / 180;

  if (options.segments !== undefined) {
    const segments = Math.max(8, Math.floor(options.segments));
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const pts: Point[] = [];
    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * 2 * Math.PI;
      const ex = rx * Math.cos(t);
      const ey = ry * Math.sin(t);
      pts.push(point(cx + ex * cos - ey * sin, cy + ex * sin + ey * cos));
    }
    return polyline(pts, true);
  }

  const center = point(cx, cy);
  return new Path()
    .ellipticalArc({ center, rx, ry, rotation, startAngle: 0, endAngle: Math.PI, counterclockwise: true })
    .ellipticalArc({ center, rx, ry, rotation, startAngle: Math.PI, endAngle: 2 * Math.PI, counterclockwise: true })
    .close();
}

/**
 * An open elliptical-arc {@link Path} on the ellipse centered at `(cx, cy)` with
 * semi-axes `rx`/`ry`, from `startAngleDeg` to `endAngleDeg`. The angles are
 * **parametric** (eccentric) angles in degrees, matching {@link ellipse}'s
 * parameterization — not the true geometric angle unless `rx === ry`. Sweeps
 * counterclockwise (increasing angle) unless `counterclockwise: false`. Throws
 * if `rx` or `ry` is not positive.
 */
export function ellipticalArc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startAngleDeg: number,
  endAngleDeg: number,
  options: { rotationDeg?: number; counterclockwise?: boolean } = {},
): Path {
  return new Path().ellipticalArc({
    center: point(cx, cy),
    rx,
    ry,
    rotation: ((options.rotationDeg ?? 0) * Math.PI) / 180,
    startAngle: (startAngleDeg * Math.PI) / 180,
    endAngle: (endAngleDeg * Math.PI) / 180,
    counterclockwise: options.counterclockwise ?? true,
  });
}

/** A {@link Path} through `points` in order, optionally closed back to the first point. */
export function polyline(points: readonly Point[], closed = false): Path {
  if (points.length === 0) {
    throw new Error("polyline() requires at least one point");
  }
  const [first, ...rest] = points as [Point, ...Point[]];
  const path = new Path().moveTo(first.x, first.y);
  for (const p of rest) path.lineTo(p.x, p.y);
  return closed ? path.close() : path;
}

/**
 * A centerline cross marking the center of a circular (or symmetric) feature: two short
 * open paths, one per axis, extending `overshoot` past `radius` on each side. Meant to be
 * drawn with `lineStyle: "centerline"`.
 */
export function centerMark(center: Point, radius: number, overshoot = 3): [Path, Path] {
  const arm = radius + overshoot;
  const horizontal = new Path().moveTo(center.x - arm, center.y).lineTo(center.x + arm, center.y);
  const vertical = new Path().moveTo(center.x, center.y - arm).lineTo(center.x, center.y + arm);
  return [horizontal, vertical];
}
