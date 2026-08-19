import { bboxFromPoints } from "../geometry/bbox.js";
import { addPoints, dot, normalize, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { Path } from "../geometry/path.js";
import { DrawingElement } from "../svg/element.js";
import { LINE_STYLES } from "../svg/lineStyles.js";
import { ViewLabel } from "./viewLabel.js";
import { sectionView, type SectionCut, type SectionViewOptions, type SectionViewResult } from "./sectionView.js";

/**
 * Named convenience helpers for the standard section conventions — half, revolved, and removed
 * sections — layered on top of {@link sectionView}. They set the right defaults (line weights, the
 * axis centerline, the title) so a caller doesn't reassemble them each time; the underlying fill /
 * clipping is still {@link sectionView}, so this stays a 2-D fill generator, not a 3-D model section.
 */

/** Flattens a boundary (one or several paths) to a single point cloud, for sizing. */
function boundaryPoints(boundary: Path | readonly Path[]): Point[] {
  const paths = Array.isArray(boundary) ? (boundary as readonly Path[]) : [boundary as Path];
  return paths.flatMap((p) => p.flatten());
}

/** The result of a {@link halfSection}: a {@link SectionViewResult} plus the axis-of-symmetry centerline. */
export interface HalfSectionResult extends SectionViewResult {
  /** The centerline along the cutting plane (a half section's cut edge is a centerline, not a visible line). */
  centerline: DrawingElement[];
}

/**
 * A **half section**: one half of a symmetric part is sectioned (hatched) while the other half stays
 * an external view. Clips and hatches the `cut` side via {@link sectionView}, and additionally returns
 * the axis-of-symmetry **centerline** running along the cutting plane (extended to span the part), the
 * convention that distinguishes a half section's dividing edge from a visible object line.
 */
export function halfSection(boundary: Path | readonly Path[], cut: SectionCut, options: SectionViewOptions = {}): HalfSectionResult {
  const result = sectionView(boundary, { ...options, cut });
  const color = options.color ?? "black";

  // Extend the cut line to span the whole part, so it reads as the axis centerline.
  const pts = boundaryPoints(boundary);
  const u = normalize(subtractPoints(cut.p2, cut.p1));
  let tMin = 0;
  let tMax = 0;
  if (pts.length > 0) {
    const ts = pts.map((p) => dot(subtractPoints(p, cut.p1), u));
    tMin = Math.min(...ts);
    tMax = Math.max(...ts);
  }
  const box = pts.length > 0 ? bboxFromPoints(pts) : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const overshoot = Math.hypot(box.maxX - box.minX, box.maxY - box.minY) * 0.05 + 1;
  const start = addPoints(cut.p1, scalePoint(u, tMin - overshoot));
  const end = addPoints(cut.p1, scalePoint(u, tMax + overshoot));
  const centerline = [new DrawingElement(new Path().moveTo(start.x, start.y).lineTo(end.x, end.y), { stroke: { color, ...LINE_STYLES.centerline } })];

  return { ...result, centerline };
}

/**
 * A **revolved section**: a cross-section shape drawn in place on the view (superimposed on the part
 * at the cutting location), hatched with a **thin** visible outline per ASME Y14.3. `profile` is the
 * closed cross-section outline, authored where it is to appear. Returns the {@link sectionView} fill;
 * break the part's own outline around it separately if desired.
 */
export function revolvedSection(profile: Path | readonly Path[], options: SectionViewOptions = {}): SectionViewResult {
  // Revolved sections use a thin continuous outline (they sit on top of the view), unlike the heavy
  // cut outline of a full/removed section.
  return sectionView(profile, { outlineStrokeWidthMM: 0.25, ...options });
}

/** Options for a {@link removedSection}. */
export interface RemovedSectionOptions extends SectionViewOptions {
  /** The section title, e.g. `"SECTION A-A"`. Omit to skip the label. */
  label?: string;
  /** Title text height in mm. Defaults to 5. */
  labelSizeMM?: number;
  /** Gap (mm) between the profile's lowest point and the title. Defaults to 6. */
  labelGapMM?: number;
}

/** The result of a {@link removedSection}: a {@link SectionViewResult} plus the (optional) section title. */
export interface RemovedSectionResult extends SectionViewResult {
  /** The `"SECTION A-A"` title beneath the profile, or `undefined` when no `label` was given. */
  label?: ViewLabel;
}

/**
 * A **removed section**: the cross-section is drawn away from the part (in a clear area) and titled,
 * e.g. `SECTION A-A`. Hatches the `profile` via {@link sectionView} (with the normal heavy cut
 * outline) and, when {@link RemovedSectionOptions.label} is given, returns a centered {@link ViewLabel}
 * placed just below the profile.
 */
export function removedSection(profile: Path | readonly Path[], options: RemovedSectionOptions = {}): RemovedSectionResult {
  const result = sectionView(profile, options);
  if (options.label === undefined) return { ...result };

  const pts = boundaryPoints(profile);
  const box = pts.length > 0 ? bboxFromPoints(pts) : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const gap = options.labelGapMM ?? 6;
  const label = new ViewLabel({ x: (box.minX + box.maxX) / 2, y: box.minY - gap }, options.label, {
    textSizeMM: options.labelSizeMM ?? 5,
    color: options.color ?? "black",
  });
  return { ...result, label };
}
