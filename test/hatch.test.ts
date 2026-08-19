import { describe, expect, it } from "vitest";
import { Path } from "../src/geometry/path.js";
import { rectangle, circle } from "../src/geometry/shapes.js";
import { hatch } from "../src/hatch/hatch.js";

describe("Path.flatten", () => {
  it("returns exact vertices for a line-only path", () => {
    const pts = rectangle(0, 0, 10, 5).flatten();
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
      { x: 0, y: 0 },
    ]);
  });

  it("samples an arc into multiple points ending exactly at the arc's endpoint", () => {
    const p = new Path().arc({ center: { x: 0, y: 0 }, radius: 10, startAngle: 0, endAngle: Math.PI / 2, counterclockwise: true });
    const pts = p.flatten(10); // 90deg / 10deg-per-step -> 9 steps
    expect(pts.length).toBe(10); // start point + 9 samples
    const last = pts[pts.length - 1]!;
    expect(last.x).toBeCloseTo(0);
    expect(last.y).toBeCloseTo(10);
  });

  it("returns an empty array for an empty path", () => {
    expect(new Path().flatten()).toEqual([]);
  });
});

describe("hatch", () => {
  it("fills a square with horizontal lines spanning its full width at angle 0", () => {
    const lines = hatch(rectangle(0, 0, 20, 10), { angleDeg: 0, spacingMM: 5 });
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const box = line.path.boundingBox();
      expect(box.minX).toBeCloseTo(0);
      expect(box.maxX).toBeCloseTo(20);
      // a horizontal hatch line has zero height
      expect(box.maxY - box.minY).toBeCloseTo(0);
    }
  });

  it("produces lines whose endpoints lie on the square's boundary", () => {
    const lines = hatch(rectangle(0, 0, 20, 10), { angleDeg: 45, spacingMM: 4 });
    for (const line of lines) {
      const box = line.path.boundingBox();
      expect(box.minX).toBeGreaterThanOrEqual(-0.001);
      expect(box.maxX).toBeLessThanOrEqual(20.001);
      expect(box.minY).toBeGreaterThanOrEqual(-0.001);
      expect(box.maxY).toBeLessThanOrEqual(10.001);
    }
  });

  it("leaves a hole unhatched when its boundary is passed alongside the outer boundary", () => {
    const outer = rectangle(0, 0, 20, 20);
    const hole = circle(10, 10, 5);
    const lines = hatch([outer, hole], { angleDeg: 0, spacingMM: 2 });
    // the scanline through the hole's center (y=10) must produce two segments (left-of-hole, right-of-hole), not one
    const centerLine = lines.filter((l) => Math.abs(l.path.boundingBox().minY - 10) < 0.5);
    expect(centerLine.length).toBeGreaterThanOrEqual(2);
    for (const line of centerLine) {
      const box = line.path.boundingBox();
      // neither segment should span across the hole (width ~10, since hole spans x=5..15)
      expect(box.maxX - box.minX).toBeLessThan(10);
    }
  });

  it("respects a custom spacing (fewer, more widely spaced lines)", () => {
    const tight = hatch(rectangle(0, 0, 20, 20), { angleDeg: 0, spacingMM: 2 });
    const loose = hatch(rectangle(0, 0, 20, 20), { angleDeg: 0, spacingMM: 10 });
    expect(loose.length).toBeLessThan(tight.length);
  });

  it("returns an empty array for a degenerate (empty) path", () => {
    expect(hatch(new Path())).toEqual([]);
  });

  it("throws for a non-positive or non-finite spacingMM", () => {
    expect(() => hatch(rectangle(0, 0, 20, 20), { spacingMM: 0 })).toThrow(/positive finite number/);
    expect(() => hatch(rectangle(0, 0, 20, 20), { spacingMM: -5 })).toThrow(/positive finite number/);
    expect(() => hatch(rectangle(0, 0, 20, 20), { spacingMM: NaN })).toThrow(/positive finite number/);
    expect(() => hatch(rectangle(0, 0, 20, 20), { spacingMM: Infinity })).toThrow(/positive finite number/);
  });

  it("throws rather than looping when the scanline count is unreasonably large", () => {
    expect(() => hatch(rectangle(0, 0, 20, 1_000_000), { angleDeg: 0, spacingMM: 0.0001 })).toThrow(/scanlines/);
  });
});
