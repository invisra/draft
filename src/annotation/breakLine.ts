import { Path } from "../geometry/path.js";
import { addPoints, distance, midpoint, normalize, perpendicular, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { fitSpline } from "../geometry/spline.js";
import { DrawingElement } from "../svg/element.js";

/** Style options shared by both break-line conventions. */
export interface BreakLineOptions {
  /** Defaults to 0.25mm. */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

/** Options for {@link zigzagBreakLine}. */
export interface ZigzagBreakOptions extends BreakLineOptions {
  /** How far the zigzag jog swings perpendicular to the line. Defaults to 4mm. */
  amplitudeMM?: number;
  /** Total length the jog spans along the line, centered on its midpoint. Defaults to 10mm. */
  widthMM?: number;
}

/** Options for {@link freehandBreakLine}. */
export interface FreehandBreakOptions extends BreakLineOptions {
  /** Perpendicular depth of each wave. Defaults to 1.5mm. */
  amplitudeMM?: number;
  /** Approximate length of one full wave along the line. Defaults to 6mm. */
  wavelengthMM?: number;
}

/**
 * A conventional "long break" line (ASME Y14.3): an otherwise-straight line from `p1` to `p2`
 * with a single zigzag jog centered at its midpoint, used to shorten a long uniform member (a
 * bar, plate, or extrusion) so it fits the sheet without changing its scale. Call it once per
 * edge of the member being broken (e.g. once for the top edge, once for the bottom edge of a
 * rectangular bar) — the two calls' jogs line up automatically since both are centered on their
 * own `p1`-`p2` midpoint. For a round shaft/tube, use `cylindricalBreakLine` instead.
 */
export function zigzagBreakLine(p1: Point, p2: Point, options: ZigzagBreakOptions = {}): DrawingElement {
  const amplitude = options.amplitudeMM ?? 4;
  const width = options.widthMM ?? 10;
  const strokeOptions = { stroke: { color: options.color ?? "black", width: options.strokeWidthMM ?? 0.25 } };

  const axis = normalize(subtractPoints(p2, p1));
  const n = perpendicular(axis);
  const mid = midpoint(p1, p2);
  const jogStart = addPoints(mid, scalePoint(axis, -width / 2));
  const jogEnd = addPoints(mid, scalePoint(axis, width / 2));
  const peak = addPoints(mid, addPoints(scalePoint(axis, -width * 0.15), scalePoint(n, amplitude)));
  const trough = addPoints(mid, addPoints(scalePoint(axis, width * 0.15), scalePoint(n, -amplitude)));

  const path = new Path()
    .moveTo(p1.x, p1.y)
    .lineTo(jogStart.x, jogStart.y)
    .lineTo(peak.x, peak.y)
    .lineTo(trough.x, trough.y)
    .lineTo(jogEnd.x, jogEnd.y)
    .lineTo(p2.x, p2.y);
  return new DrawingElement(path, strokeOptions);
}

/**
 * A conventional cylindrical ("S-break") line (ASME Y14.3): an S-shaped curve from `p1` to `p2`
 * — the two points spanning the shaft/tube's diameter at the break location — used to shorten a
 * long round member. Built from two mirrored semicircular arcs (radius = 1/4 the p1-p2 distance),
 * so it's exact, reusable geometry rather than a freehand sketch. Unlike `zigzagBreakLine`, this
 * is called once per break (it already spans the full diameter, both outer edges at once).
 */
export function cylindricalBreakLine(p1: Point, p2: Point, options: BreakLineOptions = {}): DrawingElement {
  const strokeOptions = { stroke: { color: options.color ?? "black", width: options.strokeWidthMM ?? 0.25 } };
  const mid = midpoint(p1, p2);
  const quarter = distance(p1, p2) / 4;

  const axis = normalize(subtractPoints(p2, p1));
  const angle = Math.atan2(axis.y, axis.x);

  const c1 = midpoint(p1, mid);
  const c2 = midpoint(mid, p2);

  const path = new Path().moveTo(p1.x, p1.y);
  path.arc({ center: c1, radius: quarter, startAngle: angle + Math.PI, endAngle: angle, counterclockwise: false });
  path.arc({ center: c2, radius: quarter, startAngle: angle + Math.PI, endAngle: angle, counterclockwise: true });
  return new DrawingElement(path, strokeOptions);
}

/**
 * A conventional freehand "short break" line (ASME Y14.3): the thick, wavy line hand-drawn across a
 * member where a small portion is broken away (e.g. to expose an interior, or trim a short stub) —
 * the everyday break for wood, small parts, and partial sections, as opposed to the `zigzagBreakLine`
 * long break or the `cylindricalBreakLine` round break. Drawn heavier than the visible outline by
 * default (`strokeWidthMM` 0.5). The wave is a **deterministic** undulation (a tapered sine sampled
 * and faired through `fitSpline`), byte-stable like the rest of the library rather than randomized —
 * it reads as freehand without breaking snapshot/diff stability. The ends sit exactly on `p1`/`p2`.
 */
export function freehandBreakLine(p1: Point, p2: Point, options: FreehandBreakOptions = {}): DrawingElement {
  const amplitude = options.amplitudeMM ?? 1.5;
  const wavelength = options.wavelengthMM ?? 6;
  const strokeOptions = { stroke: { color: options.color ?? "black", width: options.strokeWidthMM ?? 0.5 } };

  const length = distance(p1, p2);
  const axis = normalize(subtractPoints(p2, p1));
  const n = perpendicular(axis);
  const waves = Math.max(1, Math.round(length / wavelength));
  const steps = waves * 4; // four samples per wave gives fitSpline a smooth, overshoot-free undulation

  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const along = addPoints(p1, scalePoint(axis, length * t));
    const offset = amplitude * Math.sin(2 * Math.PI * waves * t); // 0 at both ends (waves is an integer)
    pts.push(addPoints(along, scalePoint(n, offset)));
  }
  return new DrawingElement(fitSpline(pts), strokeOptions);
}
