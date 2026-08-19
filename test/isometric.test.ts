import { describe, expect, it } from "vitest";
import { isometricProjection, projectIsoPlane, isoPolyline, isometricAxisDirections, isometricEllipseAxes, isometricCircle, isometricBox } from "../src/geometry/isometric.js";
import type { Point } from "../src/geometry/point.js";

const COS30 = Math.cos(Math.PI / 6);
const near = (p: Point, x: number, y: number, digits = 6) => {
  expect(p.x).toBeCloseTo(x, digits);
  expect(p.y).toBeCloseTo(y, digits);
};

describe("isometricProjection", () => {
  it("sends the origin to the origin", () => {
    near(isometricProjection({ x: 0, y: 0, z: 0 }), 0, 0);
  });

  it("+X goes right and down, +Y goes left and down, +Z straight up", () => {
    near(isometricProjection({ x: 1, y: 0, z: 0 }), COS30, -0.5);
    near(isometricProjection({ x: 0, y: 1, z: 0 }), -COS30, -0.5);
    near(isometricProjection({ x: 0, y: 0, z: 1 }), 0, 1);
  });

  it("projects a unit axis vector to unit length (equal foreshortening)", () => {
    for (const v of [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }]) {
      const p = isometricProjection(v);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 6);
    }
  });

  it("is linear (sum of axes = sum of projections)", () => {
    const combined = isometricProjection({ x: 2, y: 3, z: 4 });
    near(combined, (2 - 3) * COS30, 4 - (2 + 3) * 0.5);
  });
});

describe("projectIsoPlane", () => {
  it("top maps (x,y) to the horizontal Z=0 plane", () => {
    near(projectIsoPlane("top", { x: 2, y: 1 }), isometricProjection({ x: 2, y: 1, z: 0 }).x, isometricProjection({ x: 2, y: 1, z: 0 }).y);
  });

  it("right maps (x,y) to the X/Z wall (second coord runs up)", () => {
    near(projectIsoPlane("right", { x: 3, y: 5 }), 3 * COS30, 5 - 3 * 0.5);
  });

  it("left maps (x,y) to the Y/Z wall (second coord runs up)", () => {
    near(projectIsoPlane("left", { x: 3, y: 5 }), -3 * COS30, 5 - 3 * 0.5);
  });

  it("all three planes share the vertical axis for the second coordinate", () => {
    // a purely vertical move on left/right, and it rises the same amount
    near(projectIsoPlane("left", { x: 0, y: 4 }), 0, 4);
    near(projectIsoPlane("right", { x: 0, y: 4 }), 0, 4);
  });
});

describe("isoPolyline", () => {
  it("projects each point in order", () => {
    const out = isoPolyline([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }]);
    expect(out).toHaveLength(3);
    near(out[0]!, 0, 0);
    near(out[1]!, COS30, -0.5);
    near(out[2]!, 0, -1);
  });
});

describe("isometricAxisDirections", () => {
  it("returns the three unit axis directions", () => {
    const a = isometricAxisDirections();
    near(a.x, COS30, -0.5);
    near(a.y, -COS30, -0.5);
    near(a.z, 0, 1);
  });
});

describe("isometricEllipseAxes", () => {
  it("has a √3 major:minor ratio on every face", () => {
    for (const plane of ["top", "left", "right"] as const) {
      const { rx, ry } = isometricEllipseAxes(plane, 10);
      expect(rx / ry).toBeCloseTo(Math.sqrt(3), 6);
      expect(rx).toBeCloseTo(10 * Math.sqrt(1.5), 6); // ≈ 12.2474
      expect(ry).toBeCloseTo(10 * Math.sqrt(0.5), 6); // ≈ 7.0711
    }
  });

  it("orients the major axis horizontally on top, ∓60° on the walls", () => {
    expect(isometricEllipseAxes("top", 5).rotationDeg).toBeCloseTo(0, 6);
    expect(isometricEllipseAxes("right", 5).rotationDeg).toBeCloseTo(-60, 6);
    expect(isometricEllipseAxes("left", 5).rotationDeg).toBeCloseTo(60, 6);
  });

  it("matches the actual projection of a circle (the ellipse is that circle's image)", () => {
    // sample the circle on the right face and confirm every projected point lies on the ellipse
    const r = 8;
    const { rx, ry, rotationDeg } = isometricEllipseAxes("right", r);
    const rot = (rotationDeg * Math.PI) / 180;
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * 2 * Math.PI;
      const p = projectIsoPlane("right", { x: r * Math.cos(t), y: r * Math.sin(t) });
      // rotate the projected point back into the ellipse's own frame; it must satisfy x²/rx² + y²/ry² = 1
      const u = p.x * Math.cos(-rot) - p.y * Math.sin(-rot);
      const v = p.x * Math.sin(-rot) + p.y * Math.cos(-rot);
      expect((u * u) / (rx * rx) + (v * v) / (ry * ry)).toBeCloseTo(1, 6);
    }
  });
});

describe("isometricCircle", () => {
  it("draws the isometric ellipse centered at the projected point", () => {
    const d = isometricCircle("top", { x: 0, y: 0 }, 10).toSVGPathData();
    // top-face ellipse: rx≈12.24745, ry≈7.07107, no rotation, centered at (0,0)
    expect(d).toContain("M 12.24745 0 A 12.24745 7.07107 0");
  });

  it("tessellates to a polyline when segments is given", () => {
    const d = isometricCircle("top", { x: 0, y: 0 }, 10, { segments: 24 }).toSVGPathData();
    expect(d).not.toContain(" A "); // no arc commands
    expect((d.match(/ L /g) ?? []).length).toBe(24); // 24-gon closed (23 between points + 1 closing)
  });
});

describe("isometricBox", () => {
  it("returns three visible-edge paths (top loop + two front faces)", () => {
    const paths = isometricBox({ x: 20, y: 10, z: 8 });
    expect(paths).toHaveLength(3);
    expect(paths[0]!.isClosed()).toBe(true); // top face is a closed loop
    expect(paths[1]!.isClosed()).toBe(false);
    expect(paths[2]!.isClosed()).toBe(false);
  });

  it("projects the corners correctly and honors the origin offset", () => {
    const [top] = isometricBox({ x: 20, y: 10, z: 8 }, { origin: { x: 100, y: 50 } });
    // (0,0,h=8) → (0,8), + origin → (100,58)
    expect(top!.toSVGPathData()).toContain("M 100 58");
  });
});
