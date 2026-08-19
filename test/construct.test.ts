import { describe, expect, it } from "vitest";
import { circleThrough3Points, tangentPointsFromPoint, perpendicularBisector, perpendicularFoot } from "../src/geometry/construct.js";
import { circleCircleIntersection } from "../src/geometry/intersect.js";
import { distance } from "../src/geometry/point.js";

describe("circleThrough3Points", () => {
  it("recovers the circle three known points lie on", () => {
    const c = circleThrough3Points({ x: 10, y: 5 }, { x: 5, y: 10 }, { x: 0, y: 5 })!;
    expect(c.center.x).toBeCloseTo(5, 9);
    expect(c.center.y).toBeCloseTo(5, 9);
    expect(c.radius).toBeCloseTo(5, 9);
  });

  it("the center is equidistant from all three points", () => {
    const a = { x: 1, y: 2 };
    const b = { x: 7, y: 3 };
    const cc = { x: 4, y: 9 };
    const { center, radius } = circleThrough3Points(a, b, cc)!;
    expect(distance(center, a)).toBeCloseTo(radius, 9);
    expect(distance(center, b)).toBeCloseTo(radius, 9);
    expect(distance(center, cc)).toBeCloseTo(radius, 9);
  });

  it("returns null for collinear or coincident points", () => {
    expect(circleThrough3Points({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
    expect(circleThrough3Points({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 3, y: 1 })).toBeNull();
  });
});

describe("circleCircleIntersection", () => {
  it("two points for overlapping circles, ordered left-of-axis first", () => {
    const pts = circleCircleIntersection({ x: 0, y: 0 }, 2, { x: 2, y: 0 }, 2);
    expect(pts).toHaveLength(2);
    expect(pts[0]!.x).toBeCloseTo(1, 9);
    expect(pts[0]!.y).toBeCloseTo(Math.sqrt(3), 9); // left of the +x axis first
    expect(pts[1]!.y).toBeCloseTo(-Math.sqrt(3), 9);
  });

  it("one point for externally tangent circles", () => {
    const pts = circleCircleIntersection({ x: 0, y: 0 }, 1, { x: 2, y: 0 }, 1);
    expect(pts).toHaveLength(1);
    expect(pts[0]!.x).toBeCloseTo(1, 9);
    expect(pts[0]!.y).toBeCloseTo(0, 9);
  });

  it("no points when separate, concentric, or one contained in the other", () => {
    expect(circleCircleIntersection({ x: 0, y: 0 }, 1, { x: 5, y: 0 }, 1)).toEqual([]);
    expect(circleCircleIntersection({ x: 0, y: 0 }, 5, { x: 0.5, y: 0 }, 1)).toEqual([]);
    expect(circleCircleIntersection({ x: 0, y: 0 }, 3, { x: 0, y: 0 }, 3)).toEqual([]); // coincident
  });

  it("throws on a non-positive radius", () => {
    expect(() => circleCircleIntersection({ x: 0, y: 0 }, 0, { x: 2, y: 0 }, 1)).toThrow(/positive/);
  });
});

describe("tangentPointsFromPoint", () => {
  it("touch points make a right angle with the radius, and the tangent length is √(d²−r²)", () => {
    const pts = tangentPointsFromPoint({ x: 0, y: 0 }, 3, { x: 5, y: 0 });
    expect(pts).toHaveLength(2);
    for (const p of pts) {
      expect(distance({ x: 5, y: 0 }, p)).toBeCloseTo(4, 9); // √(25−9)
      // radius vector (center→p) ⟂ tangent vector (p→from)
      const dot = p.x * (5 - p.x) + p.y * (0 - p.y);
      expect(dot).toBeCloseTo(0, 9);
      expect(distance({ x: 0, y: 0 }, p)).toBeCloseTo(3, 9); // on the circle
    }
    // First point is left of the from→center axis; that axis points toward −x here, so its left is −y.
    expect(pts[0]!.y).toBeLessThan(pts[1]!.y);
  });

  it("a single touch point when `from` is on the circle", () => {
    const pts = tangentPointsFromPoint({ x: 0, y: 0 }, 3, { x: 3, y: 0 });
    expect(pts).toHaveLength(1);
    expect(pts[0]!.x).toBeCloseTo(3, 9);
    expect(pts[0]!.y).toBeCloseTo(0, 9);
  });

  it("no tangent from inside the circle", () => {
    expect(tangentPointsFromPoint({ x: 0, y: 0 }, 3, { x: 1, y: 0 })).toEqual([]);
  });

  it("throws on a non-positive radius", () => {
    expect(() => tangentPointsFromPoint({ x: 0, y: 0 }, 0, { x: 5, y: 0 })).toThrow(/positive/);
  });
});

describe("perpendicularBisector / perpendicularFoot", () => {
  it("bisector passes through the midpoint, perpendicular to the segment", () => {
    const line = perpendicularBisector({ x: 0, y: 0 }, { x: 4, y: 0 })!;
    expect(line[0]).toEqual({ x: 2, y: 0 }); // midpoint
    const dir = { x: line[1].x - line[0].x, y: line[1].y - line[0].y };
    expect(dir.x).toBeCloseTo(0, 9); // vertical (⟂ to the horizontal segment)
    expect(Math.abs(dir.y)).toBeCloseTo(4, 9); // same length as the segment
  });

  it("bisector is null for coincident endpoints", () => {
    expect(perpendicularBisector({ x: 1, y: 1 }, { x: 1, y: 1 })).toBeNull();
  });

  it("foot is the orthogonal projection onto the infinite line", () => {
    expect(perpendicularFoot({ x: 2, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 2, y: 0 });
    // projection can land beyond the segment endpoints (infinite line)
    const foot = perpendicularFoot({ x: -5, y: 4 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(foot.x).toBeCloseTo(-5, 9);
    expect(foot.y).toBeCloseTo(0, 9);
  });

  it("foot returns `a` for a degenerate line", () => {
    expect(perpendicularFoot({ x: 2, y: 3 }, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });
});
