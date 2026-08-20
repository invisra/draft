import { formatInchToleranceValue } from "./format.js";
import { formatNumber } from "../util.js";

/** Options for {@link inchToleranceBlock}. */
export interface InchToleranceBlockOptions {
  /** Tolerance (± inch) applied to a one-place decimal dimension (`.X`). */
  onePlace?: number;
  /** Tolerance (± inch) applied to a two-place decimal dimension (`.XX`). */
  twoPlace?: number;
  /** Tolerance (± inch) applied to a three-place decimal dimension (`.XXX`). */
  threePlace?: number;
  /** Tolerance (± inch) applied to a four-place decimal dimension (`.XXXX`). */
  fourPlace?: number;
  /** Tolerance for fractional dimensions, given as the fraction string to show, e.g. `"1/64"` → `FRAC ±1/64`. */
  fractionalInch?: string;
  /** Angular tolerance (± degrees), e.g. `0.5` → `ANGLES ±0.5°`. */
  angularDeg?: number;
}

/**
 * Builds the classic US decimal-inch "block tolerance" note — the
 * `.X`/`.XX`/`.XXX ± …, ANGLES ± …` lines that sit in a title block's
 * TOLERANCES field on an inch drawing, where a dimension's decimal-place count
 * selects its default tolerance (ASME Y14.5 §2.3.2, common industry practice).
 * Values are formatted with US inch zero-suppression (no leading zero: `±.005`).
 *
 * Returns one string per provided field, in reading order (fractional, then
 * `.X`→`.XXXX`, then angular) — pass it straight into
 * `TitleBlockFields.generalTolerance`, the inch counterpart to an ISO 2768
 * general-tolerance note. The
 * block covers only the general-tolerance lines
 * themselves; the "UNLESS OTHERWISE SPECIFIED / DIMENSIONS ARE IN INCHES"
 * heading is conventionally a separate general note.
 *
 * @example
 * inchToleranceBlock({ onePlace: 0.03, twoPlace: 0.01, threePlace: 0.005, angularDeg: 0.5 })
 * // → [".X ±.03", ".XX ±.01", ".XXX ±.005", "ANGLES ±0.5°"]
 */
export function inchToleranceBlock(options: InchToleranceBlockOptions): string[] {
  const lines: string[] = [];
  if (options.fractionalInch !== undefined) lines.push(`FRAC ±${options.fractionalInch}`);
  if (options.onePlace !== undefined) lines.push(`.X ±${formatInchToleranceValue(options.onePlace)}`);
  if (options.twoPlace !== undefined) lines.push(`.XX ±${formatInchToleranceValue(options.twoPlace)}`);
  if (options.threePlace !== undefined) lines.push(`.XXX ±${formatInchToleranceValue(options.threePlace)}`);
  if (options.fourPlace !== undefined) lines.push(`.XXXX ±${formatInchToleranceValue(options.fourPlace)}`);
  if (options.angularDeg !== undefined) lines.push(`ANGLES ±${formatNumber(options.angularDeg, 4)}°`);
  if (lines.length === 0) throw new Error("inchToleranceBlock requires at least one tolerance field");
  return lines;
}
