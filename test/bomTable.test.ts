import { describe, expect, it } from "vitest";
import { BOMTable } from "../src/titleblock/bomTable.js";

const entries = [
  { item: 1, quantity: 1, partNumber: "HSG-100", description: "Housing, main" },
  { item: 2, quantity: 4, partNumber: "MS90725-10", description: "Bolt, hex socket" },
];

describe("BOMTable", () => {
  it("renders the default column headers", () => {
    const svg = new BOMTable({ x: 0, y: 0 }, entries).toSVG();
    expect(svg).toContain(">ITEM<");
    expect(svg).toContain(">QTY<");
    expect(svg).toContain(">PART NUMBER<");
    expect(svg).toContain(">DESCRIPTION<");
    expect(svg).not.toContain(">MATERIAL<");
  });

  it("includes the MATERIAL column only when explicitly requested", () => {
    const svg = new BOMTable({ x: 0, y: 0 }, [{ ...entries[0]!, material: "AL 6061" }], {
      columns: ["item", "quantity", "partNumber", "description", "material"],
    }).toSVG();
    expect(svg).toContain(">MATERIAL<");
    expect(svg).toContain(">AL 6061<");
  });

  it("renders every entry's values", () => {
    const svg = new BOMTable({ x: 0, y: 0 }, entries).toSVG();
    expect(svg).toContain(">1<");
    expect(svg).toContain(">HSG-100<");
    expect(svg).toContain(">Housing, main<");
    expect(svg).toContain(">4<");
    expect(svg).toContain(">MS90725-10<");
  });

  it("renders entries top to bottom in the order given", () => {
    const svg = new BOMTable({ x: 0, y: 100 }, entries).toSVG();
    expect(svg.indexOf(">HSG-100<")).toBeLessThan(svg.indexOf(">MS90725-10<"));
  });

  it("heightMM accounts for the header plus one row per entry", () => {
    const table = new BOMTable({ x: 0, y: 0 }, entries, { headerHeightMM: 5, rowHeightMM: 6 });
    expect(table.heightMM).toBe(5 + 2 * 6);
  });

  it("an empty entry list renders just the header, with heightMM equal to the header height", () => {
    const table = new BOMTable({ x: 0, y: 0 }, [], { headerHeightMM: 5 });
    expect(table.heightMM).toBe(5);
    expect(() => table.toSVG()).not.toThrow();
  });

  it("coerces numeric item/quantity values to text", () => {
    const svg = new BOMTable({ x: 0, y: 0 }, [{ item: 7, quantity: 12, description: "Washer" }]).toSVG();
    expect(svg).toContain(">7<");
    expect(svg).toContain(">12<");
  });
});
