import type { Point } from "./point.js";

/** An axis-aligned bounding box, in mm. */
export interface BoundingBox {
  /** Left edge. */
  readonly minX: number;
  /** Bottom edge. */
  readonly minY: number;
  /** Right edge. */
  readonly maxX: number;
  /** Top edge. */
  readonly maxY: number;
}

/** The smallest {@link BoundingBox} containing every point in `points`. Throws if `points` is empty. */
export function bboxFromPoints(points: readonly Point[]): BoundingBox {
  if (points.length === 0) {
    throw new Error("Cannot compute bounding box of an empty point list");
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** The smallest {@link BoundingBox} containing both `a` and `b`. */
export function unionBBox(a: BoundingBox, b: BoundingBox): BoundingBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** The box's width. */
export function bboxWidth(b: BoundingBox): number {
  return b.maxX - b.minX;
}

/** The box's height. */
export function bboxHeight(b: BoundingBox): number {
  return b.maxY - b.minY;
}
