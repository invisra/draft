import { describe, expect, it } from "vitest";
import { cylindricalBreakLine, freehandBreakLine, zigzagBreakLine } from "../src/annotation/breakLine.js";
import type { ArcSegment } from "../src/geometry/segments.js";

function arcsOf(segments: readonly { type: string }[]): ArcSegment[] {
  return segments.filter((s): s is ArcSegment => s.type === "arc");
}

describe("zigzagBreakLine", () => {
  it("starts and ends exactly at p1/p2", () => {
    const el = zigzagBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 });
    const d = el.path.toSVGPathData();
    expect(d.startsWith("M 0 0")).toBe(true);
    expect(d.endsWith("L 40 0")).toBe(true);
  });

  it("produces a single open (unclosed) polyline with no arcs", () => {
    const d = zigzagBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 }).path.toSVGPathData();
    expect(d).not.toContain("A ");
    expect(d).not.toContain("Z");
  });

  it("the jog swings perpendicular from the line by amplitudeMM", () => {
    const d = zigzagBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 }, { amplitudeMM: 6 }).path.toSVGPathData();
    // for a horizontal p1->p2, the perpendicular axis is Y; the jog's peak/trough should reach y=+/-6
    expect(d).toMatch(/ 6(\s|$)/);
    expect(d).toMatch(/-6(\s|$)/);
  });

  it("works along a non-axis-aligned line too", () => {
    expect(() => zigzagBreakLine({ x: 0, y: 0 }, { x: 30, y: 40 })).not.toThrow();
  });

  it("respects a custom color and stroke width", () => {
    const el = zigzagBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 }, { color: "blue", strokeWidthMM: 0.4 });
    const svg = el.toSVG();
    expect(svg).toContain('stroke="blue"');
    expect(svg).toContain('stroke-width="0.4"');
  });
});

describe("cylindricalBreakLine", () => {
  it("starts and ends exactly at p1/p2", () => {
    const el = cylindricalBreakLine({ x: 0, y: 0 }, { x: 0, y: 20 });
    const d = el.path.toSVGPathData();
    expect(d.startsWith("M 0 0")).toBe(true);
    const end = d.trim().split(" ").slice(-2).join(" ");
    expect(end).toBe("0 20");
  });

  it("is built from exactly two arc segments (the mirrored S-curve halves)", () => {
    const d = cylindricalBreakLine({ x: 0, y: 0 }, { x: 0, y: 20 }).path.toSVGPathData();
    expect((d.match(/A /g) ?? []).length).toBe(2);
  });

  it("the two arc halves bulge in opposite directions (a true S, not a plain semicircle)", () => {
    const arcs = arcsOf(cylindricalBreakLine({ x: 0, y: 0 }, { x: 0, y: 20 }).path.getSegments());
    expect(arcs).toHaveLength(2);
    expect(arcs[0]!.counterclockwise).not.toBe(arcs[1]!.counterclockwise);
  });

  it("each arc's radius is 1/4 the p1-p2 distance", () => {
    const arcs = arcsOf(cylindricalBreakLine({ x: 0, y: 0 }, { x: 0, y: 40 }).path.getSegments());
    for (const seg of arcs) expect(seg.radius).toBeCloseTo(10, 5); // 40 / 4
  });

  it("works along a non-axis-aligned line too", () => {
    expect(() => cylindricalBreakLine({ x: 0, y: 0 }, { x: 30, y: 40 })).not.toThrow();
  });

  it("respects a custom color and stroke width", () => {
    const svg = cylindricalBreakLine({ x: 0, y: 0 }, { x: 0, y: 20 }, { color: "blue", strokeWidthMM: 0.4 }).toSVG();
    expect(svg).toContain('stroke="blue"');
    expect(svg).toContain('stroke-width="0.4"');
  });
});

describe("freehandBreakLine", () => {
  it("starts and ends exactly at p1/p2", () => {
    const d = freehandBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 }).path.toSVGPathData();
    expect(d.startsWith("M 0 0")).toBe(true);
    const end = d.trim().split(" ").slice(-2).join(" ");
    expect(end).toBe("40 0");
  });

  it("is a smooth curve (cubic béziers, no arcs, open)", () => {
    const d = freehandBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 }).path.toSVGPathData();
    expect(d).toContain("C "); // faired through fitSpline
    expect(d).not.toContain("A ");
    expect(d).not.toContain("Z");
  });

  it("waves to both sides of the line by roughly amplitudeMM", () => {
    const box = freehandBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 }, { amplitudeMM: 6 }).path.boundingBox();
    // horizontal line → the wave swings in Y; peaks pass through ±6 (fitSpline may overshoot slightly)
    expect(box.maxY).toBeGreaterThan(5);
    expect(box.maxY).toBeLessThan(8);
    expect(box.minY).toBeLessThan(-5);
    expect(box.minY).toBeGreaterThan(-8);
  });

  it("is drawn thicker than the visible outline by default (0.5mm), and is overridable", () => {
    expect(freehandBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 }).toSVG()).toContain('stroke-width="0.5"');
    const custom = freehandBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 }, { color: "blue", strokeWidthMM: 0.3 }).toSVG();
    expect(custom).toContain('stroke="blue"');
    expect(custom).toContain('stroke-width="0.3"');
  });

  it("is deterministic (identical output across calls) — no randomized freehand jitter", () => {
    const a = freehandBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 }).path.toSVGPathData();
    const b = freehandBreakLine({ x: 0, y: 0 }, { x: 40, y: 0 }).path.toSVGPathData();
    expect(a).toBe(b);
  });

  it("works along a non-axis-aligned line too", () => {
    expect(() => freehandBreakLine({ x: 0, y: 0 }, { x: 30, y: 40 })).not.toThrow();
  });
});
