import { describe, expect, it } from "vitest";
import { parseColor } from "../src/pdf/colors.js";
import { arcToBeziers } from "../src/pdf/svgArcToBezier.js";
import { svgPathDataToPdfOps } from "../src/pdf/svgPathToPdfOps.js";
import { Path } from "../src/geometry/path.js";
import { circle } from "../src/geometry/shapes.js";

describe("parseColor", () => {
  it("parses 6-digit and 3-digit hex", () => {
    expect(parseColor("#0066cc")).toEqual([0, 0x66 / 255, 0xcc / 255]);
    expect(parseColor("#0066cc")[1]).toBeCloseTo(0.4, 5);
    expect(parseColor("#f00")).toEqual([1, 0, 0]);
  });

  it("parses named colors case-insensitively", () => {
    expect(parseColor("black")).toEqual([0, 0, 0]);
    expect(parseColor("WHITE")).toEqual([1, 1, 1]);
    expect(parseColor("Red")).toEqual([1, 0, 0]);
  });

  it("falls back to black for unrecognized values", () => {
    expect(parseColor("rgb(1,2,3)")).toEqual([0, 0, 0]);
    expect(parseColor("not-a-color")).toEqual([0, 0, 0]);
  });
});

describe("arcToBeziers", () => {
  it("computes the well-known kappa constant for a 90-degree arc", () => {
    // quarter circle, radius 10, CCW from (10,0) to (0,10) centered at origin
    const beziers = arcToBeziers({ x1: 10, y1: 0, rx: 10, ry: 10, xAxisRotationDeg: 0, largeArcFlag: 0, sweepFlag: 1, x2: 0, y2: 10 });
    expect(beziers).toHaveLength(1);
    const kappa = 0.5522847498;
    expect(beziers[0]!.c1x).toBeCloseTo(10, 5);
    expect(beziers[0]!.c1y).toBeCloseTo(10 * kappa, 5);
    expect(beziers[0]!.c2x).toBeCloseTo(10 * kappa, 5);
    expect(beziers[0]!.c2y).toBeCloseTo(10, 5);
    expect(beziers[0]!.x).toBeCloseTo(0, 5);
    expect(beziers[0]!.y).toBeCloseTo(10, 5);
  });

  it("splits a large arc into multiple <=90deg segments", () => {
    // 270-degree arc (large-arc flag set) needs at least 3 segments
    const beziers = arcToBeziers({ x1: 10, y1: 0, rx: 10, ry: 10, xAxisRotationDeg: 0, largeArcFlag: 1, sweepFlag: 1, x2: 0, y2: -10 });
    expect(beziers.length).toBeGreaterThanOrEqual(3);
    // the final segment's endpoint must be the requested end point
    const last = beziers[beziers.length - 1]!;
    expect(last.x).toBeCloseTo(0, 5);
    expect(last.y).toBeCloseTo(-10, 5);
  });

  it("returns an empty array for a degenerate arc (coincident endpoints)", () => {
    expect(arcToBeziers({ x1: 5, y1: 5, rx: 10, ry: 10, xAxisRotationDeg: 0, largeArcFlag: 0, sweepFlag: 0, x2: 5, y2: 5 })).toEqual([]);
  });

  it("round-trips through this library's own Path.arc()/toSVGPathData(): recovered bezier endpoints match the original arc geometry", () => {
    const p = new Path().arc({ center: { x: 3, y: 4 }, radius: 7, startAngle: (20 * Math.PI) / 180, endAngle: (200 * Math.PI) / 180, counterclockwise: true });
    const d = p.toSVGPathData();
    const ops = svgPathDataToPdfOps(d);
    // last op is a bezier curve ("... c"); its endpoint should match the arc's true endpoint
    const lastOp = ops[ops.length - 1]!;
    expect(lastOp.endsWith(" c")).toBe(true);
    const nums = lastOp.split(" ").slice(0, -1).map(Number);
    const [, , , , endX, endY] = nums;
    const expectedEnd = { x: 3 + 7 * Math.cos((200 * Math.PI) / 180), y: 4 + 7 * Math.sin((200 * Math.PI) / 180) };
    expect(endX).toBeCloseTo(expectedEnd.x, 3);
    expect(endY).toBeCloseTo(expectedEnd.y, 3);
  });
});

describe("svgPathDataToPdfOps", () => {
  it("converts M/L/Z into m/l/h operators", () => {
    const ops = svgPathDataToPdfOps("M 0 0 L 10 0 L 10 5 Z");
    expect(ops).toEqual(["0 0 m", "10 0 l", "10 5 l", "h"]);
  });

  it("converts a full circle's two semicircular arcs into bezier curve operators", () => {
    const ops = svgPathDataToPdfOps(circle(0, 0, 5).toSVGPathData());
    const curves = ops.filter((op) => op.endsWith(" c"));
    // two ~180deg arcs, each split into 2 <=90deg bezier segments
    expect(curves).toHaveLength(4);
    expect(ops.every((op) => op.endsWith(" c") || op.endsWith(" m") || op.endsWith(" l") || op === "h")).toBe(true);
  });

  it("returns an empty array for an empty path", () => {
    expect(svgPathDataToPdfOps(new Path().toSVGPathData())).toEqual([]);
  });

  it("throws on an unsupported command", () => {
    expect(() => svgPathDataToPdfOps("M 0 0 Q 1 1 2 2")).toThrow(); // quadratic Bézier is not emitted by this library
  });

  it("converts a cubic Bézier (C) to a native PDF bezier operator", () => {
    const ops = svgPathDataToPdfOps("M 0 0 C 1 1 2 2 3 3");
    expect(ops[ops.length - 1]).toBe("1 1 2 2 3 3 c");
  });
});
