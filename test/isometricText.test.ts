import { describe, expect, it } from "vitest";
import { IsometricText } from "../src/annotation/isometricText.js";
import { View } from "../src/svg/view.js";

/** Parse the six numbers out of a `matrix(a b c d e f)` transform in the SVG. */
function matrixOf(svg: string): number[] {
  const m = svg.match(/matrix\(([^)]+)\)/);
  if (!m) throw new Error("no matrix in SVG");
  return m[1]!.trim().split(/\s+/).map(Number);
}

describe("IsometricText", () => {
  it("renders the content in a matrix-transformed <text>", () => {
    const svg = new IsometricText({ x: 0, y: 0 }, "SIDE A", { plane: "right" }).toSVG();
    expect(svg).toContain(">SIDE A</text>");
    expect(svg).toContain("matrix(");
  });

  it("places the anchor at the matrix translation (e, f)", () => {
    const [, , , , e, f] = matrixOf(new IsometricText({ x: 12, y: 34 }, "X", { plane: "top" }).toSVG());
    expect(e).toBeCloseTo(12, 5);
    expect(f).toBeCloseTo(34, 5);
  });

  it("shears onto each plane with the expected in-plane basis", () => {
    const cos30 = Math.cos(Math.PI / 6);
    // matrix(a b c d ..) = (right.x, right.y, -up.x, -up.y)
    const top = matrixOf(new IsometricText({ x: 0, y: 0 }, "T", { plane: "top" }).toSVG());
    expect([top[0], top[1], top[2], top[3]]).toEqual([expect.closeTo(cos30, 4), expect.closeTo(-0.5, 4), expect.closeTo(-cos30, 4), expect.closeTo(-0.5, 4)]);

    const right = matrixOf(new IsometricText({ x: 0, y: 0 }, "R", { plane: "right" }).toSVG());
    expect([right[0], right[1], right[2], right[3]]).toEqual([expect.closeTo(cos30, 4), expect.closeTo(-0.5, 4), expect.closeTo(0, 4), expect.closeTo(-1, 4)]);

    const left = matrixOf(new IsometricText({ x: 0, y: 0 }, "L", { plane: "left" }).toSVG());
    expect([left[0], left[1], left[2], left[3]]).toEqual([expect.closeTo(cos30, 4), expect.closeTo(0.5, 4), expect.closeTo(0, 4), expect.closeTo(-1, 4)]);
  });

  it("is not mirrored on any plane (linear det < 0, cancelling the sheet's Y-flip)", () => {
    for (const plane of ["top", "right", "left"] as const) {
      const [a, b, c, d] = matrixOf(new IsometricText({ x: 0, y: 0 }, "M", { plane }).toSVG());
      expect(a! * d! - b! * c!).toBeLessThan(0);
    }
  });

  it("honors explicit right/up axes over the plane default", () => {
    const [a, b, c, d] = matrixOf(new IsometricText({ x: 0, y: 0 }, "E", { right: { x: 1, y: 0 }, up: { x: 0, y: 1 } }).toSVG());
    // upright text: matrix(1, 0, 0, -1, ..) — the same as a normal TextElement
    expect([a, b, c, d]).toEqual([1, 0, 0, -1]);
  });

  it("carries size, anchor, weight and color through", () => {
    const svg = new IsometricText({ x: 0, y: 0 }, "N", { plane: "top", size: 4, anchor: "middle", weight: "bold", color: "red" }).toSVG();
    expect(svg).toContain('font-size="4"');
    expect(svg).toContain('text-anchor="middle"');
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain('fill="red"');
  });

  it("maps its anchor through a view transform (size unchanged)", () => {
    const view = new View({ scale: 2 });
    view.add(new IsometricText({ x: 5, y: 0 }, "V", { plane: "right", size: 3 }));
    const svg = view.toSVG();
    const [, , , , e] = matrixOf(svg);
    expect(e).toBeCloseTo(10, 5); // 5 → 10 under 2× scale
    expect(svg).toContain('font-size="3"'); // paper-size
  });
});
