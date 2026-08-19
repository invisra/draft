import type { Path } from "../geometry/path.js";
import type { DrawingElement } from "../svg/element.js";
import { hatch, type HatchOptions } from "./hatch.js";

/** Knurl pattern: `"diamond"` (crossed ridges, the default) or `"straight"` (ridges parallel to the axis). */
export type KnurlPattern = "diamond" | "straight";

/** Options for {@link knurl}. */
export interface KnurlOptions {
  /** Pattern to draw. Defaults to `"diamond"`. */
  pattern?: KnurlPattern;
  /**
   * Line angle in degrees (0 = +X axis). A `"diamond"` knurl draws two crossed
   * families at `±angleDeg`; a `"straight"` knurl draws one family at `angleDeg`.
   * Defaults to 45 for diamond (a clean crosshatch) and 0 for straight (ridges
   * along a horizontal axis).
   */
  angleDeg?: number;
  /** Perpendicular distance between knurl lines, in mm. Defaults to 2. */
  spacingMM?: number;
  /** Line width, in mm. Defaults to 0.18mm (a thin fill line, like `hatch`). */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

/**
 * Fills a region with a knurl representation — the fine cross- or straight-ridged
 * texture on a gripping surface — built on the same scanline `hatch()` machinery
 * (so it clips to any boundary, honors even-odd holes, and returns
 * `DrawingElement`s per line). A `"diamond"` knurl is two hatch families crossed
 * at `±angleDeg`; a `"straight"` knurl is a single family. Draw the region's own
 * outline separately, and pair it with {@link knurlNote} on a leader.
 */
export function knurl(boundary: Path | readonly Path[], options: KnurlOptions = {}): DrawingElement[] {
  const pattern = options.pattern ?? "diamond";
  const angleDeg = options.angleDeg ?? (pattern === "diamond" ? 45 : 0);
  const base: HatchOptions = {
    spacingMM: options.spacingMM ?? 2,
    strokeWidthMM: options.strokeWidthMM ?? 0.18,
    ...(options.color !== undefined ? { color: options.color } : {}),
  };

  if (pattern === "straight") return hatch(boundary, { ...base, angleDeg });
  return [...hatch(boundary, { ...base, angleDeg }), ...hatch(boundary, { ...base, angleDeg: -angleDeg })];
}

/**
 * The conventional knurl callout note for a leader, e.g. `knurlNote(0.8)` →
 * `"0.8 DIAMOND KNURL"`, `knurlNote(0.5, "straight")` → `"0.5 STRAIGHT KNURL"`.
 * Pair it with a `Callout`/`MultiLeader` pointing at the knurled surface. The
 * number is the pitch; units follow the drawing convention (not printed).
 */
export function knurlNote(pitch: number | string, pattern: KnurlPattern = "diamond"): string {
  return `${pitch} ${pattern.toUpperCase()} KNURL`;
}
