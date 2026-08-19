/** Millimeters per inch, for converting between `LengthUnit`s. */
export const MM_PER_INCH = 25.4;

/** A physical length unit accepted at API boundaries (`Sheet`, `customPaperSize`, etc.). */
export type LengthUnit = "mm" | "in";

/** All internal geometry is stored in millimeters. Use these helpers at the boundary. */
export function toMM(value: number, unit: LengthUnit): number {
  return unit === "in" ? value * MM_PER_INCH : value;
}

/** Converts a millimeter value back to `unit`, the inverse of {@link toMM}. */
export function fromMM(valueMM: number, unit: LengthUnit): number {
  return unit === "in" ? valueMM / MM_PER_INCH : valueMM;
}
