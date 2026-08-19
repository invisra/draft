import { describe, expect, it } from "vitest";
import { Path } from "../src/geometry/path.js";
import { bezierPointAt, cubicBezierSegment } from "../src/geometry/segments.js";
import { pathToPolyline } from "../src/dxf/polylineConversion.js";
import { svgPathDataToPdfOps } from "../src/pdf/svgPathToPdfOps.js";

const arch = () => new Path().moveTo(0, 0).bezierCurveTo(0, 10, 10, 10, 10, 0);

describe("cubic Bézier Path segments", () => {
  it("appends a bezier segment", () => {
    const segs = arch().getSegments();
    expect(segs).toHaveLength(1);
    expect(segs[0]!.type).toBe("bezier");
  });

  it("throws if bezierCurveTo is called before moveTo", () => {
    expect(() => new Path().bezierCurveTo(0, 0, 1, 1, 2, 2)).toThrow();
  });

  it("evaluates points and an exact bounding box (peak at t=0.5)", () => {
    const seg = cubicBezierSegment({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 });
    expect(bezierPointAt(seg, 0.5)).toEqual({ x: 5, y: 7.5 });
    const b = arch().boundingBox();
    expect(b.minX).toBeCloseTo(0, 6);
    expect(b.maxX).toBeCloseTo(10, 6);
    expect(b.minY).toBeCloseTo(0, 6);
    expect(b.maxY).toBeCloseTo(7.5, 6); // curve never reaches control-point height 10
  });

  it("serializes to an SVG C command", () => {
    expect(arch().toSVGPathData()).toContain("C 0 10 10 10 10 0");
  });

  it("scales control points under a View transform", () => {
    const d = arch().transformed(2, { x: 0, y: 0 }).toSVGPathData();
    expect(d).toContain("C 0 20 20 20 20 0"); // all control/end points doubled
  });

  it("PDF export uses a native bezier operator", () => {
    const ops = svgPathDataToPdfOps(arch().toSVGPathData());
    expect(ops.some((op) => op.endsWith(" c"))).toBe(true);
  });

  it("DXF export tessellates a bezier into straight (bulge-0) vertices", () => {
    const { vertices } = pathToPolyline(arch());
    expect(vertices.length).toBeGreaterThan(10);
    expect(vertices.every((v) => v.bulge === 0)).toBe(true);
  });
});
