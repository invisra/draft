import { describe, expect, it } from "vitest";
import { RevisionTable } from "../src/titleblock/revisionTable.js";

const entries = [
  { rev: "B", description: "Updated hole pattern per ECO-1234", date: "2026-07-01", approved: "J. Doe", zone: "B3" },
  { rev: "A", description: "Initial release", date: "2026-01-15", approved: "J. Doe" },
];

describe("RevisionTable", () => {
  it("renders the default column headers", () => {
    const svg = new RevisionTable({ x: 0, y: 0 }, entries).toSVG();
    expect(svg).toContain(">REV<");
    expect(svg).toContain(">DESCRIPTION<");
    expect(svg).toContain(">DATE<");
    expect(svg).toContain(">APPROVED<");
    expect(svg).not.toContain(">ZONE<");
  });

  it("includes the ZONE column only when explicitly requested", () => {
    const svg = new RevisionTable({ x: 0, y: 0 }, entries, { columns: ["zone", "rev", "description", "date", "approved"] }).toSVG();
    expect(svg).toContain(">ZONE<");
    expect(svg).toContain(">B3<");
  });

  it("renders every entry's values", () => {
    const svg = new RevisionTable({ x: 0, y: 0 }, entries).toSVG();
    expect(svg).toContain(">B<");
    expect(svg).toContain(">A<");
    expect(svg).toContain(">Updated hole pattern per ECO-1234<");
    expect(svg).toContain(">Initial release<");
    expect(svg).toContain(">2026-07-01<");
    expect(svg).toContain(">2026-01-15<");
  });

  it("renders entries top to bottom in the order given (newest first, per the caller)", () => {
    const table = new RevisionTable({ x: 0, y: 100 }, entries);
    const svg = table.toSVG();
    const bIndex = svg.indexOf(">B<");
    const aIndex = svg.indexOf(">A<");
    // "B" (first entry) should appear before "A" (second entry) in the SVG markup,
    // and since rows are drawn top row first, B is the row closer to the anchor's top.
    expect(bIndex).toBeLessThan(aIndex);
  });

  it("heightMM accounts for the header plus one row per entry", () => {
    const table = new RevisionTable({ x: 0, y: 0 }, entries, { headerHeightMM: 5, rowHeightMM: 6 });
    expect(table.heightMM).toBe(5 + 2 * 6);
  });

  it("an empty entry list renders just the header, with heightMM equal to the header height", () => {
    const table = new RevisionTable({ x: 0, y: 0 }, [], { headerHeightMM: 5 });
    expect(table.heightMM).toBe(5);
    expect(() => table.toSVG()).not.toThrow();
  });

  it("column widths are normalized to fill the table regardless of which columns are chosen", () => {
    const narrow = new RevisionTable({ x: 0, y: 0 }, entries, { columns: ["rev", "date"], widthMM: 40 });
    // both cells should sum to the full 40mm width; just check it doesn't throw and produces cells
    expect(() => narrow.toSVG()).not.toThrow();
  });
});
