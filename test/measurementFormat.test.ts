import { describe, expect, it } from "vitest";
import {
  applyZeroHandling,
  formatInchToleranceValue,
  formatMeasurement,
  formatValue,
  resolveMeasurementFormat,
} from "../src/dimension/format.js";
import { formatFixed } from "../src/util.js";
import { inchToleranceBlock } from "../src/dimension/inchToleranceBlock.js";
import { formatLimits, formatToleranceText } from "../src/dimension/tolerance.js";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { RadialDimension, DiameterDimension } from "../src/dimension/radialDimension.js";
import { MM_PER_INCH } from "../src/units.js";

describe("resolveMeasurementFormat", () => {
  it("defaults to mm / precision 2 / no zero suppression", () => {
    expect(resolveMeasurementFormat()).toEqual({ unit: "mm", precision: 2, zeroHandling: "none", inchDisplay: "decimal", fractionDenominator: 16 });
  });

  it("defaults inch to precision 3 and inch zero suppression", () => {
    expect(resolveMeasurementFormat({ unit: "in" })).toEqual({ unit: "in", precision: 3, zeroHandling: "inch", inchDisplay: "decimal", fractionDenominator: 16 });
  });

  it("honors explicit overrides", () => {
    expect(resolveMeasurementFormat({ unit: "in", precision: 4, zeroHandling: "none" })).toEqual({
      unit: "in",
      precision: 4,
      zeroHandling: "none",
      inchDisplay: "decimal",
      fractionDenominator: 16,
    });
  });
});

describe("applyZeroHandling", () => {
  it("inch: drops a single leading zero, keeps trailing zeros", () => {
    expect(applyZeroHandling("0.250", "inch")).toBe(".250");
    expect(applyZeroHandling("80.00", "inch")).toBe("80.00");
    expect(applyZeroHandling("-0.005", "inch")).toBe("-.005");
  });

  it("metric: keeps leading zero, drops trailing zeros (and a whole number's decimal)", () => {
    expect(applyZeroHandling("0.50", "metric")).toBe("0.5");
    expect(applyZeroHandling("12.50", "metric")).toBe("12.5");
    expect(applyZeroHandling("24.00", "metric")).toBe("24");
    expect(applyZeroHandling("-0.50", "metric")).toBe("-0.5");
  });

  it("none: leaves the fixed-decimal string untouched", () => {
    expect(applyZeroHandling("0.50", "none")).toBe("0.50");
    expect(applyZeroHandling("80.00", "none")).toBe("80.00");
  });
});

describe("formatMeasurement", () => {
  it("converts a mm geometry value to inches for display", () => {
    // 2 inches expressed in mm, shown as a decimal-inch value with no leading concern (>= 1)
    expect(formatMeasurement(2 * MM_PER_INCH, { unit: "in", precision: 3, zeroHandling: "inch" })).toBe("2.000");
    // half an inch: no leading zero
    expect(formatMeasurement(0.5 * MM_PER_INCH, { unit: "in", precision: 3, zeroHandling: "inch" })).toBe(".500");
  });

  it("leaves a mm value in mm with the legacy fixed format", () => {
    expect(formatMeasurement(80, 2)).toBe("80.00");
  });
});

describe("formatValue treats its input as already in display units", () => {
  it("does not convert (a supplied tolerance is a display-unit magnitude)", () => {
    expect(formatValue(0.005, { unit: "in", precision: 3, zeroHandling: "inch" })).toBe(".005");
  });
});

describe("tolerance formatting is unit-aware", () => {
  it("inch inline tolerance drops leading zeros on both nominal-appended value", () => {
    const inchFmt = resolveMeasurementFormat({ unit: "in" });
    expect(formatToleranceText("2.000", { tolerance: 0.005 }, inchFmt)).toBe("2.000 ±.005");
  });

  it("inch limits drop leading zeros", () => {
    const inchFmt = resolveMeasurementFormat({ unit: "in" });
    expect(formatLimits(0.5, 0.005, inchFmt)).toEqual({ upper: ".505", lower: ".495" });
  });

  it("legacy numeric precision path is unchanged", () => {
    expect(formatToleranceText("80", { tolerance: 0.1 }, 2)).toBe("80 ±0.10");
    expect(formatLimits(80, 0.1, 2)).toEqual({ upper: "80.10", lower: "79.90" });
  });
});

describe("LinearDimension in inches", () => {
  it("shows a 2\" (50.8mm) distance as an inch value with 3-place precision", () => {
    const svg = new LinearDimension(
      { x: 0, y: 0 },
      { x: 2 * MM_PER_INCH, y: 0 },
      { offset: -10, orientation: "horizontal", unit: "in" },
    ).toSVG();
    expect(svg).toContain(">2.000<");
  });

  it("drops the leading zero on a sub-inch dimension (ASME Y14.5)", () => {
    const svg = new LinearDimension(
      { x: 0, y: 0 },
      { x: 0.5 * MM_PER_INCH, y: 0 },
      { offset: -10, orientation: "horizontal", unit: "in" },
    ).toSVG();
    expect(svg).toContain(">.500<");
    expect(svg).not.toContain(">0.500<");
  });

  it("carries the display unit into inline tolerances", () => {
    const svg = new LinearDimension(
      { x: 0, y: 0 },
      { x: 2 * MM_PER_INCH, y: 0 },
      { offset: -10, orientation: "horizontal", unit: "in", tolerance: 0.005 },
    ).toSVG();
    expect(svg).toContain(">2.000 ±.005<");
  });

  it("metric zero-handling drops trailing zeros", () => {
    const svg = new LinearDimension(
      { x: 0, y: 0 },
      { x: 12.5, y: 0 },
      { offset: -10, orientation: "horizontal", zeroHandling: "metric" },
    ).toSVG();
    expect(svg).toContain(">12.5<");
  });
});

describe("RadialDimension / DiameterDimension in inches", () => {
  it("formats the radius in inches", () => {
    const svg = new RadialDimension({ x: 0, y: 0 }, 0.25 * MM_PER_INCH, { angleDeg: 45, unit: "in" }).toSVG();
    expect(svg).toContain(">R.250<");
  });

  it("formats the diameter in inches", () => {
    const svg = new DiameterDimension({ x: 0, y: 0 }, 0.25 * MM_PER_INCH, { angleDeg: 45, unit: "in" }).toSVG();
    expect(svg).toContain(">⌀.500<");
  });
});

describe("inchToleranceBlock", () => {
  it("builds the standard decimal-inch block with inch zero suppression", () => {
    expect(inchToleranceBlock({ onePlace: 0.03, twoPlace: 0.01, threePlace: 0.005, angularDeg: 0.5 })).toEqual([
      ".X ±.03",
      ".XX ±.01",
      ".XXX ±.005",
      "ANGLES ±0.5°",
    ]);
  });

  it("supports fractional and four-place fields", () => {
    expect(inchToleranceBlock({ fractionalInch: "1/64", fourPlace: 0.0005 })).toEqual([
      "FRAC ±1/64",
      ".XXXX ±.0005",
    ]);
  });

  it("throws when no field is provided", () => {
    expect(() => inchToleranceBlock({})).toThrow();
  });
});

describe("formatInchToleranceValue keeps natural decimals", () => {
  it("does not pad to a fixed precision", () => {
    expect(formatInchToleranceValue(0.1)).toBe(".1");
    expect(formatInchToleranceValue(0.03)).toBe(".03");
    expect(formatInchToleranceValue(0.005)).toBe(".005");
  });
});

describe("no negative-zero display", () => {
  it("formatFixed drops the sign for values that round to zero", () => {
    expect(formatFixed(-0, 2)).toBe("0.00");
    expect(formatFixed(-0.001, 2)).toBe("0.00"); // rounds to zero at 2dp
    expect(formatFixed(-0.0004, 3)).toBe("0.000");
    expect(formatFixed(-0.5, 2)).toBe("-0.50"); // genuinely negative, keep the sign
    expect(formatFixed(-12.5, 2)).toBe("-12.50");
  });

  it("flows through formatValue (e.g. an ordinate value just below the origin)", () => {
    expect(formatValue(-0.002, { unit: "mm", precision: 2, zeroHandling: "none" })).toBe("0.00");
  });
});
