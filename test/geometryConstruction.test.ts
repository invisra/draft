import { describe, expect, it } from "vitest";
import { lineIntersection, segmentIntersection, lineCircleIntersection, segmentCircleIntersection, breakSegmentAtCrossings } from "../src/geometry/intersect.js";
import { filletCorner, roundedPolyline } from "../src/geometry/fillet.js";
import { offsetPolyline } from "../src/geometry/offset.js";
import { boltCircle, linearPattern, rectangularPattern } from "../src/geometry/pattern.js";
import { ellipse } from "../src/geometry/shapes.js";
import type { Point } from "../src/geometry/point.js";

const near = (p: Point, x: number, y: number, digits = 6) => {
  expect(p.x).toBeCloseTo(x, digits);
  expect(p.y).toBeCloseTo(y, digits);
};

describe("intersections", () => {
  it("lineIntersection finds where two infinite lines cross", () => {
    near(lineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: 3 })!, 2, 0);
  });

  it("lineIntersection returns null for parallel lines", () => {
    expect(lineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeNull();
  });

  it("segmentIntersection only crosses within both spans", () => {
    near(segmentIntersection({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 })!, 1, 1);
    // lines would cross at (2,2) but that's beyond the first segment's end
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { x: 2, y: 5 })).toBeNull();
  });

  it("lineCircleIntersection returns 0/1/2 points ordered along the line", () => {
    const secant = lineCircleIntersection({ x: -10, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, 5);
    expect(secant).toHaveLength(2);
    near(secant[0]!, -5, 0);
    near(secant[1]!, 5, 0);

    const tangent = lineCircleIntersection({ x: -10, y: 5 }, { x: 10, y: 5 }, { x: 0, y: 0 }, 5);
    expect(tangent).toHaveLength(1);
    near(tangent[0]!, 0, 5);

    expect(lineCircleIntersection({ x: -10, y: 9 }, { x: 10, y: 9 }, { x: 0, y: 0 }, 5)).toHaveLength(0);
  });

  it("segmentCircleIntersection keeps only in-span hits", () => {
    const hits = segmentCircleIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, 5);
    expect(hits).toHaveLength(1); // the -5 root is behind the segment start
    near(hits[0]!, 5, 0);
  });
});

describe("breakSegmentAtCrossings", () => {
  const a = { x: 0, y: 0 };
  const b = { x: 10, y: 0 };

  it("returns the whole segment unchanged when nothing crosses", () => {
    const segs = breakSegmentAtCrossings(a, b, [{ kind: "segment", p1: { x: 20, y: -1 }, p2: { x: 20, y: 1 } }], 2);
    expect(segs).toHaveLength(1);
    near(segs[0]![0], 0, 0);
    near(segs[0]![1], 10, 0);
  });

  it("cuts a gap of gapMM centered on a segment crossing", () => {
    const segs = breakSegmentAtCrossings(a, b, [{ kind: "segment", p1: { x: 5, y: -1 }, p2: { x: 5, y: 1 } }], 2);
    expect(segs).toHaveLength(2);
    near(segs[0]![1], 4, 0); // gap starts at 5 - 1
    near(segs[1]![0], 6, 0); // and ends at 5 + 1
  });

  it("gaps around a circle crossed twice", () => {
    const segs = breakSegmentAtCrossings(a, b, [{ kind: "circle", center: { x: 5, y: 0 }, radius: 1 }], 1);
    // hits at x=4 and x=6, each a 1mm gap → [0,3.5] [4.5,5.5] [6.5,10]
    expect(segs).toHaveLength(3);
    near(segs[0]![1], 3.5, 0);
    near(segs[1]![0], 4.5, 0);
    near(segs[1]![1], 5.5, 0);
    near(segs[2]![0], 6.5, 0);
  });

  it("merges overlapping gaps from nearby crossings", () => {
    const segs = breakSegmentAtCrossings(
      a,
      b,
      [
        { kind: "segment", p1: { x: 5, y: -1 }, p2: { x: 5, y: 1 } },
        { kind: "segment", p1: { x: 5.5, y: -1 }, p2: { x: 5.5, y: 1 } },
      ],
      2,
    );
    // gaps [4,6] and [4.5,6.5] merge to [4,6.5]
    expect(segs).toHaveLength(2);
    near(segs[0]![1], 4, 0);
    near(segs[1]![0], 6.5, 0);
  });

  it("returns [] for a zero-length segment", () => {
    expect(breakSegmentAtCrossings(a, a, [], 2)).toEqual([]);
  });
});

describe("filletCorner", () => {
  it("rounds a right-angle corner tangent to both legs", () => {
    const f = filletCorner({ x: 0, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 2);
    expect(f.radius).toBe(2);
    near(f.center, 2, 2);
    near(f.tangentStart, 0, 2);
    near(f.tangentEnd, 2, 0);
    // both tangent points lie exactly `radius` from the center
    expect(Math.hypot(f.tangentStart.x - f.center.x, f.tangentStart.y - f.center.y)).toBeCloseTo(2, 6);
  });

  it("throws on a straight (collinear) corner", () => {
    expect(() => filletCorner({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, 2)).toThrow();
  });
});

describe("roundedPolyline", () => {
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("rounds every corner of a closed polygon (one arc per corner)", () => {
    const path = roundedPolyline(square, 2, true);
    const arcs = path.getSegments().filter((s) => s.type === "arc");
    expect(arcs).toHaveLength(4);
    expect(path.isClosed()).toBe(true);
    // stays within the original square (tangent points sit on the edges)
    const bbox = path.boundingBox();
    expect(bbox.minX).toBeCloseTo(0, 6);
    expect(bbox.maxX).toBeCloseTo(10, 6);
  });

  it("rounds only interior corners of an open polyline", () => {
    const arcs = roundedPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 2, false)
      .getSegments()
      .filter((s) => s.type === "arc");
    expect(arcs).toHaveLength(1);
  });

  it("clamps the radius so a fillet never overruns half an edge", () => {
    const arcs = roundedPolyline(square, 100, true).getSegments().filter((s) => s.type === "arc");
    // radius clamped to 5 (half the 10mm edge) on every corner
    for (const a of arcs) if (a.type === "arc") expect(a.radius).toBeCloseTo(5, 6);
  });

  it("leaves a duplicated consecutive point sharp instead of throwing", () => {
    // the repeated (10,0) gives a zero-length leg — previously normalize() threw
    const withDup: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    let path!: ReturnType<typeof roundedPolyline>;
    expect(() => (path = roundedPolyline(withDup, 2, true))).not.toThrow();
    // the three genuine corners still round; the degenerate one is skipped
    expect(path.getSegments().filter((s) => s.type === "arc")).toHaveLength(3);
  });
});

describe("offsetPolyline", () => {
  it("offsets an open polyline to the left by the given distance", () => {
    const out = offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], 1);
    near(out[0]!, 0, 1);
    near(out[1]!, 10, 1);
    const right = offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], -1);
    near(right[0]!, 0, -1);
  });

  it("miters interior corners of an L", () => {
    const out = offsetPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 1);
    near(out[0]!, 0, 1);
    near(out[1]!, 9, 1);
    near(out[2]!, 9, 10);
  });

  it("offsets a closed CCW square inward", () => {
    const out = offsetPolyline(
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      1,
      true,
    );
    expect(out).toHaveLength(4);
    near(out[0]!, 1, 1);
    near(out[1]!, 9, 1);
    near(out[2]!, 9, 9);
    near(out[3]!, 1, 9);
  });
});

describe("ellipse", () => {
  it("builds an ellipse with the requested bounding box (two true elliptical arcs by default)", () => {
    const e = ellipse(0, 0, 10, 5);
    expect(e.isClosed()).toBe(true);
    // two elliptical half-arcs (plus close()'s tiny degenerate line, like circle())
    expect(e.getSegments().filter((s) => s.type === "ellipticalArc")).toHaveLength(2);
    const bbox = e.boundingBox();
    expect(bbox.minX).toBeCloseTo(-10, 6);
    expect(bbox.maxX).toBeCloseTo(10, 6);
    expect(bbox.minY).toBeCloseTo(-5, 6);
    expect(bbox.maxY).toBeCloseTo(5, 6);
  });

  it("rotates the axes", () => {
    const bbox = ellipse(0, 0, 10, 5, { rotationDeg: 90 }).boundingBox();
    expect(bbox.maxX).toBeCloseTo(5, 6);
    expect(bbox.maxY).toBeCloseTo(10, 6);
  });

  it("rejects non-positive semi-axes", () => {
    expect(() => ellipse(0, 0, 0, 5)).toThrow();
  });
});

describe("patterns", () => {
  it("boltCircle spaces holes evenly around a full circle", () => {
    const holes = boltCircle({ x: 0, y: 0 }, 4, 10);
    expect(holes).toHaveLength(4);
    near(holes[0]!, 10, 0);
    near(holes[1]!, 0, 10);
    near(holes[2]!, -10, 0);
    near(holes[3]!, 0, -10);
  });

  it("boltCircle honors start angle and clockwise direction", () => {
    near(boltCircle({ x: 0, y: 0 }, 4, 10, { startAngleDeg: 45 })[0]!, 7.0710678, 7.0710678);
    near(boltCircle({ x: 0, y: 0 }, 4, 10, { clockwise: true })[1]!, 0, -10);
  });

  it("boltCircle lays holes along an arc when endAngleDeg is set", () => {
    const arc = boltCircle({ x: 0, y: 0 }, 3, 10, { startAngleDeg: 0, endAngleDeg: 90 });
    expect(arc).toHaveLength(3);
    near(arc[0]!, 10, 0);
    near(arc[1]!, 7.0710678, 7.0710678);
    near(arc[2]!, 0, 10);
  });

  it("linearPattern steps by a fixed vector", () => {
    const pts = linearPattern({ x: 0, y: 0 }, { x: 5, y: 0 }, 3);
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
  });

  it("rectangularPattern builds a row-major grid", () => {
    const pts = rectangularPattern({ x: 0, y: 0 }, { columns: 2, rows: 2, dx: 5, dy: 10 });
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 10 }, { x: 5, y: 10 }]);
  });
});
