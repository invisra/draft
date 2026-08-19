import { addPoints, point, scalePoint, type Point } from "./point.js";

/** Options for {@link boltCircle}. */
export interface BoltCircleOptions {
  /** Angle (degrees, 0 = +X axis) of the first hole. Defaults to 0. */
  startAngleDeg?: number;
  /**
   * If set, the `count` holes are spread evenly from `startAngleDeg` to this
   * angle **inclusive** (an arc pattern). If omitted, they're spread evenly
   * around the full circle (`360/count` apart), with no duplicate at the seam.
   */
  endAngleDeg?: number;
  /** Go clockwise from `startAngleDeg` instead of counterclockwise. Defaults to false. */
  clockwise?: boolean;
}

/**
 * The centers of `count` holes evenly spaced on a bolt circle of `radius` about
 * `center` — the standard bolt-hole-circle layout, computed so you don't hand-roll
 * the trig. By default they wrap the full circle starting at `startAngleDeg`;
 * pass `endAngleDeg` to lay them along an arc from start to end inclusive.
 * Returns the points in order; `count` must be ≥ 1 (≥ 2 for an arc pattern).
 */
export function boltCircle(center: Point, count: number, radius: number, options: BoltCircleOptions = {}): Point[] {
  if (count < 1) throw new Error("boltCircle requires count >= 1");
  if (radius <= 0) throw new Error(`Bolt-circle radius must be positive, got ${radius}`);
  const start = ((options.startAngleDeg ?? 0) * Math.PI) / 180;
  const dir = options.clockwise ? -1 : 1;

  let stepRad: number;
  if (options.endAngleDeg === undefined) {
    stepRad = dir * ((2 * Math.PI) / count);
  } else {
    if (count < 2) throw new Error("An arc bolt pattern (endAngleDeg set) requires count >= 2");
    const span = (((options.endAngleDeg - (options.startAngleDeg ?? 0)) * Math.PI) / 180) * (options.clockwise ? -1 : 1);
    stepRad = (options.clockwise ? -1 : 1) * (span / (count - 1));
  }

  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const angle = start + stepRad * i;
    points.push(addPoints(center, point(radius * Math.cos(angle), radius * Math.sin(angle))));
  }
  return points;
}

/**
 * `count` points stepping from `start` by the vector `step` each time
 * (`start`, `start+step`, `start+2·step`, …) — a linear hole/feature pattern.
 * `count` must be ≥ 1.
 */
export function linearPattern(start: Point, step: Point, count: number): Point[] {
  if (count < 1) throw new Error("linearPattern requires count >= 1");
  return Array.from({ length: count }, (_, i) => addPoints(start, scalePoint(step, i)));
}

/** Options for {@link rectangularPattern}. */
export interface RectangularPatternOptions {
  /** Number of columns (along +X). */
  columns: number;
  /** Number of rows (along +Y). */
  rows: number;
  /** Column-to-column spacing (mm, along +X). */
  dx: number;
  /** Row-to-row spacing (mm, along +Y). */
  dy: number;
}

/**
 * A grid of `columns × rows` points starting at `origin`, spaced `dx` along +X
 * and `dy` along +Y — a rectangular hole/feature array. Returned row-major
 * (all of row 0 left-to-right, then row 1, …). `columns` and `rows` must be ≥ 1.
 */
export function rectangularPattern(origin: Point, options: RectangularPatternOptions): Point[] {
  const { columns, rows, dx, dy } = options;
  if (columns < 1 || rows < 1) throw new Error("rectangularPattern requires columns >= 1 and rows >= 1");
  const points: Point[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      points.push(addPoints(origin, point(col * dx, row * dy)));
    }
  }
  return points;
}
