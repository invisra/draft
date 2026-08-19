import { describe, expect, it } from "vitest";
import { formatFractionalInches, formatArchitecturalInches, formatAngleDMS, formatMeasurement, resolveMeasurementFormat } from "../src/dimension/format.js";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { RadialDimension } from "../src/dimension/radialDimension.js";
import { AngularDimension } from "../src/dimension/angularDimension.js";

const textOf = (svg: string) => [...svg.matchAll(/>([^<]*)</g)].map((m) => m[1]!).filter((t) => t.trim());

describe("formatFractionalInches", () => {
  it("reduces to a common fraction rounded to the denominator", () => {
    expect(formatFractionalInches(0.375)).toBe("3/8");
    expect(formatFractionalInches(1.5)).toBe("1 1/2");
    expect(formatFractionalInches(2)).toBe("2");
    expect(formatFractionalInches(0.5)).toBe("1/2");
    expect(formatFractionalInches(0)).toBe("0");
    expect(formatFractionalInches(-0.5)).toBe("-1/2");
  });

  it("rounds to the nearest 1/denominator", () => {
    expect(formatFractionalInches(0.1)).toBe("1/8"); // 0.1·16 = 1.6 → 2/16 = 1/8
    expect(formatFractionalInches(0.1, 32)).toBe("3/32"); // 0.1·32 = 3.2 → 3/32
  });
});

describe("formatArchitecturalInches", () => {
  it("formats feet-and-inches with marks", () => {
    expect(formatArchitecturalInches(42.5)).toBe(`3'-6 1/2"`);
    expect(formatArchitecturalInches(42)).toBe(`3'-6"`);
    expect(formatArchitecturalInches(6)).toBe(`6"`);
    expect(formatArchitecturalInches(0.5)).toBe(`1/2"`);
    expect(formatArchitecturalInches(12)).toBe(`1'-0"`);
  });

  it("carries a rounded-up inch into the next foot", () => {
    // 11.99" rounds to 12" at 1/16 → 1'-0"
    expect(formatArchitecturalInches(11.99)).toBe(`1'-0"`);
  });
});

describe("formatAngleDMS", () => {
  it("splits decimal degrees into degrees/minutes/seconds", () => {
    expect(formatAngleDMS(30.5)).toBe("30°30′");
    expect(formatAngleDMS(30)).toBe("30°");
    expect(formatAngleDMS(45.7625)).toBe("45°45′45″");
    expect(formatAngleDMS(0.25)).toBe("0°15′");
  });

  it("honors a seconds precision", () => {
    expect(formatAngleDMS(10.00025, 1)).toBe("10°0′0.9″");
  });
});

describe("dimension integration", () => {
  it("LinearDimension renders architectural feet-and-inches", () => {
    // 1079.5 mm = 42.5 in
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 1079.5, y: 0 }, { offset: 10, unit: "in", inchDisplay: "architectural" }).toSVG();
    expect(textOf(svg)).toContain(`3'-6 1/2"`);
  });

  it("LinearDimension renders fractional inches", () => {
    // 9.525 mm = 0.375 in
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 9.525, y: 0 }, { offset: 10, unit: "in", inchDisplay: "fractional" }).toSVG();
    expect(textOf(svg)).toContain("3/8");
  });

  it("RadialDimension keeps its R prefix with a fractional value", () => {
    const svg = new RadialDimension({ x: 0, y: 0 }, 9.525, { angleDeg: 45, unit: "in", inchDisplay: "fractional" }).toSVG();
    expect(textOf(svg)).toContain("R3/8");
  });

  it("AngularDimension renders DMS when angleFormat is dms", () => {
    const svg = new AngularDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { radius: 20, angleFormat: "dms" }).toSVG();
    expect(textOf(svg)).toContain("90°");
  });

  it("decimal inch is unchanged (no fractional leak by default)", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 9.525, y: 0 }, { offset: 10, unit: "in" }).toSVG();
    expect(textOf(svg)).toContain(".375");
  });

  it("resolveMeasurementFormat fills the inch-display defaults", () => {
    const f = resolveMeasurementFormat({ unit: "in" });
    expect(f.inchDisplay).toBe("decimal");
    expect(f.fractionDenominator).toBe(16);
    expect(formatMeasurement(9.525, f)).toBe(".375");
  });
});
