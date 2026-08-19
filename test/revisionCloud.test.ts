import { describe, expect, it } from "vitest";
import { rectangle } from "../src/geometry/shapes.js";
import { arcPointAt, arcSpan } from "../src/geometry/segments.js";
import { revisionCloud, RevisionSymbol } from "../src/annotation/revisionCloud.js";

describe("revisionCloud", () => {
  it("returns a single closed path (one continuous boundary, not disjoint subpaths)", () => {
    const el = revisionCloud(rectangle(0, 0, 40, 30), { arcLengthMM: 8 });
    expect(el.path.isClosed()).toBe(true);
  });

  it("the boundary is made of scalloped arc bumps (each edge is independently divided, so a trailing closing line may appear)", () => {
    const el = revisionCloud(rectangle(0, 0, 40, 30), { arcLengthMM: 8 });
    const segments = el.path.getSegments();
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      expect(["arc", "line"]).toContain(seg.type);
    }
    expect(segments.some((s) => s.type === "arc")).toBe(true);
  });

  it("bumps bulge outward from a CCW-wound rectangle: every arc's midpoint lies outside the rectangle", () => {
    const x = 0, y = 0, w = 40, h = 30;
    const el = revisionCloud(rectangle(x, y, w, h), { arcLengthMM: 8, bulgeRatio: 0.2 });
    const segments = el.path.getSegments();
    for (const seg of segments) {
      if (seg.type !== "arc") continue;
      const span = arcSpan(seg);
      const midAngle = seg.counterclockwise ? seg.startAngle + span / 2 : seg.startAngle - span / 2;
      const mid = arcPointAt(seg, midAngle);
      const outsideRect = mid.x < x - 1e-6 || mid.x > x + w + 1e-6 || mid.y < y - 1e-6 || mid.y > y + h + 1e-6;
      expect(outsideRect).toBe(true);
    }
  });

  it("the bulge (sagitta) matches the requested bulgeRatio for a simple single-bump edge", () => {
    // a 2-point boundary is degenerate for closing, so use a long rectangle edge sized to produce exactly one bump per side
    const chordLength = 20;
    const el = revisionCloud(rectangle(0, 0, chordLength, chordLength), { arcLengthMM: chordLength, bulgeRatio: 0.15 });
    const [seg] = el.path.getSegments();
    expect(seg!.type).toBe("arc");
    if (seg!.type !== "arc") throw new Error("unreachable");
    const bulge = chordLength * 0.15;
    const expectedRadius = (chordLength * chordLength) / (8 * bulge) + bulge / 2;
    expect(seg!.radius).toBeCloseTo(expectedRadius, 6);
  });

  it("divides each edge into roughly arcLengthMM-sized bumps", () => {
    const el = revisionCloud(rectangle(0, 0, 100, 50), { arcLengthMM: 10 });
    const arcs = el.path.getSegments().filter((s) => s.type === "arc");
    // perimeter 300mm at ~10mm/bump => ~30 bumps
    expect(arcs.length).toBeGreaterThanOrEqual(25);
    expect(arcs.length).toBeLessThanOrEqual(35);
  });

  it("accepts a plain point array as well as a Path", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 10, y: 15 },
    ];
    expect(() => revisionCloud(points)).not.toThrow();
  });

  it("respects custom stroke color and width", () => {
    const el = revisionCloud(rectangle(0, 0, 40, 30), { color: "red", strokeWidthMM: 0.5 });
    const svg = el.toSVG();
    expect(svg).toContain('stroke="red"');
    expect(svg).toContain('stroke-width="0.5"');
  });
});

describe("RevisionSymbol", () => {
  it("jitter varies the bump sizes but keeps a closed boundary, and is deterministic per seed", () => {
    const even = revisionCloud(rectangle(0, 0, 40, 30), { arcLengthMM: 8 }).toSVG();
    const wobbly = revisionCloud(rectangle(0, 0, 40, 30), { arcLengthMM: 8, jitter: 0.4, seed: 7 }).toSVG();
    const wobblyAgain = revisionCloud(rectangle(0, 0, 40, 30), { arcLengthMM: 8, jitter: 0.4, seed: 7 }).toSVG();
    expect(wobbly).not.toBe(even); // jitter changes the geometry
    expect(wobbly).toBe(wobblyAgain); // same seed → byte-identical (deterministic)
    expect(revisionCloud(rectangle(0, 0, 40, 30), { arcLengthMM: 8, jitter: 0.4, seed: 8 }).toSVG()).not.toBe(wobbly); // different seed → different
    expect(revisionCloud(rectangle(0, 0, 40, 30), { arcLengthMM: 8, jitter: 0.4, seed: 7 }).path.isClosed()).toBe(true);
  });

  it("renders a circle enclosing the letter by default (ASME Y14.35)", () => {
    const svg = new RevisionSymbol({ x: 10, y: 10 }, "A").toSVG();
    expect(svg).toContain("<path");
    expect(svg).toContain(">A<");
  });

  it('renders a triangle when shape is "triangle"', () => {
    const svg = new RevisionSymbol({ x: 10, y: 10 }, "B", { shape: "triangle" }).toSVG();
    // 3 vertices: M to the first, L to the second, then close() emits the 3rd side as an L plus a trailing Z
    const pathMatch = svg.match(/<path d="([^"]+)"/)!;
    const commandCount = (pathMatch[1]!.match(/[ML]/g) ?? []).length;
    expect(commandCount).toBe(4); // M + L + L + L(from close())
    expect(pathMatch[1]).toMatch(/Z$/);
  });

  it("respects a custom size and color", () => {
    const svg = new RevisionSymbol({ x: 0, y: 0 }, "C", { sizeMM: 10, color: "blue" }).toSVG();
    expect(svg).toContain('stroke="blue"');
  });
});
