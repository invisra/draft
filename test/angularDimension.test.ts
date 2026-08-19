import { describe, expect, it } from "vitest";
import { AngularDimension } from "../src/dimension/angularDimension.js";

function countTag(svg: string, tag: string): number {
  return (svg.match(new RegExp(`<${tag} `, "g")) ?? []).length;
}

describe("AngularDimension", () => {
  it("measures a simple 90-degree angle (CCW from +X to +Y)", () => {
    const svg = new AngularDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { radius: 20 }).toSVG();
    expect(svg).toContain(">90.00°<");
  });

  it("measures counterclockwise from p1's ray to p2's ray, not the shorter angle", () => {
    // going CCW from +Y (90deg) to +X (0deg) is 270 degrees, not 90.
    const svg = new AngularDimension({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 0 }, { radius: 20 }).toSVG();
    expect(svg).toContain(">270.00°<");
  });

  it("handles the atan2 wraparound boundary correctly (rays straddling 180deg)", () => {
    // ray1 at 170deg, ray2 at 230deg (== -130deg via atan2) -> CCW sweep is 60deg
    const rad1 = (170 * Math.PI) / 180;
    const rad2 = (230 * Math.PI) / 180;
    const p1 = { x: 10 * Math.cos(rad1), y: 10 * Math.sin(rad1) };
    const p2 = { x: 10 * Math.cos(rad2), y: 10 * Math.sin(rad2) };
    const svg = new AngularDimension({ x: 0, y: 0 }, p1, p2, { radius: 20 }).toSVG();
    expect(svg).toContain(">60.00°<");
  });

  it("is independent of how far along each ray p1/p2 sit", () => {
    const near = new AngularDimension({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { radius: 20 }).toSVG();
    const far = new AngularDimension({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { radius: 20 }).toSVG();
    expect(near).toContain(">90.00°<");
    expect(far).toContain(">90.00°<");
  });

  it("respects an explicit text override", () => {
    const svg = new AngularDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { radius: 20, text: "TYP" }).toSVG();
    expect(svg).toContain(">TYP<");
  });

  it("draws two extension lines, a broken (two-piece) dimension arc, and two arrowheads", () => {
    const svg = new AngularDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { radius: 20 }).toSVG();
    expect(countTag(svg, "path")).toBe(6);
  });

  it("places the dimension arc's endpoints at the given radius from the vertex", () => {
    const vertex = { x: 5, y: 5 };
    const svg = new AngularDimension(vertex, { x: 15, y: 5 }, { x: 5, y: 15 }, { radius: 20 }).toSVG();
    // arc from angle1=0 should start at (25, 5): "M 25 5 A ..."
    expect(svg).toContain("M 25 5 A");
  });

  it("throws when a ray has zero length (a point coincides with the vertex)", () => {
    expect(() => new AngularDimension({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }, { radius: 20 }).toSVG()).toThrow(/zero length/);
  });

  it("throws when the two rays are parallel (angle undefined, not a silent full circle)", () => {
    // both rays point along +X → the subtended angle is 0°/360°, previously drawn as a full circle
    expect(() => new AngularDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { radius: 20 }).toSVG()).toThrow(/parallel/);
  });
});
