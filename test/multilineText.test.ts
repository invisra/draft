import { describe, expect, it } from "vitest";
import { TextElement } from "../src/svg/text.js";
import { textWidth } from "../src/svg/fontMetrics.js";

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("TextElement — multi-line content", () => {
  it("renders a single line exactly as before (one <g><text>)", () => {
    const svg = new TextElement({ x: 10, y: 20 }, "HELLO", { size: 3 }).toSVG();
    expect(countOccurrences(svg, "<text")).toBe(1);
    expect(svg).toContain("translate(10 20)");
    expect(svg).toContain(">HELLO</text>");
  });

  it("splits hard \\n breaks into one <text> per line, stacked downward", () => {
    const svg = new TextElement({ x: 0, y: 30 }, "LINE 1\nLINE 2\nLINE 3", { size: 2.5, lineHeightMM: 4 }).toSVG();
    expect(countOccurrences(svg, "<text")).toBe(3);
    expect(svg).toContain("translate(0 30)"); // first line at position
    expect(svg).toContain("translate(0 26)"); // second line one lineHeight below (30 - 4)
    expect(svg).toContain("translate(0 22)"); // third line (30 - 8)
    expect(svg).toContain(">LINE 1</text>");
    expect(svg).toContain(">LINE 3</text>");
  });

  it("defaults line height to size * 1.2", () => {
    const svg = new TextElement({ x: 0, y: 10 }, "A\nB", { size: 5 }).toSVG();
    expect(svg).toContain("translate(0 10)");
    expect(svg).toContain("translate(0 4)"); // 10 - (5 * 1.2)
  });

  it("lines() splits on hard breaks", () => {
    expect(new TextElement({ x: 0, y: 0 }, "a\nb\nc").lines()).toEqual(["a", "b", "c"]);
    expect(new TextElement({ x: 0, y: 0 }, "single").lines()).toEqual(["single"]);
  });

  it("word-wraps to maxWidthMM using AFM metrics", () => {
    const text = "the quick brown fox jumps";
    const size = 3;
    // width of the whole phrase, so pick a limit that must break it into several lines
    const full = textWidth(text, "Helvetica", size);
    const el = new TextElement({ x: 0, y: 0 }, text, { size, maxWidthMM: full / 3 });
    const lines = el.lines();
    expect(lines.length).toBeGreaterThan(1);
    // every wrapped line (except a lone over-long word) fits the limit
    for (const line of lines) {
      if (line.split(" ").length > 1) expect(textWidth(line, "Helvetica", size)).toBeLessThanOrEqual(full / 3);
    }
    // no words lost or reordered
    expect(lines.join(" ")).toBe(text);
  });

  it("keeps an over-long single word whole on its own line", () => {
    const el = new TextElement({ x: 0, y: 0 }, "supercalifragilistic", { size: 3, maxWidthMM: 1 });
    expect(el.lines()).toEqual(["supercalifragilistic"]);
  });

  it("combines hard breaks with wrapping", () => {
    const el = new TextElement({ x: 0, y: 0 }, "aaa bbb ccc\nddd eee", { size: 3, maxWidthMM: textWidth("aaa bbb", "Helvetica", 3) });
    const lines = el.lines();
    // the first segment wraps, the hard break is preserved
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines).toContain("ddd eee");
  });
});

describe("TextElement — multi-line bounds", () => {
  it("boxes all lines: height grows with line count, width is the widest line", () => {
    const el = new TextElement({ x: 0, y: 20 }, "SHORT\nA MUCH LONGER LINE", { size: 3, lineHeightMM: 4, anchor: "start" });
    const b = el.bounds()!;
    expect(b).not.toBeNull();
    // widest line drives the width
    const widest = textWidth("A MUCH LONGER LINE", "Helvetica", 3);
    expect(b.maxX - b.minX).toBeCloseTo(widest, 6);
    // top at first-line + size/2, bottom at last-line - size/2
    expect(b.maxY).toBeCloseTo(20 + 1.5, 6);
    expect(b.minY).toBeCloseTo(20 - 4 - 1.5, 6); // second line baseline 16, minus size/2
  });

  it("returns null for all-empty content", () => {
    expect(new TextElement({ x: 0, y: 0 }, "").bounds()).toBeNull();
    expect(new TextElement({ x: 0, y: 0 }, "\n\n").bounds()).toBeNull();
  });

  it("centers the box under a middle anchor", () => {
    const el = new TextElement({ x: 50, y: 0 }, "ABC\nDE", { size: 3, anchor: "middle" });
    const b = el.bounds()!;
    expect((b.minX + b.maxX) / 2).toBeCloseTo(50, 6);
  });
});
