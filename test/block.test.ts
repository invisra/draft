import { describe, expect, it } from "vitest";
import { Block } from "../src/svg/block.js";
import { View } from "../src/svg/view.js";
import { DrawingElement } from "../src/svg/element.js";
import { TextElement } from "../src/svg/text.js";
import { circle } from "../src/geometry/shapes.js";

const dot = () => new Block("dot").add(new DrawingElement(circle(0, 0, 5)));

describe("Block / BlockInstance", () => {
  it("places the block's local origin at the instance position", () => {
    const svg = dot().instance({ position: { x: 100, y: 50 } }).toSVG();
    // circle center (0,0) → (100,50); path starts at center+radius = (105,50)
    expect(svg).toContain("M 105 50");
  });

  it("scales the block's geometry", () => {
    const svg = dot().instance({ position: { x: 0, y: 0 }, scale: 2 }).toSVG();
    expect(svg).toContain("A 10 10"); // radius 5 × 2
  });

  it("rotates the block about its local origin", () => {
    const b = new Block().add(new DrawingElement(circle(10, 0, 2)));
    const svg = b.instance({ rotationDeg: 90 }).toSVG();
    // local center (10,0) rotates to (0,10); path starts at (0,12)
    expect(svg).toContain("M 0 12");
  });

  it("keeps text upright when the instance is rotated", () => {
    const b = new Block().add(new TextElement({ x: 10, y: 0 }, "A"));
    const svg = b.instance({ rotationDeg: 90 }).toSVG();
    expect(svg).toContain('transform="translate(0 10) scale(1,-1)"'); // position rotated, glyph upright
  });

  it("defines once, stamps many — each instance renders the geometry independently", () => {
    const b = dot();
    const a = b.instance({ position: { x: 10, y: 10 } }).toSVG();
    const c = b.instance({ position: { x: 90, y: 10 } }).toSVG();
    expect(a).toContain("M 15 10");
    expect(c).toContain("M 95 10");
    expect(a).not.toBe(c);
  });

  it("composes with an enclosing View (instance scale multiplies the view scale)", () => {
    // block dot placed at scale 2 inside a 3:1 view → effective radius 5 × 2 × 3 = 30
    const view = new View({ scale: 3 }).add(dot().instance({ scale: 2 }));
    expect(view.toSVG()).toContain("A 30 30");
  });

  it("rejects a non-positive scale", () => {
    expect(() => dot().instance({ scale: 0 })).toThrow();
  });

  it("a bare instance emits no wrapping group (children render inline, PDF-safe)", () => {
    const svg = dot().instance().toSVG();
    expect(svg).not.toContain("<g");
  });
});
