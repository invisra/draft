import { describe, expect, it } from "vitest";
import { ARCH_A, ARCH_D, ARCH_E1, customPaperSize } from "../src/sheet/paperSizes.js";
import { MM_PER_INCH } from "../src/units.js";
import { Sheet } from "../src/sheet/sheet.js";

describe("Architectural paper sizes", () => {
  it("ARCH A is 9x12 inches", () => {
    expect(ARCH_A.widthMM).toBeCloseTo(9 * MM_PER_INCH);
    expect(ARCH_A.heightMM).toBeCloseTo(12 * MM_PER_INCH);
  });

  it("ARCH D is 24x36 inches", () => {
    expect(ARCH_D.widthMM).toBeCloseTo(24 * MM_PER_INCH);
    expect(ARCH_D.heightMM).toBeCloseTo(36 * MM_PER_INCH);
  });

  it("ARCH E1 is 30x42 inches", () => {
    expect(ARCH_E1.widthMM).toBeCloseTo(30 * MM_PER_INCH);
    expect(ARCH_E1.heightMM).toBeCloseTo(42 * MM_PER_INCH);
  });

  it("works as a Sheet paperSize", () => {
    const sheet = new Sheet({ paperSize: ARCH_D, orientation: "portrait" });
    expect(sheet.widthMM).toBeCloseTo(24 * MM_PER_INCH);
    expect(sheet.heightMM).toBeCloseTo(36 * MM_PER_INCH);
  });
});

describe("customPaperSize", () => {
  it("builds a PaperSize from raw mm dimensions", () => {
    const size = customPaperSize(400, 300);
    expect(size.widthMM).toBe(400);
    expect(size.heightMM).toBe(300);
    expect(size.name).toBe("CUSTOM");
    expect(size.sizeLabel).toBe("CUSTOM");
  });

  it("accepts a custom label", () => {
    const size = customPaperSize(400, 300, "PANEL-1");
    expect(size.sizeLabel).toBe("PANEL-1");
  });

  it("works as a Sheet paperSize", () => {
    const sheet = new Sheet({ paperSize: customPaperSize(500, 350), orientation: "portrait" });
    // portrait: width <= height, so 350x500
    expect(sheet.widthMM).toBeCloseTo(350);
    expect(sheet.heightMM).toBeCloseTo(500);
  });
});
