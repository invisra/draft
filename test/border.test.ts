import { describe, expect, it } from "vitest";
import { renderPlainBorder, renderZonedBorder } from "../src/sheet/border.js";
import { Sheet } from "../src/sheet/sheet.js";

describe("renderPlainBorder", () => {
  it("renders a single rectangle path", () => {
    const svg = renderPlainBorder(279.4, 215.9, 10);
    expect((svg.match(/<path /g) ?? []).length).toBe(1);
  });
});

describe("renderZonedBorder", () => {
  it("includes the plain border plus numbered columns and lettered rows", () => {
    const svg = renderZonedBorder(279.4, 215.9, 10);
    expect(svg).toContain(">1<");
    expect(svg).toContain(">A<");
  });

  it("numbers columns left to right and letters rows top to bottom", () => {
    // A 300x200mm sheet with 10mm margin and 50mm target zones -> ~6 cols x 4 rows.
    const svg = renderZonedBorder(300, 200, 10);
    const matches = [...svg.matchAll(/translate\(([\d.]+) ([\d.]+)\) scale\(1,-1\)"><text[^>]*>(\d+)</g)];
    const one = matches.find((m) => m[3] === "1");
    const six = matches.find((m) => m[3] === "6");
    expect(one).toBeDefined();
    expect(six).toBeDefined();
    // zone 1 should sit to the left of zone 6 (increasing x)
    expect(Number(one![1])).toBeLessThan(Number(six![1]));
  });

  it("skips the letters I and O", () => {
    // Force enough rows to reach past H, and confirm I/O never appear as a zone label.
    const svg = renderZonedBorder(300, 900, 10, { targetZoneSizeMM: 50 });
    const letterCells = [...svg.matchAll(/>([A-Z])</g)].map((m) => m[1]);
    expect(letterCells).not.toContain("I");
    expect(letterCells).not.toContain("O");
  });

  it("throws if more row zones are requested than there are unambiguous letters", () => {
    expect(() => renderZonedBorder(300, 100000, 10, { targetZoneSizeMM: 10 })).toThrow();
  });
});

describe("Sheet borderStyle", () => {
  it("defaults to a plain border", () => {
    const svg = new Sheet().toSVG();
    expect(svg).not.toContain(">A<");
  });

  it("renders a zone grid when set to zoned", () => {
    const svg = new Sheet({ borderStyle: "zoned" }).toSVG();
    expect(svg).toContain(">A<");
    expect(svg).toContain(">1<");
  });
});
