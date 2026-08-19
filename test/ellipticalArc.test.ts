import { describe, expect, it } from "vitest";
import { Path } from "../src/geometry/path.js";
import { ellipse, ellipticalArc } from "../src/geometry/shapes.js";
import {
  ellipticalArcPointAt,
  ellipticalArcSpan,
  segmentStart,
  segmentEnd,
  type EllipticalArcSegment,
} from "../src/geometry/segments.js";
import { pathToPolyline } from "../src/dxf/polylineConversion.js";
import { arcToBeziers } from "../src/pdf/svgArcToBezier.js";
import { svgPathDataToPdfOps } from "../src/pdf/svgPathToPdfOps.js";

const seg = (p: Path) => p.getSegments()[0] as EllipticalArcSegment;

describe("EllipticalArcSegment geometry", () => {
  it("evaluates points, endpoints, and parametric span", () => {
    const arc = seg(ellipticalArc(0, 0, 10, 5, 0, 90)); // param 0 → 90°, CCW
    expect(arc.type).toBe("ellipticalArc");
    // param 0 → (10,0); param 90° → (0,5)
    expect(segmentStart(arc).x).toBeCloseTo(10, 6);
    expect(segmentStart(arc).y).toBeCloseTo(0, 6);
    expect(segmentEnd(arc).x).toBeCloseTo(0, 6);
    expect(segmentEnd(arc).y).toBeCloseTo(5, 6);
    expect(ellipticalArcSpan(arc)).toBeCloseTo(Math.PI / 2, 6);
    // param 90° on a 30°-rotated ellipse: local (0, ry) rotated 30°
    const rot = seg(ellipticalArc(0, 0, 10, 5, 90, 90, { rotationDeg: 30 }));
    const p = ellipticalArcPointAt(rot, Math.PI / 2);
    expect(p.x).toBeCloseTo(-5 * Math.sin(Math.PI / 6), 6);
    expect(p.y).toBeCloseTo(5 * Math.cos(Math.PI / 6), 6);
  });
});

describe("ellipse() and ellipticalArc() shapes", () => {
  it("ellipse defaults to two true elliptical half-arcs; segments option tessellates", () => {
    const trueArcs = ellipse(0, 0, 10, 5).getSegments().filter((s) => s.type === "ellipticalArc");
    expect(trueArcs).toHaveLength(2);
    const tess = ellipse(0, 0, 10, 5, { segments: 24 });
    expect(tess.getSegments().every((s) => s.type === "line")).toBe(true);
    expect(tess.getSegments().length).toBeGreaterThanOrEqual(24);
  });

  it("emits an SVG A command with distinct rx/ry and a rotation term", () => {
    const d = ellipticalArc(0, 0, 10, 5, 0, 90, { rotationDeg: 30 }).toSVGPathData();
    // A rx ry rotation large-arc sweep endx endy
    const m = /A (\S+) (\S+) (\S+) (\d) (\d)/.exec(d);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeCloseTo(10, 4);
    expect(Number(m![2])).toBeCloseTo(5, 4);
    expect(Number(m![3])).toBeCloseTo(30, 4);
    expect(m![5]).toBe("1"); // CCW → sweep flag 1, matching circular-arc convention
  });

  it("rejects non-positive semi-axes", () => {
    expect(() => ellipticalArc(0, 0, 0, 5, 0, 90)).toThrow();
  });
});

// Reconstruct an arc's SVG `A` command through the (independent) endpoint→center
// bezier converter and confirm it traces the SAME curve as the parametric segment —
// a renderer-free check that rx/ry/rotation/large-arc/sweep are all emitted correctly.
function reconstructFromSvg(arcPath: Path): { points: { x: number; y: number }[]; end: { x: number; y: number } } {
  const d = arcPath.toSVGPathData();
  const tokens = d.trim().split(/\s+/);
  // M x y A rx ry rot large sweep x2 y2
  const x1 = Number(tokens[1]);
  const y1 = Number(tokens[2]);
  const rx = Number(tokens[4]);
  const ry = Number(tokens[5]);
  const xAxisRotationDeg = Number(tokens[6]);
  const largeArcFlag = Number(tokens[7]) as 0 | 1;
  const sweepFlag = Number(tokens[8]) as 0 | 1;
  const x2 = Number(tokens[9]);
  const y2 = Number(tokens[10]);
  const beziers = arcToBeziers({ x1, y1, rx, ry, xAxisRotationDeg, largeArcFlag, sweepFlag, x2, y2 });

  const cubic = (p0: number[], c1: number[], c2: number[], p3: number[], t: number) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0]! + 3 * u * u * t * c1[0]! + 3 * u * t * t * c2[0]! + t * t * t * p3[0]!,
      u * u * u * p0[1]! + 3 * u * u * t * c1[1]! + 3 * u * t * t * c2[1]! + t * t * t * p3[1]!,
    ];
  };
  const points: { x: number; y: number }[] = [];
  let prev = [x1, y1];
  for (const b of beziers) {
    for (let k = 1; k <= 10; k++) {
      const [x, y] = cubic(prev, [b.c1x, b.c1y], [b.c2x, b.c2y], [b.x, b.y], k / 10);
      points.push({ x: x!, y: y! });
    }
    prev = [b.x, b.y];
  }
  return { points, end: { x: prev[0]!, y: prev[1]! } };
}

const minDistTo = (target: { x: number; y: number }, pts: { x: number; y: number }[]) =>
  Math.min(...pts.map((p) => Math.hypot(p.x - target.x, p.y - target.y)));

describe("SVG A emission round-trips through the arc→bezier converter", () => {
  const cases = [
    { name: "axis-aligned quarter", path: ellipticalArc(2, 3, 12, 6, 0, 90) },
    { name: "rotated 40°", path: ellipticalArc(0, 0, 14, 5, 20, 160, { rotationDeg: 40 }) },
    { name: "clockwise", path: ellipticalArc(0, 0, 10, 4, 30, -60, { counterclockwise: false }) },
    { name: "large arc (>180°)", path: ellipticalArc(1, 1, 9, 5, 0, 250, { rotationDeg: 15 }) },
  ];

  for (const c of cases) {
    it(`traces the true curve: ${c.name}`, () => {
      const arc = seg(c.path);
      const { points, end } = reconstructFromSvg(c.path);

      // the reconstruction must end exactly at the arc's true end point
      expect(end.x).toBeCloseTo(segmentEnd(arc).x, 4);
      expect(end.y).toBeCloseTo(segmentEnd(arc).y, 4);

      // and it must pass through the arc's true parametric midpoint (a wrong
      // sweep, large-arc, or rotation sign would miss it by a wide margin)
      const span = ellipticalArcSpan(arc);
      const midParam = arc.counterclockwise ? arc.startAngle + span / 2 : arc.startAngle - span / 2;
      const trueMid = ellipticalArcPointAt(arc, midParam);
      expect(minDistTo(trueMid, points)).toBeLessThan(0.05);
    });
  }
});

describe("exporters handle elliptical arcs", () => {
  it("DXF tessellates an elliptical arc into straight (bulge-0) vertices", () => {
    const { vertices } = pathToPolyline(ellipse(0, 0, 10, 5));
    expect(vertices.length).toBeGreaterThan(20);
    expect(vertices.every((v) => v.bulge === 0)).toBe(true);
  });

  it("PDF converts an elliptical arc's A command into cubic bezier (c) operators", () => {
    const ops = svgPathDataToPdfOps(ellipticalArc(0, 0, 10, 5, 0, 180, { rotationDeg: 25 }).toSVGPathData());
    expect(ops.some((op) => op.endsWith(" c"))).toBe(true);
    expect(ops[0]!.endsWith(" m")).toBe(true);
  });
});
