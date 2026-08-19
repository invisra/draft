import { describe, expect, it } from "vitest";
import { importDXF } from "../src/dxf/importDXF.js";
import { exportDXF } from "../src/dxf/exportDXF.js";
import { DrawingElement } from "../src/svg/element.js";
import { TextElement } from "../src/svg/text.js";
import { Path } from "../src/geometry/path.js";
import { rectangle, circle } from "../src/geometry/shapes.js";
import { LinearDimension } from "../src/dimension/linearDimension.js";

const bboxNear = (path: Path, minX: number, minY: number, maxX: number, maxY: number) => {
  const b = path.boundingBox();
  expect(b.minX).toBeCloseTo(minX, 4);
  expect(b.minY).toBeCloseTo(minY, 4);
  expect(b.maxX).toBeCloseTo(maxX, 4);
  expect(b.maxY).toBeCloseTo(maxY, 4);
};

describe("importDXF — round-trips exportDXF", () => {
  it("reconstructs a rectangle (closed polyline of lines)", () => {
    const { elements } = importDXF(exportDXF([new DrawingElement(rectangle(0, 0, 10, 5))]));
    expect(elements).toHaveLength(1);
    expect(elements[0]!.path.isClosed()).toBe(true);
    bboxNear(elements[0]!.path, 0, 0, 10, 5);
  });

  it("reconstructs a circle exactly from per-vertex bulges", () => {
    const { elements } = importDXF(exportDXF([new DrawingElement(circle(5, 5, 3))]));
    expect(elements).toHaveLength(1);
    // two bulge arcs recovered → same bounding box as the original circle
    bboxNear(elements[0]!.path, 2, 2, 8, 8);
    expect(elements[0]!.path.getSegments().filter((s) => s.type === "arc")).toHaveLength(2);
  });

  it("reconstructs a partial arc", () => {
    const arc = new Path().arc({ center: { x: 0, y: 0 }, radius: 5, startAngle: 0, endAngle: Math.PI / 2, counterclockwise: true });
    const { elements } = importDXF(exportDXF([new DrawingElement(arc)]));
    bboxNear(elements[0]!.path, 0, 0, 5, 5); // quarter arc (5,0)→(0,5)
  });

  it("recovers lineStyle from the layer", () => {
    const dxf = exportDXF([
      new DrawingElement(rectangle(0, 0, 5, 5), { lineStyle: "hidden" }),
      new DrawingElement(rectangle(0, 0, 5, 5), { lineStyle: "phantom" }),
    ]);
    const styles = importDXF(dxf).elements.map((e) => e.options.lineStyle);
    expect(styles).toEqual(["hidden", "phantom"]);
  });

  it("reconstructs text with content, position, height, and justification", () => {
    const dxf = exportDXF([
      new TextElement({ x: 3, y: 7 }, "PART A", { size: 2.5 }),
      new TextElement({ x: 0, y: 0 }, "CTR", { size: 3, anchor: "middle" }),
    ]);
    const { texts } = importDXF(dxf);
    expect(texts).toHaveLength(2);
    expect(texts[0]!.content).toBe("PART A");
    expect(texts[0]!.position).toEqual({ x: 3, y: 7 });
    expect(texts[0]!.options.size).toBe(2.5);
    expect(texts[1]!.options.anchor).toBe("middle");
  });

  it("is idempotent: export → import → export reproduces the DXF byte-for-byte", () => {
    const drawing = [
      new DrawingElement(rectangle(0, 0, 20, 10)),
      new DrawingElement(circle(30, 5, 4), { lineStyle: "centerline" }),
      new TextElement({ x: 2, y: 2 }, "LABEL", { size: 3 }),
    ];
    const first = exportDXF(drawing);
    const { elements, texts } = importDXF(first);
    const second = exportDXF([...elements, ...texts]);
    expect(second).toBe(first);
  });
});

describe("importDXF — foreign DXF", () => {
  it("parses hand-written LINE/CIRCLE/ARC entities from another tool", () => {
    const dxf = [
      "0", "SECTION", "2", "ENTITIES",
      "0", "LINE", "8", "0", "10", "0", "20", "0", "11", "10", "21", "0",
      "0", "CIRCLE", "8", "0", "10", "5", "20", "5", "40", "2",
      "0", "ARC", "8", "0", "10", "0", "20", "0", "40", "3", "50", "0", "51", "90",
      "0", "ENDSEC", "0", "EOF",
    ].join("\n");
    const { elements } = importDXF(dxf);
    expect(elements).toHaveLength(3);
    bboxNear(elements[1]!.path, 3, 3, 7, 7); // circle r2 at (5,5)
    bboxNear(elements[2]!.path, 0, 0, 3, 3); // 0→90° arc r3
  });

  it("skips unsupported entity types (SPLINE) without erroring", () => {
    const dxf = [
      "0", "SECTION", "2", "ENTITIES",
      "0", "SPLINE", "8", "0", "10", "1", "20", "1",
      "0", "LINE", "8", "0", "10", "0", "20", "0", "11", "5", "21", "5",
      "0", "ENDSEC", "0", "EOF",
    ].join("\n");
    const { elements } = importDXF(dxf);
    expect(elements).toHaveLength(1); // just the LINE
  });

  it("returns empty for a DXF with no ENTITIES section", () => {
    expect(importDXF("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF")).toEqual({ elements: [], texts: [] });
  });

  it("drops native DIMENSION entities on import (export-only), keeping other geometry", () => {
    // exportDXF writes a LinearDimension as a native DIMENSION + anonymous block; importDXF reads
    // only ENTITIES and skips DIMENSION, so the dimension does not survive a round-trip.
    const dxf = exportDXF([
      new DrawingElement(rectangle(0, 0, 10, 5)),
      new LinearDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { offset: -8 }),
    ]);
    const { elements } = importDXF(dxf);
    expect(elements).toHaveLength(1); // just the rectangle; the DIMENSION is gone
  });
});
