import { Path } from "../geometry/path.js";
import { point, rotatePoint, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { Stroke } from "../svg/style.js";

/** Options for {@link hatch}. */
export interface HatchOptions {
  /** Direction of the hatch lines in degrees, 0 = +X axis. Defaults to 45. */
  angleDeg?: number;
  /** Perpendicular distance between hatch lines, in mm. Defaults to 3. */
  spacingMM?: number;
  /** Perpendicular offset (mm) of the reference line from the origin — shifts the whole line family without changing its spacing. Lets multiple `hatch()` passes at the same angle/spacing interleave rather than coincide (used by `hatchPattern()` to build multi-line-family material patterns). Defaults to 0. */
  phaseMM?: number;
  /** Defaults to 0.18mm. */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
  /** Dash/gap lengths (mm), alternating, same convention as `Stroke.dasharray`. Omit for a continuous line. */
  dasharray?: readonly number[];
  /** SVG `stroke-linecap`. */
  linecap?: "butt" | "round" | "square";
}

interface Edge {
  a: Point;
  b: Point;
}

function polygonEdges(points: readonly Point[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < points.length; i++) {
    edges.push({ a: points[i]!, b: points[(i + 1) % points.length]! });
  }
  return edges;
}

/**
 * Fills the region described by `boundary` with parallel hatch lines (section
 * lining), using the even-odd fill rule — so passing an outer boundary plus one
 * or more nested hole boundaries automatically leaves the holes unhatched, no
 * special "holes" parameter needed. `boundary` is one or more `Path`s (each
 * flattened internally via `Path.flatten()`, so arcs are tessellated); a single
 * `Path` is shorthand for a region with no holes.
 *
 * Returns one `DrawingElement` per hatch line segment — draw the boundary itself
 * separately, same as any other CAD hatch (fill lines only, no outline).
 */
export function hatch(boundary: Path | readonly Path[], options: HatchOptions = {}): DrawingElement[] {
  const paths = Array.isArray(boundary) ? boundary : [boundary];
  const polygons: Point[][] = paths.map((p) => p.flatten()).filter((poly) => poly.length >= 2);
  if (polygons.length === 0) return [];

  const angleDeg = options.angleDeg ?? 45;
  const spacing = options.spacingMM ?? 3;
  if (options.spacingMM !== undefined && (!Number.isFinite(spacing) || spacing <= 0)) {
    throw new Error("hatch spacingMM must be a positive finite number");
  }
  const phase = options.phaseMM ?? 0;
  const stroke: Stroke = {
    color: options.color ?? "black",
    width: options.strokeWidthMM ?? 0.18,
    ...(options.dasharray ? { dasharray: options.dasharray } : {}),
    ...(options.linecap ? { linecap: options.linecap } : {}),
  };
  const angleRad = (angleDeg * Math.PI) / 180;
  const origin = point(0, 0);

  const rotatedPolygons = polygons.map((poly) => poly.map((p) => rotatePoint(p, -angleRad, origin)));
  const edges = rotatedPolygons.flatMap(polygonEdges);

  let minY = Infinity;
  let maxY = -Infinity;
  for (const poly of rotatedPolygons) {
    for (const p of poly) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return [];

  // Bound the work: a huge span-to-spacing ratio would otherwise loop billions of times (DoS).
  const MAX_SCANLINES = 100_000;
  if ((maxY - minY) / spacing > MAX_SCANLINES) {
    throw new Error(`hatch would produce more than ${MAX_SCANLINES} scanlines; increase spacingMM or reduce the region size`);
  }

  const elements: DrawingElement[] = [];
  const firstLine = Math.ceil((minY - phase) / spacing) * spacing + phase;
  for (let y = firstLine; y <= maxY; y += spacing) {
    const xs: number[] = [];
    for (const { a, b } of edges) {
      // half-open interval [min, max) so a shared vertex is never counted by both adjacent edges
      const crosses = (a.y <= y && b.y > y) || (b.y <= y && a.y > y);
      if (!crosses) continue;
      xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const p1 = rotatePoint(point(xs[i]!, y), angleRad, origin);
      const p2 = rotatePoint(point(xs[i + 1]!, y), angleRad, origin);
      elements.push(new DrawingElement(new Path().moveTo(p1.x, p1.y).lineTo(p2.x, p2.y), { stroke }));
    }
  }
  return elements;
}
