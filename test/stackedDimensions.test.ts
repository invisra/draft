import { describe, expect, it } from "vitest";
import { baselineAngularDimension, baselineDimension, chainAngularDimension, chainDimension } from "../src/dimension/stackedDimensions.js";
import { formatNumber } from "../src/util.js";

function rayAt(angleDeg: number, length = 10): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: length * Math.cos(rad), y: length * Math.sin(rad) };
}

function arcStart(angleDeg: number, radius: number): string {
  const rad = (angleDeg * Math.PI) / 180;
  return `M ${formatNumber(radius * Math.cos(rad))} ${formatNumber(radius * Math.sin(rad))} A`;
}

describe("chainDimension", () => {
  it("creates one dimension per consecutive point pair, all reporting their own segment distance", () => {
    const dims = chainDimension([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }], { offset: -5, orientation: "horizontal" });
    expect(dims).toHaveLength(2);
    expect(dims[0]!.toSVG()).toContain(">10.00<");
    expect(dims[1]!.toSVG()).toContain(">20.00<");
  });

  it("shares the same offset across all segments", () => {
    const dims = chainDimension([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }], { offset: -5, orientation: "horizontal" });
    // both segments' dimension lines sit at y = -5 (offset from y=0 points, horizontal orientation, offset negative = down)
    for (const d of dims) {
      expect(d.toSVG()).toContain(" -5 L");
    }
  });

  it("throws with fewer than 2 points", () => {
    expect(() => chainDimension([{ x: 0, y: 0 }], { offset: -5 })).toThrow();
  });
});

describe("baselineDimension", () => {
  it("dimensions every point from the first (datum) point", () => {
    const dims = baselineDimension([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }], { offset: -5, orientation: "horizontal" });
    expect(dims).toHaveLength(2);
    expect(dims[0]!.toSVG()).toContain(">10.00<");
    expect(dims[1]!.toSVG()).toContain(">30.00<");
  });

  it("stacks successive dimensions further out by stackSpacing, in the direction of the initial offset's sign", () => {
    const dims = baselineDimension([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }], {
      offset: -5,
      orientation: "horizontal",
      stackSpacing: 8,
    });
    expect(dims[0]!.toSVG()).toContain(" -5 L");
    expect(dims[1]!.toSVG()).toContain(" -13 L");
  });

  it("defaults stackSpacing to 8mm", () => {
    const dims = baselineDimension([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }], { offset: 5, orientation: "horizontal" });
    expect(dims[1]!.toSVG()).toContain(" 13 L");
  });

  it("throws with fewer than 2 points", () => {
    expect(() => baselineDimension([{ x: 0, y: 0 }], { offset: -5 })).toThrow();
  });
});

describe("chainAngularDimension", () => {
  const vertex = { x: 0, y: 0 };
  const rays = [rayAt(0), rayAt(30), rayAt(90)];

  it("creates one dimension per consecutive ray pair, each reporting its own sweep", () => {
    const dims = chainAngularDimension(vertex, rays, { radius: 10 });
    expect(dims).toHaveLength(2);
    expect(dims[0]!.toSVG()).toContain(">30.00°<");
    expect(dims[1]!.toSVG()).toContain(">60.00°<");
  });

  it("shares the same radius across all segments", () => {
    const dims = chainAngularDimension(vertex, rays, { radius: 10 });
    // first segment's first ray is at 0deg, so its arc starts at (10, 0); second segment's first ray is at 30deg
    expect(dims[0]!.toSVG()).toContain(arcStart(0, 10));
    expect(dims[1]!.toSVG()).toContain(arcStart(30, 10));
  });

  it("throws with fewer than 2 rays", () => {
    expect(() => chainAngularDimension(vertex, [rayAt(0)], { radius: 10 })).toThrow();
  });
});

describe("baselineAngularDimension", () => {
  const vertex = { x: 0, y: 0 };
  const rays = [rayAt(0), rayAt(30), rayAt(90)];

  it("dimensions every ray from the first (datum) ray", () => {
    const dims = baselineAngularDimension(vertex, rays, { radius: 10 });
    expect(dims).toHaveLength(2);
    expect(dims[0]!.toSVG()).toContain(">30.00°<");
    expect(dims[1]!.toSVG()).toContain(">90.00°<");
  });

  it("stacks successive dimensions at increasing radii by stackSpacing", () => {
    const dims = baselineAngularDimension(vertex, rays, { radius: 10, stackSpacing: 5 });
    // datum ray is at 0deg, so each dimension's arc starts at (radius, 0)
    expect(dims[0]!.toSVG()).toContain("M 10 0 A");
    expect(dims[1]!.toSVG()).toContain("M 15 0 A");
  });

  it("defaults stackSpacing to 10mm", () => {
    const dims = baselineAngularDimension(vertex, rays, { radius: 10 });
    expect(dims[1]!.toSVG()).toContain("M 20 0 A");
  });

  it("throws with fewer than 2 rays", () => {
    expect(() => baselineAngularDimension(vertex, [rayAt(0)], { radius: 10 })).toThrow();
  });
});
