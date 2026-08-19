import { describe, expect, it } from "vitest";
import { fitSpline } from "../src/geometry/spline.js";
import { bezierPointAt } from "../src/geometry/segments.js";
import type { Point } from "../src/geometry/point.js";

const pts: Point[] = [
  { x: 0, y: 0 },
  { x: 10, y: 20 },
  { x: 30, y: 10 },
  { x: 40, y: 30 },
];

describe("fitSpline", () => {
  it("emits one cubic Bézier per span (n-1 for an open spline)", () => {
    const segs = fitSpline(pts).getSegments();
    expect(segs).toHaveLength(3);
    expect(segs.every((s) => s.type === "bezier")).toBe(true);
  });

  it("interpolates — the curve passes exactly through every input point", () => {
    const segs = fitSpline(pts).getSegments();
    // each segment starts at points[i] and ends at points[i+1]
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!;
      if (seg.type !== "bezier") throw new Error("expected bezier");
      expect(seg.start).toEqual(pts[i]);
      expect(seg.end).toEqual(pts[i + 1]);
    }
  });

  it("closes into a smooth loop with one span per point", () => {
    const path = fitSpline(pts, { closed: true });
    expect(path.isClosed()).toBe(true);
    expect(path.getSegments()).toHaveLength(4); // n beziers (last returns to the first point)
  });

  it("tension 1 collapses each span to a straight chord", () => {
    const segs = fitSpline(pts, { tension: 1 }).getSegments();
    const seg = segs[0]!;
    if (seg.type !== "bezier") throw new Error("expected bezier");
    // with zero tangents the cubic is a straight line: its midpoint is the chord midpoint
    const mid = bezierPointAt(seg, 0.5);
    expect(mid.x).toBeCloseTo((pts[0]!.x + pts[1]!.x) / 2, 6);
    expect(mid.y).toBeCloseTo((pts[0]!.y + pts[1]!.y) / 2, 6);
  });

  it("a loose spline has real curvature (control handles lifted off the endpoints)", () => {
    const seg = fitSpline(pts).getSegments()[1]!;
    if (seg.type !== "bezier") throw new Error("expected bezier");
    // unlike the tension-1 (straight) case, a loose span's control points don't sit on its endpoints
    expect(Math.hypot(seg.control1.x - seg.start.x, seg.control1.y - seg.start.y)).toBeGreaterThan(0.5);
    expect(Math.hypot(seg.control2.x - seg.end.x, seg.control2.y - seg.end.y)).toBeGreaterThan(0.5);
  });

  it("throws with fewer than two points", () => {
    expect(() => fitSpline([{ x: 0, y: 0 }])).toThrow();
  });

  it("serializes to SVG cubic-bezier commands", () => {
    expect(fitSpline(pts).toSVGPathData()).toContain("C ");
  });
});
