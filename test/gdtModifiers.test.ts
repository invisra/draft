import { describe, expect, it } from "vitest";
import { FeatureControlFrame, MultipleSingleSegmentFrame } from "../src/gdt/featureControlFrame.js";
import { allAroundSymbol, allOverSymbol, betweenSymbol, continuousFeatureNote } from "../src/gdt/modifierSymbols.js";

const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;
const countArcs = (svg: string) => (svg.match(/<path d="[^"]*A /g) ?? []).length;
const countFills = (svg: string) => (svg.match(/fill="black"/g) ?? []).length;

describe("datum translation modifier ▷", () => {
  it("adds a triangle (one extra closed path) after the datum letter", () => {
    const plain = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.1, { diameter: true, datums: [{ letter: "A" }] }).toSVG();
    const translated = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.1, {
      diameter: true,
      datums: [{ letter: "A", translation: true }],
    }).toSVG();
    expect(countPaths(translated)).toBe(countPaths(plain) + 1);
    expect(translated).toContain(">A<"); // letter still there
  });

  it("places the triangle after the datum letter and its material modifier", () => {
    const svg = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.1, {
      datums: [{ letter: "A", modifier: "MMC", translation: true }],
    }).toSVG();
    expect(svg).toContain(">A<");
    expect(svg).toContain(">M<");
  });
});

describe("MultipleSingleSegmentFrame", () => {
  it("requires at least two rows", () => {
    expect(() => new MultipleSingleSegmentFrame({ x: 0, y: 0 }, [{ characteristic: "position", toleranceValue: 0.1 }])).toThrow();
  });

  it("repeats the characteristic symbol once per row (unlike the composite frame)", () => {
    const svg = new MultipleSingleSegmentFrame({ x: 0, y: 0 }, [
      { characteristic: "position", toleranceValue: 0.25, diameter: true, datums: [{ letter: "A" }, { letter: "B" }, { letter: "C" }] },
      { characteristic: "position", toleranceValue: 0.1, diameter: true, datums: [{ letter: "A" }] },
    ]).toSVG();
    // Two position symbols → two arc paths (the composite frame draws only one).
    expect(countArcs(svg)).toBe(2);
    expect(svg).toContain(">⌀0.25<");
    expect(svg).toContain(">⌀0.10<");
  });

  it("allows different characteristics per row", () => {
    const svg = new MultipleSingleSegmentFrame({ x: 0, y: 0 }, [
      { characteristic: "position", toleranceValue: 0.2, diameter: true, datums: [{ letter: "A" }, { letter: "B" }] },
      { characteristic: "perpendicularity", toleranceValue: 0.05, datums: [{ letter: "A" }] },
    ]).toSVG();
    expect(svg).toContain(">⌀0.20<");
    expect(svg).toContain(">0.05<");
  });

  it("stacks rows vertically (three rows are 1.5× the height of two)", () => {
    const boxHeight = (svg: string): number => {
      const m = /M [\d.-]+ ([\d.-]+) L [\d.-]+ [\d.-]+ L [\d.-]+ ([\d.-]+)/.exec(svg)!;
      return Math.abs(parseFloat(m[2]!) - parseFloat(m[1]!));
    };
    const rows = [
      { characteristic: "position" as const, toleranceValue: 0.2, datums: [{ letter: "A" }] },
      { characteristic: "position" as const, toleranceValue: 0.1, datums: [{ letter: "A" }] },
      { characteristic: "position" as const, toleranceValue: 0.05, datums: [{ letter: "A" }] },
    ];
    const two = new MultipleSingleSegmentFrame({ x: 0, y: 0 }, rows.slice(0, 2)).toSVG();
    const three = new MultipleSingleSegmentFrame({ x: 0, y: 0 }, rows).toSVG();
    expect(boxHeight(three)).toBeCloseTo(boxHeight(two) * 1.5, 5);
  });

  it("derives toSVG() byte-for-byte from toElements()", () => {
    const frame = new MultipleSingleSegmentFrame({ x: 5, y: 5 }, [
      { characteristic: "position", toleranceValue: 0.5, diameter: true, datums: [{ letter: "A", translation: true }, { letter: "B" }] },
      { characteristic: "position", toleranceValue: 0.1, diameter: true, datums: [{ letter: "A" }] },
    ]);
    const fromElements = frame
      .toElements()
      .map((el) => el.toSVG())
      .join("\n");
    expect(fromElements).toBe(frame.toSVG());
    expect(frame.toElements().length).toBeGreaterThan(0);
  });
});

describe("all-around / all-over symbols", () => {
  it("all-around is a single circle at the junction", () => {
    const svg = allAroundSymbol({ x: 10, y: 20 }, { sizeMM: 4 })
      .map((e) => e.toSVG())
      .join("\n");
    expect(countPaths(svg)).toBe(1);
  });

  it("all-over is two concentric circles", () => {
    const svg = allOverSymbol({ x: 10, y: 20 })
      .map((e) => e.toSVG())
      .join("\n");
    expect(countPaths(svg)).toBe(2);
  });
});

describe("between symbol ↔", () => {
  it("draws a line with an arrowhead at each end", () => {
    const svg = betweenSymbol({ x: 0, y: 0 }, { x: 20, y: 0 })
      .map((e) => e.toSVG())
      .join("\n");
    expect(countFills(svg)).toBe(2); // two filled arrowheads
  });

  it("places the endpoint labels when provided", () => {
    const svg = betweenSymbol({ x: 0, y: 0 }, { x: 20, y: 0 }, { fromLabel: "X", toLabel: "Y" })
      .map((e) => e.toSVG())
      .join("\n");
    expect(svg).toContain(">X<");
    expect(svg).toContain(">Y<");
  });

  it("throws when the two points coincide", () => {
    expect(() => betweenSymbol({ x: 1, y: 1 }, { x: 1, y: 1 })).toThrow();
  });
});

describe("continuous-feature note", () => {
  it("renders the CF abbreviation", () => {
    const svg = continuousFeatureNote({ x: 0, y: 0 })
      .map((e) => e.toSVG())
      .join("\n");
    expect(svg).toContain(">CF<");
  });
});
