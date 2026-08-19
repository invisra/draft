import { describe, expect, it } from "vitest";
import { pathToPolyline } from "../src/dxf/polylineConversion.js";
import { Path } from "../src/geometry/path.js";
import { rectangle, circle } from "../src/geometry/shapes.js";

describe("pathToPolyline", () => {
  it("gives bulge 0 for straight segments", () => {
    const { vertices, closed } = pathToPolyline(rectangle(0, 0, 10, 5));
    expect(closed).toBe(true);
    for (const v of vertices) expect(v.bulge).toBe(0);
    // closed rectangle: 4 vertices, not 5 (duplicate closing vertex dropped)
    expect(vertices).toHaveLength(4);
  });

  it("computes the well-known bulge value for a 90-degree CCW arc: tan(22.5deg) ~= 0.41421", () => {
    const path = new Path().arc({ center: { x: 0, y: 0 }, radius: 5, startAngle: 0, endAngle: Math.PI / 2, counterclockwise: true });
    const { vertices } = pathToPolyline(path);
    expect(vertices[0]!.bulge).toBeCloseTo(0.41421356, 6);
  });

  it("computes the well-known bulge value for a 180-degree (semicircle) CCW arc: tan(45deg) = 1.0", () => {
    const path = new Path().arc({ center: { x: 0, y: 0 }, radius: 5, startAngle: 0, endAngle: Math.PI, counterclockwise: true });
    const { vertices } = pathToPolyline(path);
    expect(vertices[0]!.bulge).toBeCloseTo(1.0, 9);
  });

  it("negates the bulge for a clockwise arc of the same span", () => {
    const ccw = new Path().arc({ center: { x: 0, y: 0 }, radius: 5, startAngle: 0, endAngle: Math.PI / 2, counterclockwise: true });
    const cw = new Path().arc({ center: { x: 0, y: 0 }, radius: 5, startAngle: Math.PI / 2, endAngle: 0, counterclockwise: false });
    const ccwBulge = pathToPolyline(ccw).vertices[0]!.bulge;
    const cwBulge = pathToPolyline(cw).vertices[0]!.bulge;
    expect(cwBulge).toBeCloseTo(-ccwBulge, 9);
  });

  it("a circle (two 180deg arcs) round-trips as a 2-vertex closed polyline, both bulge 1.0", () => {
    const { vertices, closed } = pathToPolyline(circle(0, 0, 5));
    expect(closed).toBe(true);
    expect(vertices).toHaveLength(2);
    expect(vertices[0]!.bulge).toBeCloseTo(1.0, 9);
    expect(vertices[1]!.bulge).toBeCloseTo(1.0, 9);
  });

  it("an open path (no close()) is not marked closed and keeps its final vertex", () => {
    const path = new Path().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10);
    const { vertices, closed } = pathToPolyline(path);
    expect(closed).toBe(false);
    expect(vertices).toHaveLength(3);
  });

  it("returns an empty conversion for a path with no segments", () => {
    expect(pathToPolyline(new Path())).toEqual({ vertices: [], closed: false });
  });
});
