import { describe, expect, it } from "vitest";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { RadialDimension, DiameterDimension } from "../src/dimension/radialDimension.js";
import { dualSecondary, resolveDualFormat } from "../src/dimension/dual.js";

const textOf = (svg: string) => [...svg.matchAll(/>([^<]*)</g)].map((m) => m[1]!).filter((t) => t.trim());

describe("dual dimensioning", () => {
  it("appends the bracketed second unit to a linear dimension (50.8mm = 2.000in)", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 50.8, y: 0 }, { offset: 10, dualUnit: "in" }).toSVG();
    expect(textOf(svg)).toContain("50.80 [2.000]");
  });

  it("converts the tolerance into the second unit", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 50.8, y: 0 }, { offset: 10, dualUnit: "in", tolerance: 0.5 }).toSVG();
    // ±0.50 mm ≈ ±.020 in (inch zero-suppression on the secondary)
    expect(textOf(svg)).toContain("50.80 ±0.50 [2.000 ±.020]");
  });

  it("repeats the ⌀ prefix inside the bracket for a diameter dimension", () => {
    const svg = new DiameterDimension({ x: 0, y: 0 }, 12.7, { angleDeg: 45, dualUnit: "in" }).toSVG();
    expect(textOf(svg)).toContain("⌀25.40 [⌀1.000]");
  });

  it("repeats the R prefix for a radius dimension", () => {
    const svg = new RadialDimension({ x: 0, y: 0 }, 25.4, { angleDeg: 45, dualUnit: "in" }).toSVG();
    expect(textOf(svg)).toContain("R25.40 [R1.000]");
  });

  it("supports an inch-primary, mm-secondary drawing", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 25.4, y: 0 }, { offset: 10, unit: "in", dualUnit: "mm" }).toSVG();
    expect(textOf(svg)).toContain("1.000 [25.40]");
  });

  it("respects an explicit dual precision", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 50.8, y: 0 }, { offset: 10, dualUnit: "in", dualPrecision: 4 }).toSVG();
    expect(textOf(svg)).toContain("50.80 [2.0000]");
  });

  it("does nothing when dualUnit equals the primary unit, or is unset", () => {
    expect(resolveDualFormat({ unit: "mm", dualUnit: "mm" })).toBeNull();
    expect(resolveDualFormat({ unit: "mm" })).toBeNull();
    expect(dualSecondary(50.8, "", { unit: "mm" }, {})).toBeUndefined();
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 50.8, y: 0 }, { offset: 10 }).toSVG();
    expect(textOf(svg)).toContain("50.80");
    expect(textOf(svg).join("")).not.toContain("[");
  });

  it("leaves a text override untouched (no dual appended)", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 50.8, y: 0 }, { offset: 10, dualUnit: "in", text: "SEE NOTE" }).toSVG();
    expect(textOf(svg)).toContain("SEE NOTE");
    expect(textOf(svg).join("")).not.toContain("[");
  });
});
