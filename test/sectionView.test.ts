import { describe, expect, it } from "vitest";
import { sectionView } from "../src/annotation/sectionView.js";
import { rectangle, circle } from "../src/geometry/shapes.js";
import { polygonArea } from "../src/geometry/boolean.js";

const totalArea = (rings: { x: number; y: number }[][]) => rings.reduce((s, r) => s + Math.abs(polygonArea(r)), 0);

describe("sectionView", () => {
  it("hatches a region and outlines it, keeping holes as separate rings", () => {
    const s = sectionView([rectangle(0, 0, 40, 20), circle(20, 10, 5)]);
    expect(s.region).toHaveLength(2); // outer + hole
    expect(s.hatch.length).toBeGreaterThan(0);
    expect(s.outline).toHaveLength(2);
    for (const e of s.hatch) expect(e.toSVG()).toContain("<path");
  });

  it("clips to the kept side of a cutting plane (each half is 400 of the 800mm²)", () => {
    const cutLine = { p1: { x: 20, y: -10 }, p2: { x: 20, y: 30 } };
    const left = sectionView(rectangle(0, 0, 40, 20), { cut: { ...cutLine, keep: "left" } });
    const right = sectionView(rectangle(0, 0, 40, 20), { cut: { ...cutLine, keep: "right" } });
    expect(totalArea(left.region)).toBeCloseTo(400, 3);
    expect(totalArea(right.region)).toBeCloseTo(400, 3);
  });

  it("returns an empty section when the whole profile is on the discarded side", () => {
    // profile spans x∈[0,40]; keep the right side of a line at x=100 → nothing
    const s = sectionView(rectangle(0, 0, 40, 20), { cut: { p1: { x: 100, y: -10 }, p2: { x: 100, y: 30 }, keep: "right" } });
    expect(s.region).toHaveLength(0);
    expect(s.hatch).toHaveLength(0);
    expect(s.outline).toHaveLength(0);
  });

  it("keeps the whole profile when the cut line misses it on the kept side", () => {
    const s = sectionView(rectangle(0, 0, 40, 20), { cut: { p1: { x: 100, y: -10 }, p2: { x: 100, y: 30 }, keep: "left" } });
    expect(totalArea(s.region)).toBeCloseTo(800, 3);
  });

  it("preserves a hole through the clip (even-odd fill leaves it open)", () => {
    // 40×20 rect with a 5r hole at x∈[15,25]; cut at x=21.3 (through the hole interior, in
    // general position — not through the center) keeps the clipped outer plus the clipped hole
    const s = sectionView([rectangle(0, 0, 40, 20), circle(20, 10, 5)], { cut: { p1: { x: 21.3, y: -10 }, p2: { x: 21.3, y: 30 }, keep: "left" } });
    expect(s.region).toHaveLength(2); // clipped outer + clipped hole
  });

  it("finer spacing yields more section lines; outline can be disabled", () => {
    const coarse = sectionView(rectangle(0, 0, 40, 20), { spacingMM: 5 });
    const fine = sectionView(rectangle(0, 0, 40, 20), { spacingMM: 1 });
    expect(fine.hatch.length).toBeGreaterThan(coarse.hatch.length);
    expect(sectionView(rectangle(0, 0, 40, 20), { outline: false }).outline).toHaveLength(0);
  });

  it("honors a color override on both hatch and outline", () => {
    const s = sectionView(rectangle(0, 0, 40, 20), { color: "blue" });
    expect(s.hatch[0]!.toSVG()).toContain('stroke="blue"');
    expect(s.outline[0]!.toSVG()).toContain('stroke="blue"');
  });
});
