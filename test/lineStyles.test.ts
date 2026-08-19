import { describe, expect, it } from "vitest";
import { DrawingElement } from "../src/svg/element.js";
import { rectangle, centerMark } from "../src/geometry/shapes.js";

describe("DrawingElement line styles", () => {
  it("defaults to the visible preset (thick, no dash)", () => {
    const svg = new DrawingElement(rectangle(0, 0, 10, 10)).toSVG();
    expect(svg).toContain('stroke-width="0.5"');
    expect(svg).not.toContain("stroke-dasharray");
  });

  it("resolves a named lineStyle to its preset dasharray and width", () => {
    const svg = new DrawingElement(rectangle(0, 0, 10, 10), { lineStyle: "hidden" }).toSVG();
    expect(svg).toContain('stroke-width="0.25"');
    expect(svg).toContain('stroke-dasharray="3,1.5"');
  });

  it("distinguishes centerline and phantom by dash pattern", () => {
    const centerline = new DrawingElement(rectangle(0, 0, 10, 10), { lineStyle: "centerline" }).toSVG();
    const phantom = new DrawingElement(rectangle(0, 0, 10, 10), { lineStyle: "phantom" }).toSVG();
    expect(centerline).toContain('stroke-dasharray="24,1.5,3,1.5"');
    expect(phantom).toContain('stroke-dasharray="24,1.5,3,1.5,3,1.5"');
  });

  it("lets an explicit stroke field override just that field of the preset", () => {
    const svg = new DrawingElement(rectangle(0, 0, 10, 10), { lineStyle: "hidden", stroke: { color: "red" } }).toSVG();
    expect(svg).toContain('stroke="red"');
    // width/dasharray still come from the hidden preset
    expect(svg).toContain('stroke-width="0.25"');
    expect(svg).toContain('stroke-dasharray="3,1.5"');
  });

  it('omits the stroke attributes entirely when stroke is "none"', () => {
    const svg = new DrawingElement(rectangle(0, 0, 10, 10), { stroke: "none" }).toSVG();
    expect(svg).not.toContain("stroke=");
  });
});

describe("centerMark", () => {
  it("produces two open paths crossing at the center, extending radius + overshoot", () => {
    const [h, v] = centerMark({ x: 10, y: 10 }, 5, 2);
    const hBox = h.boundingBox();
    const vBox = v.boundingBox();
    expect(hBox.minX).toBeCloseTo(3);
    expect(hBox.maxX).toBeCloseTo(17);
    expect(hBox.minY).toBeCloseTo(10);
    expect(vBox.minY).toBeCloseTo(3);
    expect(vBox.maxY).toBeCloseTo(17);
    expect(h.isClosed()).toBe(false);
    expect(v.isClosed()).toBe(false);
  });
});
