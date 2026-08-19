import { describe, expect, it } from "vitest";
import { Path } from "../src/geometry/path.js";
import { circle, polyline, rectangle, roundedRectangle } from "../src/geometry/shapes.js";
import { arcSpan, normalizeAngle } from "../src/geometry/segments.js";
import { bboxHeight, bboxWidth } from "../src/geometry/bbox.js";

describe("normalizeAngle", () => {
  it("wraps negative and large angles into [0, 2*PI)", () => {
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo((3 * Math.PI) / 2);
    expect(normalizeAngle(2.5 * Math.PI)).toBeCloseTo(Math.PI / 2);
    expect(normalizeAngle(0)).toBeCloseTo(0);
  });
});

describe("arcSpan", () => {
  it("computes a quarter-turn span for a CCW quarter arc", () => {
    const path = new Path();
    path.arc({ center: { x: 0, y: 0 }, radius: 1, startAngle: 0, endAngle: Math.PI / 2, counterclockwise: true });
    const seg = path.getSegments()[0];
    if (seg?.type !== "arc") throw new Error("expected arc segment");
    expect(arcSpan(seg)).toBeCloseTo(Math.PI / 2);
  });

  it("computes a three-quarter-turn span for a CW arc going the long way", () => {
    const path = new Path();
    path.arc({ center: { x: 0, y: 0 }, radius: 1, startAngle: 0, endAngle: Math.PI / 2, counterclockwise: false });
    const seg = path.getSegments()[0];
    if (seg?.type !== "arc") throw new Error("expected arc segment");
    expect(arcSpan(seg)).toBeCloseTo((3 * Math.PI) / 2);
  });
});

describe("Path.boundingBox", () => {
  it("matches width/height for an axis-aligned rectangle", () => {
    const box = rectangle(0, 0, 40, 20).boundingBox();
    expect(bboxWidth(box)).toBeCloseTo(40);
    expect(bboxHeight(box)).toBeCloseTo(20);
  });

  it("includes the full radius for a circle regardless of start point", () => {
    const box = circle(10, 10, 5).boundingBox();
    expect(box.minX).toBeCloseTo(5);
    expect(box.maxX).toBeCloseTo(15);
    expect(box.minY).toBeCloseTo(5);
    expect(box.maxY).toBeCloseTo(15);
  });

  it("clamps corner radius to half the shorter side for roundedRectangle", () => {
    const box = roundedRectangle(0, 0, 10, 4, 100).boundingBox();
    expect(bboxWidth(box)).toBeCloseTo(10);
    expect(bboxHeight(box)).toBeCloseTo(4);
  });
});

describe("Path.toSVGPathData", () => {
  it("emits M/L/Z for a closed rectangle", () => {
    const d = rectangle(0, 0, 10, 5).toSVGPathData();
    expect(d).toBe("M 0 0 L 10 0 L 10 5 L 0 5 L 0 0 Z");
  });

  it("emits a large-arc-flag of 0 for a quarter arc and 1 for a three-quarter arc", () => {
    const quarter = new Path();
    quarter.arc({ center: { x: 0, y: 0 }, radius: 2, startAngle: 0, endAngle: Math.PI / 2, counterclockwise: true });
    expect(quarter.toSVGPathData()).toContain(" 0 1 ");

    const threeQuarter = new Path();
    threeQuarter.arc({ center: { x: 0, y: 0 }, radius: 2, startAngle: 0, endAngle: Math.PI / 2, counterclockwise: false });
    expect(threeQuarter.toSVGPathData()).toContain(" 1 0 ");
  });

  it("open polyline has no trailing Z", () => {
    const d = polyline([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }]).toSVGPathData();
    expect(d.endsWith("Z")).toBe(false);
  });
});
