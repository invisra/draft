import { describe, expect, it } from "vitest";
import { rectangle } from "../src/geometry/shapes.js";
import { hatch } from "../src/hatch/hatch.js";
import { ANSI31, ANSI32, ANSI34, ANSI35, ANSI37, ANSI_HATCH_PATTERNS, hatchPattern } from "../src/hatch/materialHatch.js";
import { toMM } from "../src/units.js";

function perpPosition(pathData: string, angleDeg: number): number {
  const m = /M ([\d.-]+) ([\d.-]+)/.exec(pathData)!;
  const x = parseFloat(m[1]!);
  const y = parseFloat(m[2]!);
  const rad = (angleDeg * Math.PI) / 180;
  // perpendicular unit vector to the line direction
  return -x * Math.sin(rad) + y * Math.cos(rad);
}

function residueDistance(value: number, target: number, spacing: number): number {
  const diff = (((value - target) % spacing) + spacing) % spacing;
  return Math.min(diff, spacing - diff);
}

describe("hatch phaseMM", () => {
  it("shifts every line onto the phaseMM residue class (mod spacing), unphased lines stay on the 0 residue class", () => {
    const boundary = rectangle(0, 0, 40, 40);
    const spacing = 5;
    const phase = 2;
    const base = hatch(boundary, { angleDeg: 30, spacingMM: spacing });
    const shifted = hatch(boundary, { angleDeg: 30, spacingMM: spacing, phaseMM: phase });

    expect(base.length).toBeGreaterThan(0);
    expect(shifted.length).toBeGreaterThan(0);
    for (const l of base) expect(residueDistance(perpPosition(l.path.toSVGPathData(), 30), 0, spacing)).toBeCloseTo(0, 3); // path.toSVGPathData() rounds coordinates, so a little serialization-level slop is expected
    for (const l of shifted) expect(residueDistance(perpPosition(l.path.toSVGPathData(), 30), phase, spacing)).toBeCloseTo(0, 3); // path.toSVGPathData() rounds coordinates, so a little serialization-level slop is expected
  });

  it("passes dasharray and linecap through to the returned DrawingElements", () => {
    const lines = hatch(rectangle(0, 0, 20, 20), { angleDeg: 45, spacingMM: 5, dasharray: [3, 1], linecap: "round" });
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.options.stroke).toMatchObject({ dasharray: [3, 1], linecap: "round" });
    }
  });
});

describe("hatchPattern", () => {
  it("ANSI31 (single continuous family) matches a plain hatch() at the same angle/spacing", () => {
    const boundary = rectangle(0, 0, 30, 30);
    const viaPattern = hatchPattern(boundary, ANSI31);
    const viaHatch = hatch(boundary, { angleDeg: 45, spacingMM: ANSI31.families[0]!.spacingMM });
    expect(viaPattern.length).toBe(viaHatch.length);
  });

  it("ANSI31's spacing is exactly 0.125in converted to mm", () => {
    expect(ANSI31.families[0]!.spacingMM).toBeCloseTo(toMM(0.125, "in"), 9);
  });

  it("a multi-family pattern (ANSI32) returns the concatenation of each family's own hatch() lines", () => {
    const boundary = rectangle(0, 0, 30, 30);
    const combined = hatchPattern(boundary, ANSI32);
    const expectedCount = ANSI32.families.reduce(
      (sum, f) => sum + hatch(boundary, { angleDeg: f.angleDeg, spacingMM: f.spacingMM, phaseMM: f.phaseMM ?? 0 }).length,
      0,
    );
    expect(combined.length).toBe(expectedCount);
  });

  it("a dashed family (ANSI35's second family) carries its dasharray on the returned elements, the solid family doesn't", () => {
    const boundary = rectangle(0, 0, 30, 30);
    const lines = hatchPattern(boundary, ANSI35);
    const dashed = lines.filter((l) => l.options.stroke && typeof l.options.stroke === "object" && l.options.stroke.dasharray);
    const solid = lines.filter((l) => !(l.options.stroke && typeof l.options.stroke === "object" && l.options.stroke.dasharray));
    expect(dashed.length).toBeGreaterThan(0);
    expect(solid.length).toBeGreaterThan(0);
  });

  it("a crosshatch pattern (ANSI37) produces lines at both its family angles", () => {
    const boundary = rectangle(0, 0, 30, 30);
    const combined = hatchPattern(boundary, ANSI37);
    const at45 = hatch(boundary, { angleDeg: 45, spacingMM: ANSI37.families[0]!.spacingMM }).length;
    const at135 = hatch(boundary, { angleDeg: 135, spacingMM: ANSI37.families[1]!.spacingMM }).length;
    expect(combined.length).toBe(at45 + at135);
  });

  it("scale proportionally widens every family's spacing (and shrinks the line count)", () => {
    const boundary = rectangle(0, 0, 30, 30);
    const normal = hatchPattern(boundary, ANSI34);
    const scaled = hatchPattern(boundary, ANSI34, { scale: 3 });
    expect(scaled.length).toBeLessThan(normal.length);
  });

  it("exposes all 8 ANSI patterns by name, each with at least one family", () => {
    for (const name of ["ANSI31", "ANSI32", "ANSI33", "ANSI34", "ANSI35", "ANSI36", "ANSI37", "ANSI38"] as const) {
      const pattern = ANSI_HATCH_PATTERNS[name];
      expect(pattern.name).toBe(name);
      expect(pattern.families.length).toBeGreaterThan(0);
    }
  });

  it("returns an empty array for a degenerate (empty) boundary", () => {
    expect(hatchPattern([], ANSI31)).toEqual([]);
  });
});
