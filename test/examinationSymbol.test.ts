import { describe, expect, it } from "vitest";
import { ExaminationSymbol } from "../src/annotation/examinationSymbol.js";

function countTag(svg: string, tag: string): number {
  return (svg.match(new RegExp(`<${tag} `, "g")) ?? []).length;
}

describe("ExaminationSymbol", () => {
  it("draws just the leader when no examination side is given", () => {
    const svg = new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90 }).toSVG();
    expect(countTag(svg, "path")).toBe(3); // leg, shoulder, arrowhead
    expect(countTag(svg, "text")).toBe(0);
  });

  it("places a single method designation with extent and count", () => {
    const svg = new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90, arrowSide: { methods: "RT", length: 250, count: 3 } }).toSVG();
    expect(svg).toContain(">RT 250<");
    expect(svg).toContain(">(3)<");
  });

  it("joins two methods on one side with a plus sign (§17.5.6)", () => {
    const svg = new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90, otherSide: { methods: ["UT", "RT"] } }).toSVG();
    expect(svg).toContain(">UT+RT<");
  });

  it("accepts a percentage extent (§17.11.4)", () => {
    const svg = new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90, centered: { methods: "MT", length: "50%" } }).toSVG();
    expect(svg).toContain(">MT 50%<");
  });

  it("places the arrow-side designation below and the other-side designation above the reference line", () => {
    const textY = (svg: string, content: string) => {
      // TextElement wraps each label in <g transform="translate(x y)">
      const m = svg.match(new RegExp(`translate\\((-?[0-9.]+) (-?[0-9.]+)\\)[^>]*><text[^>]*>${content}<`));
      return Number(m![2]);
    };
    const both = new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90, arrowSide: { methods: "PT" }, otherSide: { methods: "VT" } }).toSVG();
    // model space is Y-up: "below the line" (arrow side, PT) has a smaller y than "above the line" (other side, VT)
    expect(textY(both, "PT")).toBeLessThan(textY(both, "VT"));
  });

  it("adds an examine-all-around circle and a field-examination flag", () => {
    const base = countTag(new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90 }).toSVG(), "path");
    const allAround = countTag(new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90, allAround: true }).toSVG(), "path");
    expect(allAround).toBe(base + 1);
    const field = new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90, fieldExam: true }).toSVG();
    expect(field).toContain('fill="black"'); // the filled flag
  });

  it("draws a forked tail with a note", () => {
    const svg = new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90, arrowSide: { methods: "UT" }, tailNote: "ASME V" }).toSVG();
    expect(svg).toContain(">ASME V<");
  });

  it("draws a radiation-direction arrow with its angle (§17.4)", () => {
    const base = countTag(new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90, centered: { methods: "RT" } }).toSVG(), "path");
    const withRad = new ExaminationSymbol({ x: 0, y: 0 }, { angleDeg: -90, centered: { methods: "RT" }, radiationAngleDeg: 60 }).toSVG();
    expect(countTag(withRad, "path")).toBe(base + 2); // the shaft + the arrowhead
    expect(withRad).toContain(">60°<");
  });
});
