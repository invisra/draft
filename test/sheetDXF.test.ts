import { describe, expect, it } from "vitest";
import { Sheet } from "../src/sheet/sheet.js";
import { Layer } from "../src/svg/layer.js";
import { View } from "../src/svg/view.js";
import { DrawingElement } from "../src/svg/element.js";
import { rectangle, circle } from "../src/geometry/shapes.js";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { FeatureControlFrame } from "../src/gdt/featureControlFrame.js";
import { Callout } from "../src/dimension/callout.js";
import { TitleBlock } from "../src/titleblock/titleBlock.js";
import { importDXF } from "../src/dxf/importDXF.js";

function has(dxf: string, layer: string): boolean {
  return dxf.includes(`\n2\n${layer}\n`);
}
function count(dxf: string, re: RegExp): number {
  return (dxf.match(re) ?? []).length;
}

describe("Sheet.toDXF", () => {
  it("produces a valid DXF with the border on a BORDER layer", () => {
    const dxf = new Sheet().toDXF();
    expect(dxf).toContain("0\nSECTION\n2\nHEADER\n");
    expect(dxf.trimEnd().endsWith("0\nEOF")).toBe(true);
    expect(has(dxf, "BORDER")).toBe(true);
  });

  it("emits a zoned border's ticks and labels on the BORDER layer", () => {
    const dxf = new Sheet({ borderStyle: "zoned" }).toDXF();
    const entities = dxf.slice(dxf.indexOf("2\nENTITIES\n"));
    expect(entities).toContain("0\nTEXT\n8\nBORDER\n"); // zone labels
    expect(entities).toContain("0\nPOLYLINE\n8\nBORDER\n"); // frame + ticks
  });

  it("exports sheet-level content by type: geometry, native DIMENSION, GD&T, callouts, title block", () => {
    const sheet = new Sheet()
      .add(new DrawingElement(rectangle(20, 20, 60, 40)))
      .add(new LinearDimension({ x: 20, y: 15 }, { x: 80, y: 15 }, { offset: -8 }))
      .add(new FeatureControlFrame({ x: 20, y: 70 }, "position", 0.5, { datums: [{ letter: "A" }] }))
      .add(new Callout({ x: 100, y: 40 }, "TYP", { angleDeg: 45 }));
    sheet.setTitleBlock(new TitleBlock({ title: "ASSEMBLY", drawingNumber: "D-200" }));
    const dxf = sheet.toDXF();

    expect(has(dxf, "VISIBLE")).toBe(true);
    expect(has(dxf, "DIMENSIONS")).toBe(true);
    expect(has(dxf, "GDT")).toBe(true);
    expect(has(dxf, "ANNOTATIONS")).toBe(true);
    expect(has(dxf, "TITLEBLOCK")).toBe(true);
    expect(count(dxf, /\n0\nDIMENSION\n/g)).toBe(1); // the linear dim stays a native DIMENSION
    expect(dxf).toContain("1\nASSEMBLY\n");
  });

  it("recurses into layers (content still exported, organized by type)", () => {
    const layer = new Layer({ name: "widgets" }).add(new DrawingElement(circle(50, 50, 10)));
    const dxf = new Sheet().add(layer).toDXF();
    // The circle is exported (as a bulged POLYLINE on VISIBLE); the SVG layer name isn't a DXF layer.
    expect(has(dxf, "VISIBLE")).toBe(true);
    expect(has(dxf, "widgets")).toBe(false);
  });

  it("bakes a view's scale into geometry (a 2:1 circle exports at twice the radius)", () => {
    const plain = new Sheet().add(new DrawingElement(circle(0, 0, 10)));
    const viewed = new Sheet().add(new View({ scale: 2, paperOrigin: { x: 100, y: 50 } }).add(new DrawingElement(circle(0, 0, 10))));
    // elements[0] is the border rectangle; elements[1] is the circle.
    const circleWidth = (dxf: string) => {
      const b = importDXF(dxf).elements[1]!.path.boundingBox()!;
      return b.maxX - b.minX;
    };
    expect(circleWidth(viewed.toDXF())).toBeCloseTo(circleWidth(plain.toDXF()) * 2, 3); // radius 10 → 20
  });

  it("exports a native dimension inside a scaled view as a DIMENSION with the transform baked in, keeping the true value", () => {
    const view = new View({ scale: 2, paperOrigin: { x: 100, y: 50 } })
      .add(new DrawingElement(circle(0, 0, 10)))
      // a 20mm-true horizontal dimension
      .add(new LinearDimension({ x: -10, y: -15 }, { x: 10, y: -15 }, { offset: -5 }));
    const skipped: string[] = [];
    const dxf = new Sheet().add(view).toDXF({ onUnsupported: (m) => skipped.push(m) });
    expect(skipped).toHaveLength(0); // no longer skipped
    expect(count(dxf, /\n0\nDIMENSION\n/g)).toBe(1); // emitted as a native DIMENSION
    // the value text (group 1) stays the true measurement (20), not the scaled 40
    expect(dxf).toMatch(/\n1\n20\.00\n/);
    expect(dxf).not.toMatch(/\n1\n40\.00\n/);
    expect(has(dxf, "VISIBLE")).toBe(true);
  });

  it("scales the DIMENSION's geometry by the view (a 2:1 view doubles the dimension-line span)", () => {
    const dim = (scale: number) => {
      const view = new View({ scale, paperOrigin: { x: 0, y: 0 } }).add(
        new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, { offset: -5 }),
      );
      // find the DIMENSION block's definition points via a round-trip is overkill; measure defpoint spread in raw DXF
      const dxf = new Sheet().add(view).toDXF();
      const xs = [...dxf.matchAll(/\n1[34]\n(-?[0-9.]+)\n/g)].map((m) => Number(m[1]));
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(dim(2)).toBeCloseTo(dim(1) * 2, 3); // 20mm true → 40mm of paper span at 2:1
  });

  it("keeps a native dimension inside an untransformed (grouping) view as a native DIMENSION", () => {
    const view = new View({ scale: 1 }).add(new LinearDimension({ x: 20, y: 15 }, { x: 80, y: 15 }, { offset: -8 }));
    const dxf = new Sheet().add(view).toDXF();
    expect(count(dxf, /\n0\nDIMENSION\n/g)).toBe(1);
  });
});
