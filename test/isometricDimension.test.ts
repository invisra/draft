import { describe, expect, it } from "vitest";
import { IsometricLinearDimension } from "../src/annotation/isometricDimension.js";
import { MM_PER_INCH } from "../src/units.js";

const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;

describe("IsometricLinearDimension", () => {
  it("draws two extension lines, a dimension line, and two arrowheads", () => {
    const svg = new IsometricLinearDimension({ x: 0, y: 0 }, { x: 40, y: 0 }, { plane: "top", offset: -10 }).toSVG();
    // 2 extension + 1 dimension line + 2 arrowhead triangles = 5 paths
    expect(countPaths(svg)).toBe(5);
    expect((svg.match(/fill="black"/g) ?? []).length).toBe(3); // 2 arrows + the text fill
  });

  it("labels the true in-plane length", () => {
    const svg = new IsometricLinearDimension({ x: 0, y: 0 }, { x: 40, y: 0 }, { plane: "top", offset: -10 }).toSVG();
    expect(svg).toContain(">40.00</text>");
  });

  it("letters the value onto the plane (matrix-wrapped, non-mirrored)", () => {
    const svg = new IsometricLinearDimension({ x: 0, y: 0 }, { x: 40, y: 0 }, { plane: "top", offset: -10 }).toSVG();
    const m = svg.match(/matrix\(([^)]+)\)/);
    expect(m).not.toBeNull();
    const [a, b, c, d] = m![1]!.trim().split(/\s+/).map(Number);
    expect(a! * d! - b! * c!).toBeLessThan(0); // non-mirrored once composed with the sheet Y-flip
  });

  it("honors the display unit and appends a tolerance", () => {
    const inch = new IsometricLinearDimension({ x: 0, y: 0 }, { x: MM_PER_INCH, y: 0 }, { plane: "right", offset: -10, unit: "in" }).toSVG();
    expect(inch).toContain(">1.000</text>");
    const tol = new IsometricLinearDimension({ x: 0, y: 0 }, { x: 40, y: 0 }, { plane: "top", offset: -10, tolerance: 0.1 }).toSVG();
    expect(tol).toContain(">40.00 ±0.10</text>");
  });

  it("measures the diagonal in-plane distance", () => {
    // 3-4-5 in face coords
    const svg = new IsometricLinearDimension({ x: 0, y: 0 }, { x: 3, y: 4 }, { plane: "left", offset: 5 }).toSVG();
    expect(svg).toContain(">5.00</text>");
  });

  it("respects a text override", () => {
    const svg = new IsometricLinearDimension({ x: 0, y: 0 }, { x: 40, y: 0 }, { plane: "top", offset: -10, text: "TYP" }).toSVG();
    expect(svg).toContain(">TYP</text>");
  });
});
