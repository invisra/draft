/**
 * Preferred drawing scales (ISO 5455) and a helper to snap an arbitrary scale to the nearest one. A
 * "scale" here is the paper-per-model factor used by {@link View} and {@link formatScaleRatio}: `2`
 * means 2:1 (enlargement), `0.5` means 1:2 (reduction), `1` is full size.
 */

/**
 * The ISO 5455 preferred scales, as paper-per-model factors, largest (enlargement) to smallest
 * (reduction): 50:1 … 2:1, 1:1, 1:2 … 1:10000. ASME Y14.1 shares 1:1, the 2/5/10 decades, and the
 * common enlargements; pass your own list to {@link nearestStandardScale} for other conventions.
 */
export const STANDARD_SCALES: readonly number[] = [
  50, 20, 10, 5, 2, 1,
  1 / 2, 1 / 5, 1 / 10, 1 / 20, 1 / 50, 1 / 100, 1 / 200, 1 / 500, 1 / 1000, 1 / 2000, 1 / 5000, 1 / 10000,
];

/**
 * Snaps `scale` (paper-per-model) to the nearest preferred scale, compared in ratio (log) space so
 * that, e.g., 3:1 snaps to 2:1 and 1:3 snaps to 1:2 (each is equidistant by ratio from the next step,
 * and ties resolve toward the finer/enlarging side by list order). Pass a custom `scales` list to snap
 * against a different convention (e.g. ASME's 1:4, 1:8, 1:16). Throws on a non-positive scale.
 */
export function nearestStandardScale(scale: number, scales: readonly number[] = STANDARD_SCALES): number {
  if (!(scale > 0)) throw new Error("nearestStandardScale: scale must be positive");
  let best = scales[0]!;
  let bestDist = Infinity;
  for (const s of scales) {
    const dist = Math.abs(Math.log(scale) - Math.log(s));
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}

/** Whether `scale` is (within a small tolerance) one of the given preferred scales. Defaults to {@link STANDARD_SCALES}. */
export function isStandardScale(scale: number, scales: readonly number[] = STANDARD_SCALES): boolean {
  return scales.some((s) => Math.abs(Math.log(scale) - Math.log(s)) < 1e-9);
}
