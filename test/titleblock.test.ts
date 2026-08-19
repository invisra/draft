import { describe, expect, it } from "vitest";
import { TitleBlock } from "../src/titleblock/titleBlock.js";

describe("TitleBlock.render", () => {
  it("includes provided field values as text content", () => {
    const titleBlock = new TitleBlock({
      title: "WIDGET",
      drawingNumber: "DWG-42",
      revision: "B",
      scale: "2:1",
    });
    const svg = titleBlock.render({ sheetWidthMM: 279.4, marginMM: 10 });
    expect(svg).toContain(">WIDGET<");
    expect(svg).toContain(">DWG-42<");
    expect(svg).toContain(">B<");
    expect(svg).toContain(">2:1<");
  });

  it("omits value text for unset optional fields without throwing", () => {
    const titleBlock = new TitleBlock({ title: "T", drawingNumber: "1" });
    expect(() => titleBlock.render({ sheetWidthMM: 279.4, marginMM: 10 })).not.toThrow();
  });

  it("escapes XML-sensitive characters in field values", () => {
    const titleBlock = new TitleBlock({ title: "A & B <C>", drawingNumber: "1" });
    const svg = titleBlock.render({ sheetWidthMM: 279.4, marginMM: 10 });
    expect(svg).toContain("A &amp; B &lt;C&gt;");
  });

  it("falls back to the sheet's paper size label when fields.size is unset", () => {
    const titleBlock = new TitleBlock({ title: "T", drawingNumber: "1" });
    const svg = titleBlock.render({ sheetWidthMM: 279.4, marginMM: 10, paperSizeLabel: "A" });
    expect(svg).toContain(">A<");
  });

  it("prefers an explicit fields.size over the paper size label", () => {
    const titleBlock = new TitleBlock({ title: "T", drawingNumber: "1", size: "B" });
    const svg = titleBlock.render({ sheetWidthMM: 279.4, marginMM: 10, paperSizeLabel: "A" });
    expect(svg).toContain(">B<");
    expect(svg).not.toContain(">A<");
  });

  it("renders general tolerance lines and material/finish text", () => {
    const titleBlock = new TitleBlock({
      title: "T",
      drawingNumber: "1",
      material: "AL 6061",
      finish: "ANODIZE",
      generalTolerance: ["X.XX = ±0.01"],
    });
    const svg = titleBlock.render({ sheetWidthMM: 279.4, marginMM: 10 });
    expect(svg).toContain(">AL 6061<");
    expect(svg).toContain(">ANODIZE<");
    expect(svg).toContain(">X.XX = ±0.01<");
  });

  it("draws a projection symbol (extra path elements) only when fields.projection is set", () => {
    const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;
    const withSymbol = new TitleBlock({ title: "T", drawingNumber: "1", projection: "third-angle" }).render({
      sheetWidthMM: 279.4,
      marginMM: 10,
    });
    const withoutSymbol = new TitleBlock({ title: "T", drawingNumber: "1" }).render({ sheetWidthMM: 279.4, marginMM: 10 });
    // the symbol adds 2 circles + 1 trapezoid, all rendered as <path> elements
    expect(countPaths(withSymbol)).toBe(countPaths(withoutSymbol) + 3);
  });

  it("clamps its width to fit a narrower sheet without throwing", () => {
    const titleBlock = new TitleBlock({ title: "T", drawingNumber: "1" }, { widthMM: 190 });
    expect(() => titleBlock.render({ sheetWidthMM: 150, marginMM: 10 })).not.toThrow();
  });

  it("derives render() byte-for-byte from renderElements() (the DXF export path)", () => {
    // render() joins the same element list the DXF exporter explodes, so SVG and DXF can't drift.
    const titleBlock = new TitleBlock({
      title: "WIDGET",
      drawingNumber: "DWG-42",
      revision: "B",
      scale: "2:1",
      material: "AL 6061",
      generalTolerance: ["X.XX = ±0.01", "ANGLES = ±0.5°"],
      projection: "third-angle",
      drawnBy: "AB",
      drawnDate: "2026-01-01",
    });
    const ctx = { sheetWidthMM: 279.4, marginMM: 10, paperSizeLabel: "A" };
    const fromElements = titleBlock
      .renderElements(ctx)
      .map((el) => el.toSVG())
      .join("\n");
    expect(fromElements).toBe(titleBlock.render(ctx));
    expect(titleBlock.renderElements(ctx).length).toBeGreaterThan(0);
  });
});
