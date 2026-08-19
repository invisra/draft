import { describe, expect, it } from "vitest";
import { parseSvgDocument, type SvgNode } from "../src/pdf/parseSvg.js";
import { DrawingElement } from "../src/svg/element.js";
import { TextElement } from "../src/svg/text.js";
import { IsometricText } from "../src/annotation/isometricText.js";
import { Layer } from "../src/svg/layer.js";
import { Sheet } from "../src/sheet/sheet.js";
import { rectangle } from "../src/geometry/shapes.js";

function only<T extends SvgNode["type"]>(nodes: SvgNode[], type: T): Extract<SvgNode, { type: T }> {
  // Sheet.toSVG() always prepends a border path, so a plain find() would grab that instead of
  // whatever the test just added — take the *last* match, since ours is always added afterward.
  const matches = nodes.filter((n): n is Extract<SvgNode, { type: T }> => n.type === type);
  const last = matches[matches.length - 1];
  if (!last) throw new Error(`no ${type} node found`);
  return last;
}

describe("parseSvgDocument", () => {
  it("parses the sheet's physical width/height in mm", () => {
    const sheet = new Sheet({ orientation: "landscape" });
    const doc = parseSvgDocument(sheet.toSVG());
    expect(doc.widthMM).toBeCloseTo(sheet.widthMM, 5);
    expect(doc.heightMM).toBeCloseTo(sheet.heightMM, 5);
  });

  it("parses a plain DrawingElement into a PathNode with fill/stroke/width", () => {
    const sheet = new Sheet();
    sheet.add(new DrawingElement(rectangle(0, 0, 10, 5), { stroke: { color: "#0066cc", width: 0.4 } }));
    const doc = parseSvgDocument(sheet.toSVG());
    const path = only(doc.children, "path");
    expect(path).toMatchObject({ type: "path", fill: "none", stroke: "#0066cc", strokeWidth: 0.4 });
    expect(path.d.startsWith("M 0 0")).toBe(true);
  });

  it("parses a dashed/capped stroke's dasharray, linecap, and linejoin", () => {
    const sheet = new Sheet();
    sheet.add(new DrawingElement(rectangle(0, 0, 10, 5), { stroke: { dasharray: [3, 1.5], linecap: "round", linejoin: "round" } }));
    const doc = parseSvgDocument(sheet.toSVG());
    const path = only(doc.children, "path");
    expect(path.dasharray).toEqual([3, 1.5]);
    expect(path.linecap).toBe("round");
    expect(path.linejoin).toBe("round");
  });

  it("parses a TextElement into a TextNode with the un-flipped position and content", () => {
    const sheet = new Sheet();
    sheet.add(new TextElement({ x: 42, y: 17 }, "HELLO", { size: 4, anchor: "middle", weight: "bold", color: "red" }));
    const doc = parseSvgDocument(sheet.toSVG());
    const text = only(doc.children, "text");
    expect(text).toMatchObject({ type: "text", x: 42, y: 17, content: "HELLO", fontSize: 4, anchor: "middle", weight: "bold", fill: "red" });
  });

  it("un-escapes XML entities in text content", () => {
    const sheet = new Sheet();
    sheet.add(new TextElement({ x: 0, y: 0 }, "A < B & C > D"));
    const doc = parseSvgDocument(sheet.toSVG());
    expect(only(doc.children, "text").content).toBe("A < B & C > D");
  });

  it("parses a matrix-wrapped (isometric) text node, keeping its linear part", () => {
    const sheet = new Sheet();
    sheet.add(new IsometricText({ x: 8, y: 3 }, "TOP", { plane: "top", size: 2.5 }));
    const doc = parseSvgDocument(sheet.toSVG());
    const text = only(doc.children, "text");
    expect(text).toMatchObject({ type: "text", x: 8, y: 3, content: "TOP", fontSize: 2.5 });
    const cos30 = Math.cos(Math.PI / 6);
    expect(text.matrix![0]).toBeCloseTo(cos30, 4);
    expect(text.matrix![1]).toBeCloseTo(-0.5, 4);
  });

  it("parses a multi-line TextElement into one TextNode per line, stacked downward", () => {
    const sheet = new Sheet();
    sheet.add(new TextElement({ x: 5, y: 40 }, "TOP\nMIDDLE\nBOTTOM", { size: 3, lineHeightMM: 5 }));
    const doc = parseSvgDocument(sheet.toSVG());
    const texts = doc.children.filter((n): n is Extract<SvgNode, { type: "text" }> => n.type === "text");
    expect(texts.map((t) => t.content)).toEqual(["TOP", "MIDDLE", "BOTTOM"]);
    expect(texts.map((t) => t.y)).toEqual([40, 35, 30]);
    expect(texts.every((t) => t.x === 5)).toBe(true);
  });

  it("parses a Layer into a LayerNode, preserving name, visibility, and nested children", () => {
    const sheet = new Sheet();
    const layer = new Layer({ name: "construction", visible: false });
    layer.add(new DrawingElement(rectangle(0, 0, 1, 1)));
    sheet.add(layer);
    const doc = parseSvgDocument(sheet.toSVG());
    const layerNode = only(doc.children, "layer");
    expect(layerNode).toMatchObject({ type: "layer", name: "construction", visible: false });
    expect(layerNode.children).toHaveLength(1);
    expect(layerNode.children[0]!.type).toBe("path");
  });

  it("parses nested layers (a Layer added to another Layer)", () => {
    const sheet = new Sheet();
    const outer = new Layer({ name: "outer" });
    const inner = new Layer({ name: "inner" });
    inner.add(new DrawingElement(rectangle(0, 0, 1, 1)));
    outer.add(inner);
    sheet.add(outer);
    const doc = parseSvgDocument(sheet.toSVG());
    const outerNode = only(doc.children, "layer");
    expect(outerNode.children[0]).toMatchObject({ type: "layer", name: "inner" });
  });

  it("throws on markup outside this library's own grammar", () => {
    expect(() => parseSvgDocument('<svg width="10mm" height="10mm"><g><circle r="5" /></g></svg>')).toThrow();
  });
});
