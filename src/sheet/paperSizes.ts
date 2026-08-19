import { MM_PER_INCH } from "../units.js";

/** A named paper size, in its base (portrait) orientation. */
export interface PaperSize {
  /** Full descriptive name, e.g. "ANSI A (Letter)". */
  readonly name: string;
  /** Base (portrait) width, in mm. */
  readonly widthMM: number;
  /** Base (portrait) height, in mm. */
  readonly heightMM: number;
  /** Short code shown in a title block's SIZE field, e.g. "A", "A4". */
  readonly sizeLabel: string;
}

function ansi(name: string, sizeLabel: string, widthIn: number, heightIn: number): PaperSize {
  return { name, sizeLabel, widthMM: widthIn * MM_PER_INCH, heightMM: heightIn * MM_PER_INCH };
}

// ANSI Y14.1 sheet sizes (US), given here in their base (portrait) orientation.
/** ANSI Y14.1 "A" size (8.5 × 11in, US Letter). */
export const ANSI_A: PaperSize = ansi("ANSI A (Letter)", "A", 8.5, 11);
/** ANSI Y14.1 "B" size (11 × 17in). */
export const ANSI_B: PaperSize = ansi("ANSI B", "B", 11, 17);
/** ANSI Y14.1 "C" size (17 × 22in). */
export const ANSI_C: PaperSize = ansi("ANSI C", "C", 17, 22);
/** ANSI Y14.1 "D" size (22 × 34in). */
export const ANSI_D: PaperSize = ansi("ANSI D", "D", 22, 34);
/** ANSI Y14.1 "E" size (34 × 44in). */
export const ANSI_E: PaperSize = ansi("ANSI E", "E", 34, 44);

// ISO 216 A series (mm), standard rounded values. Also the series used for JIS
// (Japanese) mechanical engineering drawings — JIS A is dimensionally identical
// to ISO A. (JIS B is a real but *different* series, sized for general
// stationery/publishing, not engineering drafting — deliberately not included
// here, since offering it as a drafting size would be wrong, not just extra.)
/** ISO 216 A0 (841 × 1189mm). Dimensionally identical to JIS A0. */
export const A0: PaperSize = { name: "A0", sizeLabel: "A0", widthMM: 841, heightMM: 1189 };
/** ISO 216 A1 (594 × 841mm). Dimensionally identical to JIS A1. */
export const A1: PaperSize = { name: "A1", sizeLabel: "A1", widthMM: 594, heightMM: 841 };
/** ISO 216 A2 (420 × 594mm). Dimensionally identical to JIS A2. */
export const A2: PaperSize = { name: "A2", sizeLabel: "A2", widthMM: 420, heightMM: 594 };
/** ISO 216 A3 (297 × 420mm). Dimensionally identical to JIS A3. */
export const A3: PaperSize = { name: "A3", sizeLabel: "A3", widthMM: 297, heightMM: 420 };
/** ISO 216 A4 (210 × 297mm). Dimensionally identical to JIS A4. */
export const A4: PaperSize = { name: "A4", sizeLabel: "A4", widthMM: 210, heightMM: 297 };
/** ISO 216 A5 (148 × 210mm). Dimensionally identical to JIS A5. */
export const A5: PaperSize = { name: "A5", sizeLabel: "A5", widthMM: 148, heightMM: 210 };

// US architectural sheet sizes, given here in their base (portrait) orientation.
/** US architectural "A" size (9 × 12in). */
export const ARCH_A: PaperSize = ansi("ARCH A", "ARCH A", 9, 12);
/** US architectural "B" size (12 × 18in). */
export const ARCH_B: PaperSize = ansi("ARCH B", "ARCH B", 12, 18);
/** US architectural "C" size (18 × 24in). */
export const ARCH_C: PaperSize = ansi("ARCH C", "ARCH C", 18, 24);
/** US architectural "D" size (24 × 36in). */
export const ARCH_D: PaperSize = ansi("ARCH D", "ARCH D", 24, 36);
/** US architectural "E" size (36 × 48in). */
export const ARCH_E: PaperSize = ansi("ARCH E", "ARCH E", 36, 48);
/** US architectural "E1" size (30 × 42in). */
export const ARCH_E1: PaperSize = ansi("ARCH E1", "ARCH E1", 30, 42);

/** Every built-in {@link PaperSize}, keyed by name. */
export const PAPER_SIZES = {
  ANSI_A,
  ANSI_B,
  ANSI_C,
  ANSI_D,
  ANSI_E,
  A0,
  A1,
  A2,
  A3,
  A4,
  A5,
  ARCH_A,
  ARCH_B,
  ARCH_C,
  ARCH_D,
  ARCH_E,
  ARCH_E1,
} as const satisfies Record<string, PaperSize>;

/** A key into {@link PAPER_SIZES}. */
export type PaperSizeName = keyof typeof PAPER_SIZES;

/** A one-off sheet size not covered by `PAPER_SIZES`, e.g. a non-standard panel or a client-specific template. */
export function customPaperSize(widthMM: number, heightMM: number, label = "CUSTOM"): PaperSize {
  return { name: label, sizeLabel: label, widthMM, heightMM };
}
