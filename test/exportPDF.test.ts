import { describe, expect, it } from "vitest";
import { exportPDF } from "../src/pdf/exportPDF.js";
import { DrawingElement } from "../src/svg/element.js";
import { TextElement } from "../src/svg/text.js";
import { Layer } from "../src/svg/layer.js";
import { View } from "../src/svg/view.js";
import { Block } from "../src/svg/block.js";
import { IsometricText } from "../src/annotation/isometricText.js";
import { Sheet } from "../src/sheet/sheet.js";
import { rectangle, circle } from "../src/geometry/shapes.js";
import { Path } from "../src/geometry/path.js";

function contentStream(pdf: string): string {
  const m = /stream\n([\s\S]*?)\nendstream/g;
  let last = "";
  for (const match of pdf.matchAll(m)) last = match[1]!;
  return last;
}

describe("exportPDF", () => {
  it("produces a file starting with the PDF header and ending with %%EOF", () => {
    const pdf = exportPDF(new Sheet());
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.endsWith("%%EOF")).toBe(true);
  });

  it("sizes the page's MediaBox to the sheet's physical size converted to points", () => {
    const sheet = new Sheet({ orientation: "landscape" }); // ANSI A landscape: 11in x 8.5in
    const pdf = exportPDF(sheet);
    expect(pdf).toContain("/MediaBox [0 0 792 612]");
  });

  it("respects an explicit widthMM/heightMM override", () => {
    const pdf = exportPDF(new Sheet(), { widthMM: 100, heightMM: 50 });
    const expectedW = (100 * 72) / 25.4;
    const expectedH = (50 * 72) / 25.4;
    expect(pdf).toContain(`/MediaBox [0 0 ${expectedW.toFixed(4).replace(/\.?0+$/, "")} ${expectedH.toFixed(4).replace(/\.?0+$/, "")}]`);
  });

  it("emits a stroke-only path with the S paint operator", () => {
    const sheet = new Sheet();
    sheet.add(new DrawingElement(rectangle(0, 0, 10, 5), { stroke: { color: "red", width: 0.5 } }));
    const stream = contentStream(exportPDF(sheet));
    expect(stream).toContain("1 0 0 RG");
    expect(stream).toContain("0.5 w");
    expect(stream).toMatch(/\bS\b/);
    expect(stream).not.toMatch(/\bB\b/);
  });

  it("emits a fill-only path (e.g. an arrowhead) with the f paint operator, no stroke state", () => {
    // Sheet.toSVG() always draws a bordered rectangle (stroked), so isolate the element just added
    // by diffing against a sheet with nothing added — same reasoning as the parseSvg tests.
    const before = contentStream(exportPDF(new Sheet()));
    const sheet = new Sheet();
    sheet.add(new DrawingElement(rectangle(0, 0, 10, 5), { fill: "black", stroke: "none" }));
    const added = contentStream(exportPDF(sheet)).slice(before.length);
    expect(added).toContain("0 0 0 rg");
    expect(added).not.toContain("RG");
    expect(added).toMatch(/\bf\b/);
  });

  it("converts a dasharray and linecap/linejoin to PDF's d/J/j operators", () => {
    const sheet = new Sheet();
    sheet.add(new DrawingElement(rectangle(0, 0, 10, 5), { stroke: { dasharray: [3, 1.5], linecap: "round", linejoin: "round" } }));
    const stream = contentStream(exportPDF(sheet));
    expect(stream).toContain("[3 1.5] 0 d");
    expect(stream).toContain("1 J");
    expect(stream).toContain("1 j");
  });

  it("converts an arc-containing path (a circle) into bezier curve operators", () => {
    const sheet = new Sheet();
    sheet.add(new DrawingElement(circle(5, 5, 3)));
    const stream = contentStream(exportPDF(sheet));
    expect(stream).toMatch(/ c\n/);
  });

  it("skips a degenerate (empty) path without emitting a painting operator for it", () => {
    const emptySheet = new Sheet();
    const before = contentStream(exportPDF(emptySheet));

    const sheet = new Sheet();
    sheet.add(new DrawingElement(new Path()));
    const after = contentStream(exportPDF(sheet));
    expect(after).toBe(before);
  });

  it("selects Helvetica-Bold for bold text and Helvetica otherwise", () => {
    const sheet = new Sheet();
    sheet.add(new TextElement({ x: 0, y: 0 }, "BOLD", { weight: "bold" }));
    sheet.add(new TextElement({ x: 0, y: 10 }, "NORMAL", { weight: "normal" }));
    const stream = contentStream(exportPDF(sheet));
    expect(stream).toContain("/F2");
    expect(stream).toContain("/F1");
  });

  it("renders isometric text with a sheared PDF text matrix (not the upright 1 0 0 1)", () => {
    const sheet = new Sheet();
    sheet.add(new IsometricText({ x: 20, y: 20 }, "TOP", { plane: "top", size: 3 }));
    const stream = contentStream(exportPDF(sheet));
    // PDF Tm linear = (right.x, right.y, up.x, up.y) = (cos30, -0.5, cos30, 0.5) for the top face
    expect(stream).toContain("0.866 -0.5 0.866 0.5 20 20 Tm");
  });

  it("shifts middle/end-anchored text left by (part of) its measured width, start-anchored text not at all", () => {
    const sheet = new Sheet();
    sheet.add(new TextElement({ x: 50, y: 0 }, "HELLO", { anchor: "start" }));
    sheet.add(new TextElement({ x: 50, y: 10 }, "HELLO", { anchor: "middle" }));
    sheet.add(new TextElement({ x: 50, y: 20 }, "HELLO", { anchor: "end" }));
    const stream = contentStream(exportPDF(sheet));
    const tmLines = [...stream.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/g)].map((m) => ({ x: parseFloat(m[1]!), y: parseFloat(m[2]!) }));
    const start = tmLines.find((p) => p.y === 0)!;
    const middle = tmLines.find((p) => p.y === 10)!;
    const end = tmLines.find((p) => p.y === 20)!;
    expect(start.x).toBe(50);
    expect(middle.x).toBeLessThan(start.x);
    expect(end.x).toBeLessThan(middle.x);
  });

  it("substitutes the Unicode drafting symbols this library uses as text for standard-font-safe equivalents", () => {
    const sheet = new Sheet();
    sheet.add(new TextElement({ x: 0, y: 0 }, "⌀8.00"));
    sheet.add(new TextElement({ x: 0, y: 10 }, "⌴14.00"));
    sheet.add(new TextElement({ x: 0, y: 20 }, "⌵9.00"));
    sheet.add(new TextElement({ x: 0, y: 30 }, "□20.00"));
    sheet.add(new TextElement({ x: 0, y: 40 }, "↧5.00"));
    const stream = contentStream(exportPDF(sheet));
    // Ø (U+00D8) is codepoint 216 = octal 330, a real WinAnsi glyph, historically used as a diameter substitute
    expect(stream).toContain("(\\3308.00) Tj");
    expect(stream).toContain("(CBORE 14.00) Tj");
    expect(stream).toContain("(CSK 9.00) Tj");
    expect(stream).toContain("(SQ 20.00) Tj");
    expect(stream).toContain("(DEEP 5.00) Tj");
    // and never the original, unrenderable-in-a-standard-font characters
    expect(stream).not.toMatch(/⌀|⌴|⌵|□|↧/);
  });

  it("maps a Layer to a real /OCG, correctly reflecting visible vs hidden state", () => {
    const sheet = new Sheet();
    const visibleLayer = new Layer({ name: "geometry" });
    visibleLayer.add(new DrawingElement(rectangle(0, 0, 1, 1)));
    const hiddenLayer = new Layer({ name: "construction", visible: false });
    hiddenLayer.add(new DrawingElement(rectangle(0, 0, 1, 1)));
    sheet.add(visibleLayer);
    sheet.add(hiddenLayer);

    const pdf = exportPDF(sheet);
    expect(pdf).toContain("/Type /OCG /Name (geometry)");
    expect(pdf).toContain("/Type /OCG /Name (construction)");
    const offMatch = /\/OFF \[(\d+) 0 R\]/.exec(pdf);
    expect(offMatch).not.toBeNull();
    // the OFF-listed object must be the "construction" OCG, not "geometry"
    const offObjBody = pdf.slice(pdf.indexOf(`${offMatch![1]} 0 obj`));
    expect(offObjBody.split("endobj")[0]).toContain("construction");
  });

  it("omits /OCProperties entirely when the sheet uses no Layers", () => {
    const sheet = new Sheet();
    sheet.add(new DrawingElement(rectangle(0, 0, 1, 1)));
    expect(exportPDF(sheet)).not.toContain("/OCProperties");
  });

  it("supports nested layers (a Layer added to another Layer)", () => {
    const sheet = new Sheet();
    const outer = new Layer({ name: "outer" });
    const inner = new Layer({ name: "inner" });
    inner.add(new DrawingElement(rectangle(0, 0, 1, 1)));
    outer.add(inner);
    sheet.add(outer);
    const pdf = exportPDF(sheet);
    expect(pdf).toContain("/Name (outer)");
    expect(pdf).toContain("/Name (inner)");
  });

  it("exports a Sheet containing a View, rendering its geometry inline (no OCG)", () => {
    const withView = new Sheet();
    withView.add(new View({ scale: 2, name: "DETAIL A" }).add(new DrawingElement(circle(0, 0, 5), { stroke: { width: 0.3 } })));
    // Regression: the <g class="view"> wrapper used to throw "parseSvg: unrecognized element".
    const pdf = exportPDF(withView);
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.endsWith("%%EOF")).toBe(true);
    // A view is not a togglable layer, so it must not create an optional-content group.
    expect(pdf).not.toContain("/OCProperties");
    // The view's circle reaches the content stream as a stroked path (bezier arcs + the S operator).
    const stream = contentStream(pdf);
    expect(stream).toContain(" c\n"); // circle arcs become native bezier ops
    expect(stream).toContain("S\n");

    // The 2:1 view enlarges the geometry: its stream differs from the same circle drawn 1:1.
    const oneToOne = new Sheet();
    oneToOne.add(new View({ scale: 1 }).add(new DrawingElement(circle(0, 0, 5), { stroke: { width: 0.3 } })));
    expect(contentStream(exportPDF(oneToOne))).not.toBe(stream);
  });

  it("exports a Sheet containing Block instances (no wrapping group, renders inline)", () => {
    const sheet = new Sheet();
    const b = new Block("mark").add(new DrawingElement(circle(0, 0, 3), { stroke: { width: 0.3 } }));
    sheet.add(b.instance({ position: { x: 20, y: 20 } }));
    sheet.add(b.instance({ position: { x: 60, y: 20 }, scale: 2 }));
    const pdf = exportPDF(sheet);
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.endsWith("%%EOF")).toBe(true);
    // both stamped copies reach the content stream as stroked paths (S = stroke paint operator)
    expect((contentStream(pdf).match(/S\n/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("renders a View nested inside a Layer", () => {
    const sheet = new Sheet();
    const layer = new Layer({ name: "views" });
    layer.add(new View({ scale: 1 }).add(new DrawingElement(rectangle(0, 0, 4, 3))));
    sheet.add(layer);
    const pdf = exportPDF(sheet);
    expect(pdf).toContain("/Name (views)");
    expect(pdf.endsWith("%%EOF")).toBe(true);
  });
});
