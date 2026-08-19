import { formatValue, toMeasurementFormat, type ResolvedMeasurementFormat } from "./format.js";

/** An asymmetric (bilateral) tolerance: `+plus` / `-minus`. */
export interface ToleranceValue {
  /** Upper deviation magnitude. */
  plus: number;
  /** Stored as a positive magnitude; rendered with a leading minus sign. */
  minus: number;
}

/** A plain number is shorthand for a symmetric +/- tolerance. */
export type ToleranceInput = number | ToleranceValue;

/** Converts a plain-number shorthand into an explicit `{ plus, minus }` pair; passes an already-explicit value through unchanged. */
export function normalizeTolerance(input: ToleranceInput): ToleranceValue {
  return typeof input === "number" ? { plus: input, minus: input } : input;
}

/** How a dimension's tolerance is displayed: inline nominal + `±`, or stacked upper/lower limits. */
export type ToleranceDisplay = "nominal" | "limits";

/** Tolerance/basic/reference options shared by every dimension class. */
export interface ToleranceOptions {
  /** A symmetric +/- value, or an explicit { plus, minus } pair for an asymmetric (bilateral) tolerance. */
  tolerance?: ToleranceInput;
  /** "nominal" (default): the nominal value with an appended tolerance. "limits": computed upper/lower limits, stacked, nominal omitted. */
  toleranceDisplay?: ToleranceDisplay;
  /**
   * ASME Y14.5 basic dimension: a theoretically exact value (no tolerance of its own — the
   * tolerance lives in an associated GD&T feature control frame instead), shown boxed. Only
   * applies to the plain single-line display; combining with `toleranceDisplay: "limits"` doesn't
   * make sense (a basic dimension has no tolerance to compute limits from) and is ignored.
   */
  basic?: boolean;
  /** Reference dimension: shown parenthesized, e.g. "(40.00)" — for convenience/traceability, not for inspection. Applies to the plain single-line display only, same as `basic`. */
  reference?: boolean;
  /**
   * ASME Y14.5 §1.9.5 repetition prefix: the number of identical features the dimension applies
   * to, shown as `{count}X` before the value — e.g. `count: 4` → `4X ⌀5.00`. Omit for a single
   * feature. Applies to the plain single-line display.
   */
  count?: number;
  /** ASME "typical" qualifier: appends ` TYP` after the value, meaning the dimension applies to all like features. Applies to the plain single-line display. */
  typical?: boolean;
  /**
   * ASME Y14.5 §2.2 not-to-scale dimension: the value is drawn **underlined** to flag that the
   * feature is intentionally not drawn to the stated size. Applies to both the single-line and the
   * stacked-limits displays. (DXF `TEXT` can't carry an underline, so it is SVG/PDF-only there.)
   */
  notToScale?: boolean;
}

/**
 * Single-line "nominal ±X" or "nominal +X/-Y" text, optionally parenthesized
 * (`reference`). Ignores toleranceDisplay: "limits" (that's a stacked, two-line
 * layout — see renderDimensionLabel). `format` is either a bare decimal
 * `precision` (millimeter, no zero suppression) or a full
 * {@link ResolvedMeasurementFormat}; when a unit-aware format is given, the
 * tolerance magnitude is treated as being in that display unit.
 */
export function formatToleranceText(nominalText: string, options: ToleranceOptions, format: number | ResolvedMeasurementFormat): string {
  const fmt = toMeasurementFormat(format);
  let text = nominalText;
  if (options.tolerance !== undefined) {
    const tol = normalizeTolerance(options.tolerance);
    text = tol.plus === tol.minus
      ? `${nominalText} ±${formatValue(tol.plus, fmt)}`
      : `${nominalText} +${formatValue(tol.plus, fmt)}/-${formatValue(tol.minus, fmt)}`;
  }
  if (options.reference) text = `(${text})`;
  if (options.count !== undefined) text = `${options.count}X ${text}`;
  if (options.typical) text = `${text} TYP`;
  return text;
}

/** A dimension's computed upper/lower limits, pre-formatted at a fixed decimal precision. */
export interface LimitLines {
  /** Formatted upper limit. */
  upper: string;
  /** Formatted lower limit. */
  lower: string;
}

/**
 * Computes `measured`'s upper/lower limits from a tolerance, formatted per
 * `format` (a bare decimal `precision`, or a full
 * {@link ResolvedMeasurementFormat}). `measured` and the tolerance are both
 * expected to already be in the format's display unit — the caller converts the
 * measured geometry before calling.
 */
export function formatLimits(measured: number, tolerance: ToleranceInput, format: number | ResolvedMeasurementFormat): LimitLines {
  const fmt = toMeasurementFormat(format);
  const tol = normalizeTolerance(tolerance);
  return {
    upper: formatValue(measured + tol.plus, fmt),
    lower: formatValue(measured - tol.minus, fmt),
  };
}
