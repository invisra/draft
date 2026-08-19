import { describe, expect, it } from "vitest";
import { NotesBlock, FlagNote } from "../src/annotation/notesBlock.js";

const anchor = { x: 10, y: 100 };

describe("NotesBlock", () => {
  it("renders a bold NOTES heading and numbered entries by default", () => {
    const svg = new NotesBlock(anchor, ["INTERPRET PER ASME Y14.5-2018.", "REMOVE ALL BURRS."]).toSVG();
    expect(svg).toContain("NOTES:");
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain(">1.<");
    expect(svg).toContain(">2.<");
    expect(svg).toContain(">INTERPRET PER ASME Y14.5-2018.<");
    expect(svg).toContain(">REMOVE ALL BURRS.<");
  });

  it("computes heightMM from the heading plus one line per (unwrapped) note", () => {
    const block = new NotesBlock(anchor, ["A", "B", "C"], { textSizeMM: 2.5, lineSpacingMM: 4 });
    // heading + 3 notes = 4 lines * 4mm
    expect(block.heightMM).toBe(16);
  });

  it("wraps long notes to maxWidthMM, increasing the height", () => {
    const long = "THIS IS A DELIBERATELY LONG GENERAL NOTE THAT SHOULD WRAP ACROSS SEVERAL LINES WHEN CONSTRAINED.";
    const narrow = new NotesBlock(anchor, [long], { maxWidthMM: 40, lineSpacingMM: 4, heading: "" });
    const wide = new NotesBlock(anchor, [long], { lineSpacingMM: 4, heading: "" });
    expect(narrow.heightMM).toBeGreaterThan(wide.heightMM);
    expect(wide.heightMM).toBe(4); // single line, no heading
  });

  it("omits the heading when it is empty and drops number prefixes when unnumbered", () => {
    const svg = new NotesBlock(anchor, ["FIRST", "SECOND"], { heading: "", numbered: false }).toSVG();
    expect(svg).not.toContain("NOTES:");
    expect(svg).not.toContain(">1.<");
    expect(svg).toContain(">FIRST<");
  });

  it("honors a custom starting number", () => {
    const svg = new NotesBlock(anchor, ["X"], { startNumber: 5 }).toSVG();
    expect(svg).toContain(">5.<");
  });
});

describe("FlagNote", () => {
  it("draws a triangle (closed 3-sided path) with the note number centered", () => {
    const svg = new FlagNote({ x: 0, y: 0 }, 3).toSVG();
    // a closed N-gon serializes to M + N line commands (close() emits the final L back to start) + Z
    const d = /<path d="([^"]+)"/.exec(svg)?.[1] ?? "";
    expect((d.match(/L /g) ?? []).length).toBe(3);
    expect(d.trim().endsWith("Z")).toBe(true);
    expect(svg).toContain(">3<");
    expect(svg).toContain('text-anchor="middle"');
  });

  it("supports a pentagon (5 sides)", () => {
    const svg = new FlagNote({ x: 0, y: 0 }, 7, { shape: "pentagon" }).toSVG();
    const d = /<path d="([^"]+)"/.exec(svg)?.[1] ?? "";
    expect((d.match(/L /g) ?? []).length).toBe(5);
    expect(svg).toContain(">7<");
  });
});
