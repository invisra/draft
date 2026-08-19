import type { LengthUnit } from "../units.js";
import { fromMM, toMM } from "../units.js";
import { type MeasurementFormat, formatMeasurement, resolveMeasurementFormat, type ResolvedMeasurementFormat } from "./format.js";
import type { DimensionStyle } from "./style.js";
import { formatToleranceText, normalizeTolerance, type ToleranceInput, type ToleranceOptions } from "./tolerance.js";

/** The resolved second-unit format for a dual dimension, or `null` when dual dimensioning is off (no `dualUnit`, or it equals the primary unit). */
export function resolveDualFormat(style: DimensionStyle): ResolvedMeasurementFormat | null {
  const primaryUnit = style.unit ?? "mm";
  const dualUnit = style.dualUnit;
  if (dualUnit === undefined || dualUnit === primaryUnit) return null;
  const fmt: MeasurementFormat = { unit: dualUnit };
  if (style.dualPrecision !== undefined) fmt.precision = style.dualPrecision;
  if (style.dualZeroHandling !== undefined) fmt.zeroHandling = style.dualZeroHandling;
  return resolveMeasurementFormat(fmt);
}

/** Converts a tolerance magnitude from one display unit to another (via mm). */
function convertTolerance(input: ToleranceInput, fromUnit: LengthUnit, toUnit: LengthUnit): ToleranceInput {
  const c = (v: number) => fromMM(toMM(v, fromUnit), toUnit);
  const t = normalizeTolerance(input);
  return { plus: c(t.plus), minus: c(t.minus) };
}

/**
 * The second-unit text for a dual dimension — e.g. `"1.969"`, or `"1.969 ±.004"`
 * when a tolerance is present (converted into the second unit) — with `prefix`
 * (`""`, `"R"`, `"⌀"`, …) repeated. Returns `undefined` when dual dimensioning is
 * off. Callers wrap it in brackets and append it after the primary value:
 * `` `${primary} [${dual}]` ``. The tolerance is shown on the secondary but never
 * the `reference` parentheses (the bracket already carries that meaning).
 */
export function dualSecondary(valueMM: number, prefix: string, style: DimensionStyle, options: ToleranceOptions): string | undefined {
  const dualFmt = resolveDualFormat(style);
  if (!dualFmt) return undefined;
  const primaryUnit = style.unit ?? "mm";
  const nominal = `${prefix}${formatMeasurement(valueMM, dualFmt)}`;
  // The bracketed secondary is the same feature in another unit; qualifiers that belong to the
  // dimension as a whole (reference parens, the repetition count, and TYP) are shown once on the
  // primary and must not repeat inside the bracket.
  const secondaryOptions: ToleranceOptions = { ...options, reference: false, typical: false };
  delete secondaryOptions.count;
  if (options.tolerance !== undefined) secondaryOptions.tolerance = convertTolerance(options.tolerance, primaryUnit, dualFmt.unit);
  return formatToleranceText(nominal, secondaryOptions, dualFmt);
}

/** Appends the bracketed second-unit value to `primaryText`, or returns it unchanged when dual dimensioning is off. */
export function appendDual(primaryText: string, valueMM: number, prefix: string, style: DimensionStyle, options: ToleranceOptions): string {
  const dual = dualSecondary(valueMM, prefix, style, options);
  return dual === undefined ? primaryText : `${primaryText} [${dual}]`;
}
