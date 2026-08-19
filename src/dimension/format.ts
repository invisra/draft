import { fromMM, type LengthUnit } from "../units.js";
import { formatFixed, formatNumber } from "../util.js";

/**
 * How leading/trailing zeros are shown, per ASME Y14.5 §2.3.2 (US) / ISO 129-1:
 *
 * - `"inch"` — US customary inch practice: **no** leading zero on values below
 *   one (`.250`, not `0.250`), and trailing zeros **kept** to the field's
 *   precision (`.250`, matching the tolerance's decimal places).
 * - `"metric"` — millimeter practice: leading zero **kept** (`0.5`), trailing
 *   zeros **dropped** (`12.5`, not `12.50`; a whole number shows no decimal at
 *   all, `24`).
 * - `"none"` — plain fixed-decimal: leading zero kept, trailing zeros kept
 *   (`0.50`, `80.00`, `24.00`). This is the library's original behavior and the
 *   default for millimeter dimensions, so existing output is unchanged.
 */
export type ZeroHandling = "inch" | "metric" | "none";

/**
 * How an inch value is written (ignored for millimeters):
 *
 * - `"decimal"` — a decimal number (`0.375`), the default, honoring `precision`
 *   and `zeroHandling`.
 * - `"fractional"` — a common drafting fraction rounded to `fractionDenominator`
 *   (`3/8`, `1 1/2`), reduced to lowest terms.
 * - `"architectural"` — feet and inches with the `'`/`"` marks (`3'-6 1/2"`),
 *   the inch part fractional to `fractionDenominator`.
 */
export type InchDisplay = "decimal" | "fractional" | "architectural";

/**
 * How a measured value is turned into display text: which unit it's shown in,
 * how many decimal places, and how zeros are suppressed. All geometry is stored
 * in millimeters internally (see {@link toMM}); a `unit` of `"in"` converts the
 * measured millimeter value to inches *for display only* before formatting.
 */
export interface MeasurementFormat {
  /** Display unit. Geometry is always mm internally; `"in"` converts before formatting. Defaults to `"mm"`. */
  unit?: LengthUnit;
  /** Decimal places. Defaults per unit: 2 for `"mm"`, 3 for `"in"` (the usual ASME decimal-inch precision). */
  precision?: number;
  /** Zero-suppression style. Defaults per unit: `"none"` for `"mm"` (unchanged legacy output), `"inch"` for `"in"`. */
  zeroHandling?: ZeroHandling;
  /** How inch values are written (`"decimal"` default, `"fractional"`, or `"architectural"`); ignored for millimeters. */
  inchDisplay?: InchDisplay;
  /** Denominator for `"fractional"`/`"architectural"` inch values — a power of two (8/16/32/64…). Defaults to 16. */
  fractionDenominator?: number;
}

/** A {@link MeasurementFormat} with every field resolved to a concrete value. */
export interface ResolvedMeasurementFormat {
  /** Display unit the value is shown in (geometry is always mm internally). */
  unit: LengthUnit;
  /** Number of decimal places. */
  precision: number;
  /** Leading/trailing zero-suppression style. */
  zeroHandling: ZeroHandling;
  /** How inch values are written. Absent is treated as `"decimal"`. */
  inchDisplay?: InchDisplay;
  /** Denominator for fractional/architectural inch values. Absent is treated as 16. */
  fractionDenominator?: number;
}

/** Fills in any unset {@link MeasurementFormat} field with its unit-appropriate default. */
export function resolveMeasurementFormat(fmt: MeasurementFormat = {}): ResolvedMeasurementFormat {
  const unit = fmt.unit ?? "mm";
  return {
    unit,
    precision: fmt.precision ?? (unit === "in" ? 3 : 2),
    zeroHandling: fmt.zeroHandling ?? (unit === "in" ? "inch" : "none"),
    inchDisplay: fmt.inchDisplay ?? "decimal",
    fractionDenominator: fmt.fractionDenominator ?? 16,
  };
}

/**
 * Accepts either a bare `precision` number (legacy: millimeter, no zero
 * suppression) or an already-resolved format. Lets shared formatting helpers
 * keep their old numeric-precision call sites working unchanged while also
 * accepting a full format.
 */
export function toMeasurementFormat(format: number | ResolvedMeasurementFormat): ResolvedMeasurementFormat {
  return typeof format === "number"
    ? { unit: "mm", precision: format, zeroHandling: "none", inchDisplay: "decimal", fractionDenominator: 16 }
    : format;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Formats an inch value as a reduced common fraction rounded to `denominator` (a power of two): `0.375` → `"3/8"`, `1.5` → `"1 1/2"`, `2` → `"2"`. */
export function formatFractionalInches(valueInInches: number, denominator = 16): string {
  const negative = valueInInches < 0;
  const units = Math.round(Math.abs(valueInInches) * denominator); // count of 1/denominator increments
  const whole = Math.floor(units / denominator);
  const rem = units - whole * denominator;
  let body: string;
  if (rem === 0) {
    body = `${whole}`;
  } else {
    const g = gcd(rem, denominator);
    const frac = `${rem / g}/${denominator / g}`;
    body = whole === 0 ? frac : `${whole} ${frac}`;
  }
  return negative && body !== "0" ? `-${body}` : body;
}

/** Formats an inch value as architectural feet-and-inches with `'`/`"` marks, the inch part fractional to `denominator`: `42.5` → `3'-6 1/2"`, `6` → `6"`. */
export function formatArchitecturalInches(valueInInches: number, denominator = 16): string {
  const negative = valueInInches < 0;
  const units = Math.round(Math.abs(valueInInches) * denominator); // total in 1/denominator increments
  const unitsPerFoot = 12 * denominator;
  const feet = Math.floor(units / unitsPerFoot);
  const inchUnits = units - feet * unitsPerFoot;
  const wholeIn = Math.floor(inchUnits / denominator);
  const rem = inchUnits - wholeIn * denominator;
  let inchPart: string;
  if (rem === 0) {
    inchPart = `${wholeIn}`;
  } else {
    const g = gcd(rem, denominator);
    const frac = `${rem / g}/${denominator / g}`;
    inchPart = wholeIn === 0 ? frac : `${wholeIn} ${frac}`;
  }
  const sign = negative ? "-" : "";
  return feet > 0 ? `${sign}${feet}'-${inchPart}"` : `${sign}${inchPart}"`;
}

/** Applies {@link ZeroHandling} to an already fixed-decimal string (which may carry a leading `-`). */
export function applyZeroHandling(fixed: string, zeroHandling: ZeroHandling): string {
  if (zeroHandling === "none") return fixed;
  const negative = fixed.startsWith("-");
  let body = negative ? fixed.slice(1) : fixed;
  if (zeroHandling === "inch") {
    // Drop a single leading zero in the integer part: "0.250" -> ".250".
    if (body.startsWith("0.")) body = body.slice(1);
  } else {
    // metric: drop trailing fractional zeros, then a now-dangling decimal point.
    if (body.includes(".")) body = body.replace(/0+$/, "").replace(/\.$/, "");
  }
  return negative ? `-${body}` : body;
}

/** Formats a value **already in the display unit** (e.g. a tolerance the caller supplied in `unit`). */
export function formatValue(value: number, format: number | ResolvedMeasurementFormat): string {
  const fmt = toMeasurementFormat(format);
  const inchDisplay = fmt.inchDisplay ?? "decimal";
  if (fmt.unit === "in" && inchDisplay !== "decimal") {
    const denom = fmt.fractionDenominator ?? 16;
    return inchDisplay === "architectural" ? formatArchitecturalInches(value, denom) : formatFractionalInches(value, denom);
  }
  return applyZeroHandling(formatFixed(value, fmt.precision), fmt.zeroHandling);
}

/** Renders a decimal-degree angle in degrees-minutes-seconds notation (`°′″`), rounding to `secondsPrecision` decimal places on the seconds: `30.5` → `"30°30′"`, `45.7625` → `"45°45′45″"`. Minutes/seconds are omitted when zero. */
export function formatAngleDMS(decimalDegrees: number, secondsPrecision = 0): string {
  const negative = decimalDegrees < 0;
  const factor = 10 ** secondsPrecision;
  let sec = Math.round(Math.abs(decimalDegrees) * 3600 * factor) / factor; // total seconds, rounded (carry handled before splitting)
  const deg = Math.floor(sec / 3600);
  sec -= deg * 3600;
  const min = Math.floor(sec / 60);
  sec -= min * 60;
  const secStr = sec.toFixed(secondsPrecision);
  let out = `${deg}°`;
  if (min > 0 || parseFloat(secStr) > 0) out += `${min}′`;
  if (parseFloat(secStr) > 0) out += `${secStr}″`;
  return negative ? `-${out}` : out;
}

/** Converts a millimeter geometry value to the display unit, then formats it per `format`. */
export function formatMeasurement(valueMM: number, format: number | ResolvedMeasurementFormat): string {
  const fmt = toMeasurementFormat(format);
  return formatValue(fromMM(valueMM, fmt.unit), fmt);
}

/**
 * Formats a tolerance-block value with inch zero-suppression while preserving
 * the value's own natural decimal places (`.005`, `.03`, `.1`) rather than
 * padding to a fixed precision. Used by {@link inchToleranceBlock}.
 */
export function formatInchToleranceValue(value: number): string {
  return applyZeroHandling(formatNumber(value, 6), "inch");
}
