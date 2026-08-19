import type { Point } from "../geometry/point.js";
import { AngularDimension, type AngularDimensionOptions } from "./angularDimension.js";
import { LinearDimension, type LinearDimensionOptions } from "./linearDimension.js";

/**
 * A series of end-to-end linear dimensions along `points` (p0->p1, p1->p2, ...),
 * all sharing one dimension line (`options.offset`) — the standard "chain" style
 * for showing spacing between adjacent features.
 */
export function chainDimension(points: readonly Point[], options: LinearDimensionOptions): LinearDimension[] {
  if (points.length < 2) {
    throw new Error("chainDimension requires at least 2 points");
  }
  const dimensions: LinearDimension[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    dimensions.push(new LinearDimension(points[i]!, points[i + 1]!, options));
  }
  return dimensions;
}

/** Options for {@link baselineDimension}. */
export interface BaselineDimensionOptions extends LinearDimensionOptions {
  /** Additional perpendicular spacing between each successive stacked dimension line. Defaults to 8mm. */
  stackSpacing?: number;
}

/**
 * A series of linear dimensions from a common datum (`points[0]`) to each
 * subsequent point, stacked at increasing offsets (`options.offset`, then
 * `+ stackSpacing`, `+ 2*stackSpacing`, ...) so they don't overlap — the
 * standard "baseline" style for showing positions from one reference edge.
 */
export function baselineDimension(points: readonly Point[], options: BaselineDimensionOptions): LinearDimension[] {
  if (points.length < 2) {
    throw new Error("baselineDimension requires at least 2 points (a datum plus one or more measured points)");
  }
  const datum = points[0]!;
  const stackSpacing = options.stackSpacing ?? 8;
  const side = Math.sign(options.offset) || 1;
  return points.slice(1).map((p, i) => new LinearDimension(datum, p, { ...options, offset: options.offset + side * stackSpacing * i }));
}

/**
 * A series of end-to-end angular dimensions at `vertex`, one per consecutive
 * pair of rays in `rays` (rays[0]->rays[1], rays[1]->rays[2], ...) — each ray
 * is any point along it (e.g. an edge endpoint, not necessarily equidistant
 * from `vertex`) — all sharing one arc radius (`options.radius`). The angular
 * equivalent of `chainDimension`, for showing a sequence of adjacent angles
 * (e.g. around a bolt-hole pattern) rather than each measured separately from
 * a common datum. Since `AngularDimension` measures counterclockwise from the
 * first ray to the second, order `rays` counterclockwise or interior angles
 * will come out as their reflex complement.
 */
export function chainAngularDimension(vertex: Point, rays: readonly Point[], options: AngularDimensionOptions): AngularDimension[] {
  if (rays.length < 2) {
    throw new Error("chainAngularDimension requires at least 2 rays");
  }
  const dimensions: AngularDimension[] = [];
  for (let i = 0; i < rays.length - 1; i++) {
    dimensions.push(new AngularDimension(vertex, rays[i]!, rays[i + 1]!, options));
  }
  return dimensions;
}

/** Options for {@link baselineAngularDimension}. */
export interface BaselineAngularDimensionOptions extends AngularDimensionOptions {
  /** Additional radius between each successive stacked dimension arc. Defaults to 10mm. */
  stackSpacing?: number;
}

/**
 * A series of angular dimensions at `vertex` from a common datum ray
 * (`rays[0]`) to each subsequent ray, stacked at increasing radii
 * (`options.radius`, then `+ stackSpacing`, `+ 2*stackSpacing`, ...) so the
 * arcs don't overlap — the angular equivalent of `baselineDimension`, for
 * showing several angles measured from one reference edge.
 */
export function baselineAngularDimension(
  vertex: Point,
  rays: readonly Point[],
  options: BaselineAngularDimensionOptions,
): AngularDimension[] {
  if (rays.length < 2) {
    throw new Error("baselineAngularDimension requires at least 2 rays (a datum plus one or more measured rays)");
  }
  const datum = rays[0]!;
  const stackSpacing = options.stackSpacing ?? 10;
  return rays.slice(1).map((p, i) => new AngularDimension(vertex, datum, p, { ...options, radius: options.radius + stackSpacing * i }));
}
