import { describe, expect, it } from "vitest";
import { OrdinateDimension, OrdinateOrigin, ordinateDimensions } from "../src/dimension/ordinateDimension.js";
import { MM_PER_INCH } from "../src/units.js";
import { View } from "../src/svg/view.js";

const origin = { x: 0, y: 0 };

describe("OrdinateDimension", () => {
  it("reads out the X distance from the origin", () => {
    const svg = new OrdinateDimension(origin, { x: 40, y: 10 }, { axis: "x", offset: 20 }).toSVG();
    expect(svg).toContain(">40.00<");
  });

  it("reads out the Y distance from the origin", () => {
    const svg = new OrdinateDimension(origin, { x: 40, y: 25 }, { axis: "y", offset: 20 }).toSVG();
    expect(svg).toContain(">25.00<");
  });

  it("shows the origin's own value as zero", () => {
    const svg = new OrdinateDimension(origin, origin, { axis: "x", offset: 20 }).toSVG();
    expect(svg).toContain(">0.00<");
  });

  it("draws no arrowhead (no filled path), unlike a linear dimension", () => {
    const svg = new OrdinateDimension(origin, { x: 40, y: 10 }, { axis: "x", offset: 20 }).toSVG();
    // an arrowhead would be a <path> with fill="black"; text also uses fill="black", so match paths only
    expect(svg).not.toMatch(/<path[^>]*fill="black"/);
  });

  it("draws a single extension segment when straight, two when jogged", () => {
    const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;
    const straight = new OrdinateDimension(origin, { x: 40, y: 10 }, { axis: "x", offset: 20 }).toSVG();
    const jogged = new OrdinateDimension(origin, { x: 40, y: 10 }, { axis: "x", offset: 20, jog: 6 }).toSVG();
    expect(countPaths(jogged)).toBe(countPaths(straight) + 1);
  });

  it("displays the value in inches with ASME zero suppression", () => {
    const svg = new OrdinateDimension(origin, { x: 0.75 * MM_PER_INCH, y: 0 }, { axis: "x", offset: 20, unit: "in" }).toSVG();
    expect(svg).toContain(">.750<");
  });
});

describe("ordinateDimensions", () => {
  it("builds one ordinate per feature from a common origin", () => {
    const dims = ordinateDimensions(origin, [origin, { x: 20, y: 0 }, { x: 55, y: 0 }], { axis: "x", offset: 25 });
    expect(dims).toHaveLength(3);
    expect(dims[1]!.toSVG()).toContain(">20.00<");
    expect(dims[2]!.toSVG()).toContain(">55.00<");
  });
});

describe("OrdinateOrigin", () => {
  it("draws a single open (unfilled) circle centered on the datum", () => {
    const svg = new OrdinateOrigin({ x: 10, y: 20 }).toSVG();
    expect((svg.match(/<path /g) ?? []).length).toBe(1);
    expect(svg).toContain('fill="none"'); // open circle, not filled
    // default 3mm diameter → a circle passing through x = 10 ± 1.5
    expect(svg).toMatch(/M 11\.5 20/); // circle path starts at center + radius on +X
  });

  it("honors an explicit diameter, color, and stroke width", () => {
    const svg = new OrdinateOrigin({ x: 0, y: 0 }, { diameterMM: 4, color: "red", strokeWidthMM: 0.4 }).toSVG();
    expect(svg).toContain('stroke="red"');
    expect(svg).toMatch(/M 2 0/); // radius 2 for a 4mm circle
  });

  it("stays paper-size under a view scale (position scales, diameter does not)", () => {
    const view = new View({ scale: 2 });
    view.add(new OrdinateOrigin({ x: 10, y: 0 }));
    const svg = view.toSVG();
    // center maps to x = 20 (scaled), but the circle radius stays 1.5 → path starts at 21.5
    expect(svg).toMatch(/M 21\.5 0/);
  });

  it("reports paper-space bounds sized by the diameter, not the view scale", () => {
    const b = new OrdinateOrigin({ x: 10, y: 20 }, { diameterMM: 3 }).bounds()!;
    expect(b.minX).toBeCloseTo(8.5, 6);
    expect(b.maxX).toBeCloseTo(11.5, 6);
    expect(b.minY).toBeCloseTo(18.5, 6);
    expect(b.maxY).toBeCloseTo(21.5, 6);
  });
});
