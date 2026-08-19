import { describe, expect, it } from "vitest";
import { GridTitleBlock } from "../src/titleblock/gridTitleBlock.js";
import { ISO7200TitleBlock } from "../src/titleblock/iso7200TitleBlock.js";
import { Sheet } from "../src/sheet/sheet.js";

describe("GridTitleBlock", () => {
  it("renders a fully custom single-column layout", () => {
    const tb = new GridTitleBlock([
      {
        widthFraction: 1,
        rows: [{ heightMM: 10, cells: [{ kind: "labeled", widthFraction: 1, label: "PROJECT", value: "Acme Widget" }] }],
      },
    ]);
    const svg = tb.render({ sheetWidthMM: 279.4, marginMM: 10 });
    expect(svg).toContain(">Acme Widget<");
    expect(tb.heightMM).toBe(10);
  });

  it("renders multiple columns side by side", () => {
    const tb = new GridTitleBlock([
      { widthFraction: 0.5, rows: [{ heightMM: 8, cells: [{ kind: "caption", widthFraction: 1, text: "LEFT" }] }] },
      { widthFraction: 0.5, rows: [{ heightMM: 8, cells: [{ kind: "caption", widthFraction: 1, text: "RIGHT" }] }] },
    ]);
    const svg = tb.render({ sheetWidthMM: 279.4, marginMM: 10 });
    expect(svg).toContain(">LEFT<");
    expect(svg).toContain(">RIGHT<");
  });

  it("works as a Sheet title block via the TitleBlockLike interface (no cast needed)", () => {
    const sheet = new Sheet();
    const tb = new GridTitleBlock([
      { widthFraction: 1, rows: [{ heightMM: 10, cells: [{ kind: "caption", widthFraction: 1, text: "CUSTOM" }] }] },
    ]);
    sheet.setTitleBlock(tb);
    expect(sheet.drawingArea.height).toBeCloseTo(sheet.heightMM - 20 - 10);
    expect(sheet.toSVG()).toContain(">CUSTOM<");
  });

  it("clamps width to fit a narrow sheet", () => {
    const tb = new GridTitleBlock([{ widthFraction: 1, rows: [{ heightMM: 5, cells: [] }] }], { widthMM: 190 });
    expect(() => tb.render({ sheetWidthMM: 150, marginMM: 10 })).not.toThrow();
  });
});

describe("ISO7200TitleBlock", () => {
  const fields = {
    title: "Apparatus Plate",
    legalOwner: "Acme Corp",
    identificationNumber: "AC-1001",
    documentType: "Detail Drawing",
    dateOfIssue: "2026-07-09",
    creator: "S. Richs",
    approvalPerson: "J. Doe",
    revisionIndex: "B",
    sheet: "1/1",
  };

  it("renders all mandatory ISO 7200 fields", () => {
    const svg = new ISO7200TitleBlock(fields).render({ sheetWidthMM: 279.4, marginMM: 10 });
    expect(svg).toContain(">Apparatus Plate<");
    expect(svg).toContain(">Acme Corp<");
    expect(svg).toContain(">AC-1001<");
    expect(svg).toContain(">Detail Drawing<");
    expect(svg).toContain(">2026-07-09<");
    expect(svg).toContain(">S. Richs<");
    expect(svg).toContain(">J. Doe<");
  });

  it("renders optional revision and sheet fields when provided", () => {
    const svg = new ISO7200TitleBlock(fields).render({ sheetWidthMM: 279.4, marginMM: 10 });
    expect(svg).toContain(">B<");
    expect(svg).toContain(">1/1<");
  });

  it("falls back to the sheet's paper size label when size is unset", () => {
    const svg = new ISO7200TitleBlock(fields).render({ sheetWidthMM: 279.4, marginMM: 10, paperSizeLabel: "A4" });
    expect(svg).toContain(">A4<");
  });

  it("defaults to 180mm width, per the standard's example layout", () => {
    const tb = new ISO7200TitleBlock(fields);
    const svg = tb.render({ sheetWidthMM: 500, marginMM: 10 });
    // right edge at 500-10=490, left edge should be at 490-180=310
    expect(svg).toContain("M 310 ");
  });

  it("is a valid Sheet title block", () => {
    const sheet = new Sheet();
    sheet.setTitleBlock(new ISO7200TitleBlock(fields));
    expect(sheet.toSVG()).toContain(">Apparatus Plate<");
  });
});
