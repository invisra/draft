import { describe, expect, it } from "vitest";
import { polygonUnion, polygonIntersection, polygonDifference, polygonArea } from "../src/geometry/boolean.js";
import type { Point } from "../src/geometry/point.js";

const square = (x: number, y: number, s: number): Point[] => [
  { x, y },
  { x: x + s, y },
  { x: x + s, y: y + s },
  { x, y: y + s },
];

const totalArea = (rings: Point[][]) => rings.reduce((sum, r) => sum + Math.abs(polygonArea(r)), 0);

describe("polygon boolean operations", () => {
  // A = [0,0]-[2,2], B = [1,1]-[3,3]; overlap = [1,1]-[2,2] (area 1)
  const A = square(0, 0, 2);
  const B = square(1, 1, 2);

  it("intersection returns the overlap (area 1)", () => {
    const r = polygonIntersection(A, B);
    expect(r).toHaveLength(1);
    expect(totalArea(r)).toBeCloseTo(1, 6);
  });

  it("union merges into one region (area 7 = 4 + 4 − 1)", () => {
    const r = polygonUnion(A, B);
    expect(r).toHaveLength(1);
    expect(totalArea(r)).toBeCloseTo(7, 6);
  });

  it("difference A − B keeps the non-overlapping part (area 3)", () => {
    const r = polygonDifference(A, B);
    expect(totalArea(r)).toBeCloseTo(3, 6);
  });

  it("winding direction of inputs doesn't matter", () => {
    const Bcw = [...B].reverse();
    expect(totalArea(polygonIntersection(A, Bcw))).toBeCloseTo(1, 6);
  });

  describe("non-crossing cases", () => {
    const far = square(10, 10, 1);

    it("disjoint: intersection empty, union keeps both rings", () => {
      expect(polygonIntersection(A, far)).toHaveLength(0);
      expect(polygonUnion(A, far)).toHaveLength(2);
    });

    it("containment: intersection is the inner shape", () => {
      const outer = square(0, 0, 10);
      const inner = square(3, 3, 3);
      expect(totalArea(polygonIntersection(outer, inner))).toBeCloseTo(9, 6);
    });

    it("difference with an interior hole returns outer + reversed hole (net area 91)", () => {
      const outer = square(0, 0, 10);
      const inner = square(3, 3, 3);
      const rings = polygonDifference(outer, inner);
      expect(rings).toHaveLength(2);
      // outer ring minus the hole ring = 100 − 9
      const net = Math.abs(polygonArea(rings[0]!)) - Math.abs(polygonArea(rings[1]!));
      expect(net).toBeCloseTo(91, 6);
    });
  });

  it("polygonArea is signed (positive for CCW)", () => {
    expect(polygonArea(square(0, 0, 2))).toBeCloseTo(4, 6);
    expect(polygonArea([...square(0, 0, 2)].reverse())).toBeCloseTo(-4, 6);
  });
});
