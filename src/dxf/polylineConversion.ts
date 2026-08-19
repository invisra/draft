import type { Path } from "../geometry/path.js";
import { arcSpan, bezierPointAt, ellipticalArcPointAt, ellipticalArcSpan, segmentEnd, segmentStart } from "../geometry/segments.js";
import type { Point } from "../geometry/point.js";

/** A single DXF LWPOLYLINE vertex, as produced by {@link pathToPolyline}. */
export interface PolylineVertex {
  /** Millimeters. */
  x: number;
  /** Millimeters. */
  y: number;
  /**
   * DXF LWPOLYLINE bulge: tan(includedAngle / 4), signed by sweep direction
   * (positive = counterclockwise from this vertex to the next, negative =
   * clockwise). 0 for a straight segment to the next vertex.
   */
  bulge: number;
}

/** The result of converting a `Path` to DXF LWPOLYLINE form, as returned by {@link pathToPolyline}. */
export interface PolylineConversion {
  /** Vertices in path order. */
  vertices: PolylineVertex[];
  /** Whether the source `Path` was closed (`Path.isClosed()`). */
  closed: boolean;
}

const EPSILON = 1e-9;

function pointsEqual(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}

/**
 * Converts a `Path`'s line/arc segments into DXF LWPOLYLINE vertices with
 * bulge values, so arcs round-trip exactly (not tessellated) — unlike
 * `Path.flatten()`, which approximates arcs as short line segments for
 * algorithms (like hatching) that only understand straight edges.
 *
 * Returns `{ vertices: [], closed: false }` for a path with no segments
 * (nothing to export).
 */
export function pathToPolyline(path: Path): PolylineConversion {
  const segments = path.getSegments();
  if (segments.length === 0) {
    return { vertices: [], closed: false };
  }

  const first = segmentStart(segments[0]!);
  const vertices: PolylineVertex[] = [{ x: first.x, y: first.y, bulge: 0 }];

  for (const seg of segments) {
    if (seg.type === "ellipticalArc") {
      // DXF LWPOLYLINE bulge only expresses circular arcs, so tessellate an
      // elliptical arc into short straight segments (~10° of parametric angle each).
      const span = ellipticalArcSpan(seg);
      const steps = Math.max(1, Math.ceil((span * 180) / Math.PI / 10));
      for (let i = 1; i <= steps; i++) {
        const delta = (span * i) / steps;
        const angle = seg.counterclockwise ? seg.startAngle + delta : seg.startAngle - delta;
        const p = ellipticalArcPointAt(seg, angle);
        vertices.push({ x: p.x, y: p.y, bulge: 0 });
      }
      continue;
    }
    if (seg.type === "bezier") {
      // bulge can't express a Bézier either; tessellate into short straight segments
      const steps = 24;
      for (let i = 1; i <= steps; i++) {
        const p = bezierPointAt(seg, i / steps);
        vertices.push({ x: p.x, y: p.y, bulge: 0 });
      }
      continue;
    }
    const bulge = seg.type === "arc" ? Math.tan(arcSpan(seg) / 4) * (seg.counterclockwise ? 1 : -1) : 0;
    vertices[vertices.length - 1]!.bulge = bulge;
    const end = segmentEnd(seg);
    vertices.push({ x: end.x, y: end.y, bulge: 0 });
  }

  // Collapse degenerate zero-length straight segments. These arise, for example, from a pair of
  // near-360deg arcs (see circle()) meeting Path.close()'s exact-equality check: sin(2*PI) isn't
  // bit-exact 0 in IEEE 754, so close() sees a "gap" of ~1e-16 and inserts a redundant closing
  // line most of the way round the circle. Only ever merges straight (bulge 0) segments, never
  // an arc, so no real geometry is discarded.
  for (let i = vertices.length - 2; i >= 0; i--) {
    const a = vertices[i]!;
    const b = vertices[i + 1]!;
    if (a.bulge === 0 && pointsEqual(a, b)) {
      vertices.splice(i, 1);
    }
  }

  const closed = path.isClosed();
  if (closed && vertices.length > 1 && pointsEqual(vertices[0]!, vertices[vertices.length - 1]!)) {
    // the closing edge is always a straight line (see Path.close()), so its bulge is always 0 —
    // safe to drop the duplicate final vertex and let LWPOLYLINE's own "closed" flag imply it
    vertices.pop();
  }

  return { vertices, closed };
}
