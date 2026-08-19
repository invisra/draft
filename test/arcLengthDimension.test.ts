import { describe, expect, it } from "vitest";
import { ArcLengthDimension } from "../src/dimension/arcLengthDimension.js";

describe("ArcLengthDimension", () => {
  it("labels the true arc length (radius × sweep) with the ⌒ symbol", () => {
    // quarter circle, r=10 → arc length = 10 × π/2 ≈ 15.71
    const svg = new ArcLengthDimension({ x: 0, y: 0 }, 10, 0, 90, { offset: 5 }).toSVG();
    expect(svg).toContain("⌒15.71");
  });

  it("can drop the arc-length symbol", () => {
    const svg = new ArcLengthDimension({ x: 0, y: 0 }, 10, 0, 90, { offset: 5, symbol: false }).toSVG();
    expect(svg).toContain(">15.71<");
    expect(svg).not.toContain("⌒");
  });

  it("respects the sweep direction", () => {
    const cw = new ArcLengthDimension({ x: 0, y: 0 }, 10, 0, 90, { offset: 5, counterclockwise: false }).toSVG();
    // the long way round: 10 × 3π/2 ≈ 47.12
    expect(cw).toContain("⌒47.12");
  });

  it("honors the display unit", () => {
    // r=25.4mm, quarter arc = 25.4 × π/2 ≈ 39.9mm = 1.571 in
    const svg = new ArcLengthDimension({ x: 0, y: 0 }, 25.4, 0, 90, { offset: 5, unit: "in" }).toSVG();
    expect(svg).toContain("⌒1.571");
  });

  it("draws two radial extension lines, two dimension-arc segments, and two arrowheads", () => {
    const svg = new ArcLengthDimension({ x: 0, y: 0 }, 10, 0, 90, { offset: 5 }).toSVG();
    // 2 extension lines + 2 arc segments + 2 arrowheads = 6 <path> elements (label text is <text>)
    expect((svg.match(/<path/g) ?? []).length).toBe(6);
  });

  it("accepts a text override", () => {
    const svg = new ArcLengthDimension({ x: 0, y: 0 }, 10, 0, 90, { offset: 5, text: "ARC" }).toSVG();
    expect(svg).toContain(">ARC<");
  });
});
