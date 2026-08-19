import { describe, expect, it } from "vitest";
import { View, formatScaleRatio } from "../src/svg/view.js";
import { DrawingElement } from "../src/svg/element.js";
import { TextElement } from "../src/svg/text.js";
import { circle } from "../src/geometry/shapes.js";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { RadialDimension } from "../src/dimension/radialDimension.js";

describe("View — geometry scaling", () => {
  it("scales geometry by the view scale (a 5mm-radius circle drawn 2:1 spans radius 10)", () => {
    const svg = new View({ scale: 2 }).add(new DrawingElement(circle(0, 0, 5))).toSVG();
    expect(svg).toContain('class="view"');
    expect(svg).toContain("A 10 10"); // arc radius 5 * 2
  });

  it("places model geometry at the paper origin", () => {
    const svg = new View({ scale: 2, paperOrigin: { x: 100, y: 50 } }).add(new DrawingElement(circle(0, 0, 5))).toSVG();
    expect(svg).toContain("M 110 50"); // circle start (cx+r) = (0+5)*2 + 100 = 110, y = 50
  });

  it("keeps stroke weight in paper units (not scaled)", () => {
    const svg = new View({ scale: 4 }).add(new DrawingElement(circle(0, 0, 5), { stroke: { width: 0.25 } })).toSVG();
    expect(svg).toContain('stroke-width="0.25"');
  });
});

describe("View — annotation stays paper-size and reads true", () => {
  it("a dimension inside a 2:1 view reports the true model length", () => {
    const svg = new View({ scale: 2 })
      .add(new LinearDimension({ x: 0, y: 0 }, { x: 50, y: 0 }, { offset: -10, orientation: "horizontal" }))
      .toSVG();
    expect(svg).toContain(">50.00<"); // true model value, not the 100mm paper span
  });

  it("a radius dimension reports the true model radius", () => {
    const svg = new View({ scale: 2 }).add(new RadialDimension({ x: 0, y: 0 }, 5, { angleDeg: 45 })).toSVG();
    expect(svg).toContain(">R5.00<");
  });

  it("maps text position but keeps its height", () => {
    const svg = new View({ scale: 2 }).add(new TextElement({ x: 10, y: 10 }, "HI", { size: 3 })).toSVG();
    expect(svg).toContain("translate(20 20)"); // 10*2
    expect(svg).toContain('font-size="3"'); // unscaled
  });

  it("outside a view, output is unchanged (no transform = identity)", () => {
    const bare = new DrawingElement(circle(0, 0, 5)).toSVG();
    expect(bare).toContain("A 5 5");
  });
});

describe("View — coordinate mapping", () => {
  it("toPaper / toModel round-trip", () => {
    const view = new View({ scale: 2, paperOrigin: { x: 30, y: 40 } });
    const paper = view.toPaper({ x: 5, y: 5 });
    expect(paper).toEqual({ x: 40, y: 50 }); // 5*2+30, 5*2+40
    expect(view.toModel(paper)).toEqual({ x: 5, y: 5 });
  });

  it("rejects a non-positive scale", () => {
    expect(() => new View({ scale: 0 })).toThrow();
  });
});

describe("View — rotation (auxiliary/rotated views)", () => {
  it("rotates a point about the model origin (90° CCW maps +X to +Y)", () => {
    const view = new View({ scale: 1, rotationDeg: 90 });
    const p = view.toPaper({ x: 10, y: 0 });
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(10, 9);
  });

  it("toPaper / toModel round-trip under scale + rotation", () => {
    const view = new View({ scale: 2, rotationDeg: 37, paperOrigin: { x: 15, y: -8 } });
    const model = { x: 6, y: 4 };
    const back = view.toModel(view.toPaper(model));
    expect(back.x).toBeCloseTo(6, 9);
    expect(back.y).toBeCloseTo(4, 9);
  });

  it("rotates geometry (a circle's center moves, radius unchanged)", () => {
    const svg = new View({ scale: 1, rotationDeg: 90 }).add(new DrawingElement(circle(10, 0, 5))).toSVG();
    // center (10,0) → (0,10); the circle path starts at the top: (0, 15), arc radius still 5
    expect(svg).toContain("M 0 15 A 5 5");
  });

  it("keeps text upright — the glyph is never rotated, only its position moves", () => {
    const svg = new View({ scale: 1, rotationDeg: 90 }).add(new TextElement({ x: 10, y: 0 }, "HI")).toSVG();
    // position rotated to (0,10); wrapper is a plain translate + Y-counterflip, no rotation
    expect(svg).toContain('transform="translate(0 10) scale(1,-1)"');
  });

  it("a dimension in a rotated, scaled view still reports the true model length", () => {
    const svg = new View({ scale: 2, rotationDeg: 37 }).add(new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, { offset: 5 })).toSVG();
    expect(svg).toContain(">20.00<");
  });

  it("rotationDeg 0 is byte-identical to an unrotated view", () => {
    const geom = () => new DrawingElement(circle(3, 7, 4));
    const plain = new View({ scale: 1.5, paperOrigin: { x: 5, y: 2 } }).add(geom()).toSVG();
    const zero = new View({ scale: 1.5, paperOrigin: { x: 5, y: 2 }, rotationDeg: 0 }).add(geom()).toSVG();
    expect(zero).toBe(plain);
  });
});

describe("formatScaleRatio", () => {
  it("formats the conventional drawing ratio", () => {
    expect(formatScaleRatio(2)).toBe("2:1");
    expect(formatScaleRatio(0.5)).toBe("1:2");
    expect(formatScaleRatio(1)).toBe("1:1");
    expect(formatScaleRatio(4)).toBe("4:1");
    expect(formatScaleRatio(0.25)).toBe("1:4");
  });
});
