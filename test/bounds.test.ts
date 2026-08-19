import { describe, expect, it } from "vitest";
import { DrawingElement } from "../src/svg/element.js";
import { TextElement } from "../src/svg/text.js";
import { Layer } from "../src/svg/layer.js";
import { View, fitView } from "../src/svg/view.js";
import { Block } from "../src/svg/block.js";
import { Sheet } from "../src/sheet/sheet.js";
import { boundsOf, type Renderable } from "../src/svg/renderable.js";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { rectangle, circle } from "../src/geometry/shapes.js";
import { Path } from "../src/geometry/path.js";

describe("bounds()", () => {
  it("DrawingElement returns the path's exact box", () => {
    expect(new DrawingElement(rectangle(10, 20, 30, 40)).bounds()).toEqual({ minX: 10, minY: 20, maxX: 40, maxY: 60 });
  });

  it("DrawingElement maps through an active view transform", () => {
    const el = new DrawingElement(rectangle(0, 0, 10, 10));
    expect(el.bounds({ transform: { scale: 2, translate: { x: 5, y: 5 } } })).toEqual({ minX: 5, minY: 5, maxX: 25, maxY: 25 });
  });

  it("DrawingElement returns null for an empty path", () => {
    expect(new DrawingElement(new Path()).bounds()).toBeNull();
  });

  it("TextElement returns an approximate box around the run", () => {
    const b = new TextElement({ x: 10, y: 20 }, "AB", { size: 5 }).bounds();
    expect(b).not.toBeNull();
    expect(b!.minX).toBe(10); // start anchor: left edge at x
    expect(b!.maxX).toBeGreaterThan(10);
    expect(b!.minY).toBeCloseTo(17.5, 6);
    expect(b!.maxY).toBeCloseTo(22.5, 6);
  });

  it("Layer unions its children", () => {
    const layer = new Layer({ name: "a" }).add(new DrawingElement(rectangle(0, 0, 5, 5))).add(new DrawingElement(circle(20, 20, 5)));
    expect(layer.bounds()).toEqual({ minX: 0, minY: 0, maxX: 25, maxY: 25 });
  });

  it("View reports paper-space (scaled) bounds and true model bounds", () => {
    const v = new View({ scale: 2 }).add(new DrawingElement(rectangle(0, 0, 10, 10)));
    expect(v.bounds()).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 20 });
    expect(v.contentBounds()).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
  });

  it("BlockInstance measures the placed copy", () => {
    const inst = new Block("dot").add(new DrawingElement(circle(0, 0, 5))).instance({ position: { x: 100, y: 50 } });
    expect(inst.bounds()).toEqual({ minX: 95, minY: 45, maxX: 105, maxY: 55 });
  });

  it("boundsOf skips renderables without a bounds() (e.g. dimensions)", () => {
    const dim: Renderable = new LinearDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { offset: 5 });
    expect(dim.bounds).toBeUndefined();
    const box = boundsOf([new DrawingElement(rectangle(0, 0, 4, 4)), dim]);
    expect(box).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 4 }); // dimension contributes nothing, doesn't throw
  });

  it("boundsOf returns null when nothing is measurable", () => {
    expect(boundsOf([new LinearDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { offset: 5 })])).toBeNull();
    expect(boundsOf([])).toBeNull();
  });

  it("Sheet.contentBounds unions added content (not the border/title block)", () => {
    const sheet = new Sheet();
    sheet.add(new DrawingElement(rectangle(50, 50, 20, 10)));
    expect(sheet.contentBounds()).toEqual({ minX: 50, minY: 50, maxX: 70, maxY: 60 });
    expect(new Sheet().contentBounds()).toBeNull();
  });
});

describe("fitView", () => {
  it("scales content to fit the area (aspect preserved) and centers it", () => {
    // content 100×50 into 200×100 with 10mm margin → avail 180×80 → scale min(1.8, 1.6) = 1.6
    const v = fitView({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, { x: 0, y: 0, width: 200, height: 100 }, { marginMM: 10 });
    expect(v.scale).toBeCloseTo(1.6, 6);
    // content center maps to area center
    expect(v.toPaper({ x: 50, y: 25 })).toEqual({ x: 100, y: 50 });
  });

  it("respects maxScale (never enlarges past the cap)", () => {
    const v = fitView({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, { x: 0, y: 0, width: 200, height: 200 }, { maxScale: 1 });
    expect(v.scale).toBe(1);
  });

  it("produces a usable View you add the content to", () => {
    const content = new DrawingElement(circle(50, 25, 40));
    const box = content.bounds()!;
    const v = fitView(box, { x: 0, y: 0, width: 100, height: 100 }, { marginMM: 5 });
    v.add(content);
    expect(v.toSVG()).toContain('class="view"');
  });
});
