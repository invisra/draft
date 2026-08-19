import { describe, expect, it } from "vitest";
import { DrawingSet } from "../src/sheet/drawingSet.js";
import { Sheet } from "../src/sheet/sheet.js";
import { TitleBlock } from "../src/titleblock/titleBlock.js";

describe("DrawingSet", () => {
  it("resolves the correct index/total/sheetLabel for each factory, in order", () => {
    const seen: { index: number; total: number; sheetLabel: string }[] = [];
    const set = new DrawingSet();
    for (let i = 0; i < 3; i++) {
      set.add((ctx) => {
        seen.push(ctx);
        return new Sheet();
      });
    }
    set.build();
    expect(seen).toEqual([
      { index: 1, total: 3, sheetLabel: "1 OF 3" },
      { index: 2, total: 3, sheetLabel: "2 OF 3" },
      { index: 3, total: 3, sheetLabel: "3 OF 3" },
    ]);
  });

  it("doesn't know the total until build() is called (solves the ordering problem)", () => {
    const set = new DrawingSet();
    set.add(({ sheetLabel }) => {
      const sheet = new Sheet();
      sheet.setTitleBlock(new TitleBlock({ title: "T", drawingNumber: "1", sheet: sheetLabel }));
      return sheet;
    });
    set.add(({ sheetLabel }) => {
      const sheet = new Sheet();
      sheet.setTitleBlock(new TitleBlock({ title: "T", drawingNumber: "1", sheet: sheetLabel }));
      return sheet;
    });
    const svgs = set.toSVGs();
    expect(svgs).toHaveLength(2);
    expect(svgs[0]).toContain(">1 OF 2<");
    expect(svgs[1]).toContain(">2 OF 2<");
  });

  it("build() and toSVGs() preserve add() order", () => {
    const set = new DrawingSet();
    set.add(() => new Sheet({ orientation: "portrait" }));
    set.add(() => new Sheet({ orientation: "landscape" }));
    const sheets = set.build();
    expect(sheets[0]!.orientation).toBe("portrait");
    expect(sheets[1]!.orientation).toBe("landscape");
  });

  it("an empty set builds an empty array without throwing", () => {
    expect(new DrawingSet().build()).toEqual([]);
    expect(new DrawingSet().toSVGs()).toEqual([]);
  });
});
