import { describe, expect, it } from "vitest";
import { CuttingPlaneLine } from "../src/annotation/cuttingPlaneLine.js";

describe("CuttingPlaneLine", () => {
  it("draws a thick (0.6mm default) dashed line through the given points", () => {
    const svg = new CuttingPlaneLine([{ x: 0, y: 0 }, { x: 40, y: 0 }], { viewDirectionDeg: 90 }).toSVG();
    expect(svg).toContain('stroke-width="0.6"');
    expect(svg).toContain("stroke-dasharray=");
  });

  it("supports an offset/stepped section via more than 2 points", () => {
    const svg = new CuttingPlaneLine([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 15 }, { x: 40, y: 15 }], {
      viewDirectionDeg: 90,
    }).toSVG();
    expect(svg).toContain("M 0 0 L 20 0 L 20 15 L 40 15");
  });

  it("both end arrows point in the same view direction", () => {
    const svg = new CuttingPlaneLine([{ x: 0, y: 0 }, { x: 40, y: 0 }], { viewDirectionDeg: 90, legLengthMM: 6 }).toSVG();
    // arrow legs run from each endpoint straight up (viewDirectionDeg=90 => +Y): "M 0 0 L 0 6" and "M 40 0 L 40 6"
    expect(svg).toContain("M 0 0 L 0 6");
    expect(svg).toContain("M 40 0 L 40 6");
  });

  it("renders the label at both ends when provided", () => {
    const svg = new CuttingPlaneLine([{ x: 0, y: 0 }, { x: 40, y: 0 }], { viewDirectionDeg: 90, label: "A" }).toSVG();
    expect((svg.match(/>A</g) ?? []).length).toBe(2);
  });

  it("omits labels when not provided", () => {
    const svg = new CuttingPlaneLine([{ x: 0, y: 0 }, { x: 40, y: 0 }], { viewDirectionDeg: 90 }).toSVG();
    expect(svg).not.toContain('font-weight="bold"');
  });

  it("throws with fewer than 2 points", () => {
    expect(() => new CuttingPlaneLine([{ x: 0, y: 0 }], { viewDirectionDeg: 90 })).toThrow();
  });
});
