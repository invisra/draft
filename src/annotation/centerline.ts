import { Path } from "../geometry/path.js";
import { addPoints, normalize, perpendicular, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { circle as circleShape } from "../geometry/shapes.js";
import { DrawingElement } from "../svg/element.js";
import type { Stroke } from "../svg/style.js";

/** Shared color/weight overrides for the centerline helpers. */
export interface CenterlineStyleOptions {
  /** Overrides the centerline preset's stroke width (0.25mm), in mm. */
  strokeWidthMM?: number;
  /** Stroke color (any valid SVG color string). Defaults to "black". */
  color?: string;
}

function strokeOverride(options: CenterlineStyleOptions): Stroke | undefined {
  const stroke: Stroke = {};
  if (options.color !== undefined) stroke.color = options.color;
  if (options.strokeWidthMM !== undefined) stroke.width = options.strokeWidthMM;
  return Object.keys(stroke).length > 0 ? stroke : undefined;
}

/** A long-dash-short-dash centerline `DrawingElement` for `path` (keeps the preset's dash pattern; color/width overridable). */
function centerlineElement(path: Path, options: CenterlineStyleOptions): DrawingElement {
  const stroke = strokeOverride(options);
  return new DrawingElement(path, stroke ? { lineStyle: "centerline", stroke } : { lineStyle: "centerline" });
}

/** Options for {@link axisCenterline}. */
export interface AxisCenterlineOptions extends CenterlineStyleOptions {
  /** Extra length drawn past each endpoint, along the line, in mm. Defaults to 3mm. */
  overshootMM?: number;
  /** Add the paired short ticks at each end that mark a line of symmetry (ASME Y14.2 partial/symmetric view). Defaults to false. */
  symmetryTicks?: boolean;
}

/**
 * A straight axis / symmetry centerline between two points — the long-dash-short-dash
 * line running through a shaft/cylinder in longitudinal view, or marking a plane of
 * symmetry. Drawn with the `"centerline"` line style, extended `overshoot` past each
 * end. With `symmetryTicks`, adds the two short parallel strokes at each end that
 * denote a line of symmetry on a partial/half view. Returns `DrawingElement`s, like
 * `threadSideView`/`hexHead`.
 */
export function axisCenterline(p1: Point, p2: Point, options: AxisCenterlineOptions = {}): DrawingElement[] {
  const span = subtractPoints(p2, p1);
  if (Math.hypot(span.x, span.y) < 1e-9) throw new Error("axisCenterline: p1 and p2 must differ");
  const dir = normalize(span);
  const overshoot = options.overshootMM ?? 3;
  const start = subtractPoints(p1, scalePoint(dir, overshoot));
  const end = addPoints(p2, scalePoint(dir, overshoot));

  const elements = [centerlineElement(new Path().moveTo(start.x, start.y).lineTo(end.x, end.y), options)];

  if (options.symmetryTicks) {
    const n = perpendicular(dir);
    const tickHalf = 1.5;
    const solid: Stroke = { color: options.color ?? "black", width: options.strokeWidthMM ?? 0.25 };
    // Two short solid ticks just inside each tip, perpendicular to the axis.
    for (const [tip, inward] of [
      [end, scalePoint(dir, -1)],
      [start, dir],
    ] as const) {
      for (const along of [0.8, 1.8]) {
        const c = addPoints(tip, scalePoint(inward, along));
        const a = addPoints(c, scalePoint(n, tickHalf));
        const b = subtractPoints(c, scalePoint(n, tickHalf));
        elements.push(new DrawingElement(new Path().moveTo(a.x, a.y).lineTo(b.x, b.y), { stroke: solid }));
      }
    }
  }

  return elements;
}

/** Options for {@link boltCircleCenterline}. */
export interface BoltCircleCenterlineOptions extends CenterlineStyleOptions {
  /** Hole-center positions (e.g. from `boltCircle()`); a small centerline cross is drawn at each. */
  holeCenters?: readonly Point[];
  /** How far the pattern's center cross extends past the bolt circle, in mm. Defaults to 4mm. */
  overshootMM?: number;
  /** Radius of the small cross drawn at each hole center, in mm. Defaults to 2mm. */
  holeMarkRadiusMM?: number;
}

/**
 * The centerline set for a bolt-hole circle (the companion to `boltCircle()`): the
 * dash-dot **bolt-circle** through the hole centers, a horizontal + vertical center
 * cross through the pattern (extended past the circle), and — when `holeCenters` are
 * given — a small centerline cross at each hole. All drawn with the `"centerline"`
 * line style. Returns `DrawingElement`s.
 */
export function boltCircleCenterline(center: Point, radius: number, options: BoltCircleCenterlineOptions = {}): DrawingElement[] {
  if (radius <= 0) throw new Error(`boltCircleCenterline: radius must be positive, got ${radius}`);
  const overshoot = options.overshootMM ?? 4;
  const arm = radius + overshoot;

  const elements = [
    centerlineElement(circleShape(center.x, center.y, radius), options),
    centerlineElement(new Path().moveTo(center.x - arm, center.y).lineTo(center.x + arm, center.y), options),
    centerlineElement(new Path().moveTo(center.x, center.y - arm).lineTo(center.x, center.y + arm), options),
  ];

  const holeMarkRadius = options.holeMarkRadiusMM ?? 2;
  for (const hole of options.holeCenters ?? []) {
    elements.push(
      centerlineElement(new Path().moveTo(hole.x - holeMarkRadius, hole.y).lineTo(hole.x + holeMarkRadius, hole.y), options),
      centerlineElement(new Path().moveTo(hole.x, hole.y - holeMarkRadius).lineTo(hole.x, hole.y + holeMarkRadius), options),
    );
  }

  return elements;
}
