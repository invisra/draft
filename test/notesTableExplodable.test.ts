import { describe, expect, it } from "vitest";
import { NotesBlock, FlagNote } from "../src/annotation/notesBlock.js";
import { exportDXF } from "../src/dxf/exportDXF.js";
import type { Explodable, Renderable } from "../src/svg/renderable.js";

function section(dxf: string, name: string): string {
  const start = dxf.indexOf(`2\n${name}\n`);
  const end = dxf.indexOf("0\nENDSEC\n", start);
  return dxf.slice(start, end);
}

// Batch 3: notes and data tables now back toSVG() with toElements() (the DXF export path).
describe("notes/data-table Explodable", () => {
  const cases: Array<[string, Explodable & Renderable]> = [
    ["NotesBlock", new NotesBlock({ x: 0, y: 100 }, ["First note that is long enough to wrap across the column", "Second"], { maxWidthMM: 40 })],
    ["FlagNote", new FlagNote({ x: 0, y: 0 }, 3, { shape: "pentagon" })],
  ];

  it("derives toSVG() byte-for-byte from toElements()", () => {
    for (const [name, obj] of cases) {
      const fromElements = obj
        .toElements()
        .map((el) => el.toSVG())
        .join("\n");
      expect(fromElements, name).toBe(obj.toSVG());
      expect(obj.toElements().length, name).toBeGreaterThan(0);
    }
  });

  it("exports onto the ANNOTATIONS layer with their text content", () => {
    const entities = section(exportDXF(cases.map(([, o]) => o)), "ENTITIES");
    expect(entities).toContain("0\nTEXT\n8\nANNOTATIONS\n");
    expect(entities).toContain("1\nNOTES:\n"); // notes-block heading
    expect(entities).toContain("0\nPOLYLINE\n8\nANNOTATIONS\n"); // flag polygon
  });
});
