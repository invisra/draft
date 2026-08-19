import { describe, expect, it } from "vitest";
import { estimateTextWidth } from "../src/dimension/label.js";
import { textWidth } from "../src/svg/fontMetrics.js";

describe("estimateTextWidth (AFM-based)", () => {
  it("is proportional — wide glyphs measure much wider than narrow ones", () => {
    // a flat per-character factor would make these equal; real metrics don't
    expect(estimateTextWidth("MMMM", 10)).toBeGreaterThan(estimateTextWidth("iiii", 10) * 3);
  });

  it("matches the exact AFM advance for a known string", () => {
    // Helvetica "8" = 556/1000 em
    expect(estimateTextWidth("8", 10)).toBeCloseTo(5.56, 6);
    expect(estimateTextWidth("88", 10)).toBeCloseTo(11.12, 6);
  });

  it("bold is wider than regular for the same text", () => {
    expect(estimateTextWidth("BOLD", 10, true)).toBeGreaterThan(estimateTextWidth("BOLD", 10, false));
  });

  it("measures the drafting symbols instead of assuming a fixed width", () => {
    // ⌀ isn't in the AFM table → falls back to the median advance (556/1000), not 0
    expect(estimateTextWidth("⌀", 10)).toBeGreaterThan(0);
  });

  it("delegates to the shared fontMetrics.textWidth", () => {
    expect(estimateTextWidth("1/4-20 UNC", 2.5)).toBeCloseTo(textWidth("1/4-20 UNC", "Helvetica", 2.5), 9);
  });

  it("scales linearly with font size", () => {
    expect(estimateTextWidth("R12.00", 5)).toBeCloseTo(estimateTextWidth("R12.00", 2.5) * 2, 6);
  });
});
