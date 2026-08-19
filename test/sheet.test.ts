import { describe, expect, it } from "vitest";
import { Sheet } from "../src/sheet/sheet.js";
import { ANSI_A, A4 } from "../src/sheet/paperSizes.js";
import { TitleBlock } from "../src/titleblock/titleBlock.js";

describe("Sheet dimensions", () => {
  it("defaults to landscape ANSI A (Letter)", () => {
    const sheet = new Sheet();
    expect(sheet.widthMM).toBeCloseTo(279.4, 1);
    expect(sheet.heightMM).toBeCloseTo(215.9, 1);
  });

  it("swaps to portrait when requested", () => {
    const sheet = new Sheet({ paperSize: ANSI_A, orientation: "portrait" });
    expect(sheet.widthMM).toBeCloseTo(215.9, 1);
    expect(sheet.heightMM).toBeCloseTo(279.4, 1);
  });

  it("supports A4", () => {
    const sheet = new Sheet({ paperSize: A4, orientation: "portrait" });
    expect(sheet.widthMM).toBeCloseTo(210);
    expect(sheet.heightMM).toBeCloseTo(297);
  });
});

describe("Sheet.drawingArea", () => {
  it("shrinks by the margin on all sides with no title block", () => {
    const sheet = new Sheet({ marginMM: 10 });
    const area = sheet.drawingArea;
    expect(area.x).toBe(10);
    expect(area.y).toBe(10);
    expect(area.width).toBeCloseTo(sheet.widthMM - 20);
    expect(area.height).toBeCloseTo(sheet.heightMM - 20);
  });

  it("reserves extra height at the bottom for the title block", () => {
    const sheet = new Sheet({ marginMM: 10 });
    const titleBlock = new TitleBlock({ title: "T", drawingNumber: "1" });
    sheet.setTitleBlock(titleBlock);
    const area = sheet.drawingArea;
    expect(area.y).toBeCloseTo(10 + titleBlock.heightMM);
    expect(area.height).toBeCloseTo(sheet.heightMM - 20 - titleBlock.heightMM);
  });
});

describe("Sheet.toSVG", () => {
  it("produces a document sized in millimeters matching the sheet dimensions", () => {
    const sheet = new Sheet();
    const svg = sheet.toSVG();
    expect(svg).toContain('width="279.4mm"');
    expect(svg).toContain('height="215.9mm"');
    expect(svg).toContain('viewBox="0 0 279.4 215.9"');
  });
});
