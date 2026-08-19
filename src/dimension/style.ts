import type { LengthUnit } from "../units.js";
import type { InchDisplay, ZeroHandling } from "./format.js";

/** How an `AngularDimension` writes its value: a decimal degree count, or degrees-minutes-seconds. */
export type AngleFormat = "decimal" | "dms";

/** Shared visual-style knobs accepted by every dimension/leader-based class (`LinearDimension`, `RadialDimension`, `Callout`, etc.). All fields are optional; unset fields fall back to `DEFAULT_DIMENSION_STYLE`. */
export interface DimensionStyle {
  /** Line/arrow stroke width, in mm. */
  strokeWidthMM?: number;
  /** Arrowhead length, in mm. */
  arrowLengthMM?: number;
  /** Arrowhead base width, in mm. */
  arrowWidthMM?: number;
  /** Gap between the measured feature point and the start of its extension line. */
  extensionGapMM?: number;
  /** How far the extension line extends past the dimension line. */
  extensionOvershootMM?: number;
  /** Dimension text height, in mm. */
  textSizeMM?: number;
  /** Extra clearance on each side of the text where the dimension line breaks. */
  textGapMM?: number;
  /**
   * Decimal places used when auto-formatting a measured value. Defaults per
   * `unit`: 2 for `"mm"`, 3 for `"in"` (the usual ASME decimal-inch precision).
   */
  precision?: number;
  /**
   * Display unit for auto-formatted measured values. Geometry is always stored
   * in millimeters; `"in"` converts the measured value to inches *for the
   * displayed text only* (a 50.8 mm distance shows as `2.000`). Defaults to
   * `"mm"`. Has no effect on `AngularDimension`, whose values are degrees.
   */
  unit?: LengthUnit;
  /**
   * Leading/trailing zero suppression, per ASME Y14.5 §2.3.2. Defaults per
   * `unit`: `"none"` for `"mm"` (fixed decimal, e.g. `80.00` — unchanged legacy
   * behavior), `"inch"` for `"in"` (`.250`, no leading zero). Pass `"metric"`
   * for strict ISO/ASME millimeter zero rules (`0.5`, `12.5`, `24`).
   */
  zeroHandling?: ZeroHandling;
  /**
   * How inch values are written (ignored unless `unit: "in"`): `"decimal"`
   * (default), `"fractional"` (`3/8`, `1 1/2`), or `"architectural"`
   * (`3'-6 1/2"`). Unlocks fractional-inch and feet-and-inch drawings.
   */
  inchDisplay?: InchDisplay;
  /** Denominator for `"fractional"`/`"architectural"` inch values (a power of two). Defaults to 16. */
  fractionDenominator?: number;
  /**
   * How `AngularDimension` writes its value: `"decimal"` degrees (default) or
   * `"dms"` degrees-minutes-seconds (`30°30′`). No effect on linear/radial classes.
   */
  angleFormat?: AngleFormat;
  /** Stroke and text color (any valid SVG color string). */
  color?: string;
  /**
   * Dual dimensioning: also show the value converted to this second unit, in
   * brackets after the primary — e.g. `50.00 [1.969]` with `unit: "mm",
   * dualUnit: "in"` (ASME Y14.5 §2.4 bracket method). Omit for a single unit.
   * Has no effect when it equals the primary `unit`, and none on
   * `AngularDimension` (degrees). Any tolerance is converted into the second
   * unit too.
   */
  dualUnit?: LengthUnit;
  /** Decimal places for the bracketed dual value. Defaults per `dualUnit` (2 for mm, 3 for in). */
  dualPrecision?: number;
  /** Zero-suppression for the bracketed dual value. Defaults per `dualUnit` (`"none"` for mm, `"inch"` for in). */
  dualZeroHandling?: ZeroHandling;
}

/** A `DimensionStyle` with every core field filled in; the dual-dimensioning fields stay optional (their absence means "no second unit"). */
export type ResolvedDimensionStyle = Required<Omit<DimensionStyle, "dualUnit" | "dualPrecision" | "dualZeroHandling">> &
  Pick<DimensionStyle, "dualUnit" | "dualPrecision" | "dualZeroHandling">;

/** The default values used for any core `DimensionStyle` field left unset. */
export const DEFAULT_DIMENSION_STYLE: Required<Omit<DimensionStyle, "dualUnit" | "dualPrecision" | "dualZeroHandling">> = {
  strokeWidthMM: 0.25,
  arrowLengthMM: 3,
  arrowWidthMM: 1,
  extensionGapMM: 1,
  extensionOvershootMM: 2,
  textSizeMM: 2.5,
  textGapMM: 1,
  precision: 2,
  unit: "mm",
  zeroHandling: "none",
  inchDisplay: "decimal",
  fractionDenominator: 16,
  angleFormat: "decimal",
  color: "black",
};

/**
 * Fills in any unset `DimensionStyle` fields with `DEFAULT_DIMENSION_STYLE`'s
 * values. `precision` and `zeroHandling` additionally take unit-appropriate
 * defaults when left unset: `unit: "in"` implies precision 3 and `"inch"` zero
 * suppression, so switching a dimension to inches is a one-field change.
 */
export function resolveDimensionStyle(options: DimensionStyle): ResolvedDimensionStyle {
  const unit = options.unit ?? DEFAULT_DIMENSION_STYLE.unit;
  const precision = options.precision ?? (unit === "in" ? 3 : DEFAULT_DIMENSION_STYLE.precision);
  const zeroHandling = options.zeroHandling ?? (unit === "in" ? "inch" : DEFAULT_DIMENSION_STYLE.zeroHandling);
  return { ...DEFAULT_DIMENSION_STYLE, ...options, unit, precision, zeroHandling };
}

/**
 * Merges document-wide `defaults` (e.g. a `Sheet`'s `dimensionDefaults`) *under*
 * an element's own `options`, so per-element options always win. Returns
 * `options` unchanged when there are no defaults. The shared `DimensionStyle`
 * fields (`unit`, `zeroHandling`, `precision`, text/arrow sizes, color) flow in
 * from the defaults; class-specific fields on `options` (offset, angleDeg, …)
 * are preserved. Used by every dimension/leader class at render time.
 */
export function mergeDimensionDefaults<T extends DimensionStyle>(options: T, defaults: DimensionStyle | undefined): T {
  return defaults ? { ...defaults, ...options } : options;
}
