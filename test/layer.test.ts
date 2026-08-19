import { describe, expect, it } from "vitest";
import { Layer } from "../src/svg/layer.js";
import { DrawingElement } from "../src/svg/element.js";
import { rectangle } from "../src/geometry/shapes.js";
import { Sheet } from "../src/sheet/sheet.js";

describe("Layer", () => {
  it("wraps its content in a named <g>", () => {
    const layer = new Layer({ name: "dimensions" });
    layer.add(new DrawingElement(rectangle(0, 0, 10, 10)));
    const svg = layer.toSVG();
    expect(svg).toContain('<g id="dimensions" class="layer" data-layer="dimensions">');
    expect(svg).toContain("<path");
    expect(svg.trim().endsWith("</g>")).toBe(true);
  });

  it("is visible by default (no display:none)", () => {
    const layer = new Layer({ name: "visible-layer" });
    expect(layer.toSVG()).not.toContain("display:none");
  });

  it("hides content via inline style when visible: false, without removing it", () => {
    const layer = new Layer({ name: "hidden-layer", visible: false });
    layer.add(new DrawingElement(rectangle(0, 0, 10, 10)));
    const svg = layer.toSVG();
    expect(svg).toContain('style="display:none"');
    expect(svg).toContain("<path"); // content still present, just hidden
  });

  it("escapes XML-sensitive characters in the layer name", () => {
    const layer = new Layer({ name: 'a & b <c>"' });
    expect(layer.toSVG()).toContain('id="a &amp; b &lt;c&gt;&quot;"');
  });

  it("nests: a Layer can contain another Layer", () => {
    const outer = new Layer({ name: "outer" });
    const inner = new Layer({ name: "inner" });
    inner.add(new DrawingElement(rectangle(0, 0, 10, 10)));
    outer.add(inner);
    const svg = outer.toSVG();
    expect(svg).toContain('id="outer"');
    expect(svg).toContain('id="inner"');
  });

  it("works when added directly to a Sheet", () => {
    const sheet = new Sheet();
    const layer = new Layer({ name: "geometry" });
    layer.add(new DrawingElement(rectangle(10, 10, 20, 20)));
    sheet.add(layer);
    const svg = sheet.toSVG();
    expect(svg).toContain('id="geometry"');
  });
});
