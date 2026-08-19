import { bboxFromPoints } from "../geometry/bbox.js";
import { polygonIntersection } from "../geometry/boolean.js";
import { addPoints, normalize, perpendicular, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { polyline } from "../geometry/shapes.js";
import { hatch } from "../hatch/hatch.js";
import { DrawingElement } from "../svg/element.js";
import type { Path } from "../geometry/path.js";

/** A cutting plane for {@link sectionView}: the material on the `keep` side of the infinite line through `p1`→`p2` is retained. */
export interface SectionCut {
  /** First point on the cutting line. */
  p1: Point;
  /** Second point on the cutting line (direction is `p1`→`p2`). */
  p2: Point;
  /** Which side of the line to keep: `"left"` (90° counterclockwise of the p1→p2 direction) or `"right"`. */
  keep: "left" | "right";
}

/** Options for {@link sectionView}. */
export interface SectionViewOptions {
  /** Section-line (hatch) angle, degrees. Defaults to 45. */
  angleDeg?: number;
  /** Section-line spacing, mm. Defaults to 3. */
  spacingMM?: number;
  /** Section-line stroke width, mm. Defaults to 0.18mm. */
  hatchStrokeWidthMM?: number;
  /** Draw the region outline (the cut boundary). Defaults to true. */
  outline?: boolean;
  /** Outline stroke width, mm. Defaults to 0.5mm (a visible object line). */
  outlineStrokeWidthMM?: number;
  /** Color for both hatch and outline. Defaults to "black". */
  color?: string;
  /** Cut the region to one side of a cutting plane before hatching. Omit to section the whole region as given. */
  cut?: SectionCut;
}

/** Builds a big rectangle covering the `keep` side of the infinite line through `p1`→`p2`, sized from `diagonal`. */
function halfPlane(p1: Point, p2: Point, keep: "left" | "right", diagonal: number): Point[] {
  const u = normalize(subtractPoints(p2, p1));
  const n = perpendicular(u); // 90° CCW = left of travel
  const nk = keep === "left" ? n : scalePoint(n, -1);
  const big = diagonal * 4 + 1;
  const a = addPoints(p1, scalePoint(u, -big));
  const b = addPoints(p1, scalePoint(u, big));
  return [a, b, addPoints(b, scalePoint(nk, big * 2)), addPoints(a, scalePoint(nk, big * 2))];
}

/** The rendered pieces of a section: the region polygon(s), the section-line fill, and the boundary outline. */
export interface SectionViewResult {
  /** The sectioned region as one or more point rings (a hole is a separate ring; the even-odd rule leaves it unhatched). */
  region: Point[][];
  /** Section-line fill (`hatch()` output) — one `DrawingElement` per line. */
  hatch: DrawingElement[];
  /** The region boundary as closed stroked paths (empty when `outline` is false). */
  outline: DrawingElement[];
}

/**
 * Generates a section view's fill from a material cross-section: it section-lines
 * (hatches) the region — leaving holes/islands unhatched via the even-odd rule —
 * and, when a `cut` cutting plane is given, first clips the region to one side of
 * it (the material "behind" the plane), by intersecting each boundary ring with a
 * half-plane (Greiner–Hormann, so keep the cut line out of exact coincidence with
 * a vertex). Composes the existing polygon-boolean and `hatch()` machinery into
 * the one call a section needs; `boundary` is the true material outline (outer
 * ring plus any hole rings), authored in the section's own plane — this is a 2D
 * fill generator, not a 3D-model section.
 */
export function sectionView(boundary: Path | readonly Path[], options: SectionViewOptions = {}): SectionViewResult {
  const paths = Array.isArray(boundary) ? (boundary as readonly Path[]) : [boundary as Path];
  let rings = paths.map((p) => p.flatten()).filter((r) => r.length >= 3);

  if (options.cut && rings.length > 0) {
    const all = rings.flat();
    const box = bboxFromPoints(all);
    const diagonal = Math.hypot(box.maxX - box.minX, box.maxY - box.minY);
    const clip = halfPlane(options.cut.p1, options.cut.p2, options.cut.keep, diagonal);
    // Clip each ring independently, so holes survive as holes for the even-odd hatch.
    rings = rings.flatMap((r) => polygonIntersection(r, clip));
  }

  const color = options.color ?? "black";
  const regionPaths = rings.map((r) => polyline(r, true));
  const hatchEls =
    regionPaths.length > 0
      ? hatch(regionPaths, {
          angleDeg: options.angleDeg ?? 45,
          spacingMM: options.spacingMM ?? 3,
          strokeWidthMM: options.hatchStrokeWidthMM ?? 0.18,
          color,
        })
      : [];

  const outline =
    (options.outline ?? true)
      ? regionPaths.map((p) => new DrawingElement(p, { stroke: { color, width: options.outlineStrokeWidthMM ?? 0.5 } }))
      : [];

  return { region: rings, hatch: hatchEls, outline };
}
