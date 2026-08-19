import type { DimensionStyle } from "./style.js";

/**
 * Drafting defaults for a **US decimal-inch** drawing (ASME Y14.5): dimensions
 * display in inches, precision defaults to 3 places, and zeros follow the ASME
 * §2.3.2 inch rule — no leading zero (`.250`), trailing zeros kept. Pass as a
 * `Sheet`'s `dimensionDefaults` so every dimension inherits it; per-dimension
 * options still override. Spread it to tweak (`{ ...ASME_INCH, textSizeMM: 3.5 }`).
 */
export const ASME_INCH: DimensionStyle = { unit: "in", zeroHandling: "inch" };

/**
 * Drafting defaults for a **metric millimeter** drawing under ASME Y14.5's
 * millimeter rules: leading zero kept (`0.5`), trailing zeros dropped (`12.5`,
 * `24`). Same zero convention as {@link ISO_METRIC}.
 */
export const ASME_METRIC: DimensionStyle = { unit: "mm", zeroHandling: "metric" };

/**
 * Drafting defaults for an **ISO** millimeter drawing (ISO 129-1): millimeter
 * display with the ISO zero convention (leading zero kept, trailing zeros
 * dropped). Identical in effect to {@link ASME_METRIC}; provided under its ISO
 * name for clarity at the call site.
 */
export const ISO_METRIC: DimensionStyle = { unit: "mm", zeroHandling: "metric" };
