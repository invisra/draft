import { describe, expect, it } from "vitest";
import { axisCenterline, boltCircleCenterline } from "../src/annotation/centerline.js";
import { boltCircle } from "../src/geometry/pattern.js";

const svgOf = (els: { toSVG: () => string }[]) => els.map((e) => e.toSVG()).join("\n");
const CENTERLINE_DASH = 'stroke-dasharray="24,1.5,3,1.5"';

describe("axisCenterline", () => {
  it("draws one centerline extended past both endpoints", () => {
    const els = axisCenterline({ x: 0, y: 0 }, { x: 10, y: 0 }, { overshootMM: 3 });
    expect(els).toHaveLength(1);
    const svg = els[0]!.toSVG();
    expect(svg).toContain("M -3 0"); // extended 3mm before p1
    expect(svg).toContain("L 13 0"); // extended 3mm past p2
    expect(svg).toContain(CENTERLINE_DASH);
  });

  it("adds four solid symmetry ticks (two per end) when requested", () => {
    const els = axisCenterline({ x: 0, y: 0 }, { x: 10, y: 0 }, { symmetryTicks: true });
    expect(els).toHaveLength(5); // 1 centerline + 4 ticks
    const ticks = els.slice(1).map((e) => e.toSVG());
    // ticks are solid thin lines (no dash pattern)
    for (const t of ticks) expect(t).not.toContain("stroke-dasharray");
  });

  it("honors color and width overrides while keeping the dash pattern", () => {
    const svg = axisCenterline({ x: 0, y: 0 }, { x: 10, y: 0 }, { color: "red", strokeWidthMM: 0.35 })[0]!.toSVG();
    expect(svg).toContain('stroke="red"');
    expect(svg).toContain('stroke-width="0.35"');
    expect(svg).toContain(CENTERLINE_DASH);
  });

  it("throws when the two points coincide", () => {
    expect(() => axisCenterline({ x: 5, y: 5 }, { x: 5, y: 5 })).toThrow();
  });
});

describe("boltCircleCenterline", () => {
  it("draws the dash-dot bolt circle plus a horizontal and vertical center cross", () => {
    const els = boltCircleCenterline({ x: 0, y: 0 }, 20);
    expect(els).toHaveLength(3);
    for (const e of els) expect(e.toSVG()).toContain(CENTERLINE_DASH);
    // the center cross reaches radius + overshoot (20 + 4 = 24)
    expect(svgOf(els)).toContain("M -24 0");
  });

  it("adds a small cross at each hole center when given", () => {
    const holes = boltCircle({ x: 0, y: 0 }, 6, 20); // 6 holes
    const els = boltCircleCenterline({ x: 0, y: 0 }, 20, { holeCenters: holes });
    expect(els).toHaveLength(3 + 2 * 6); // circle + cross(2) + 2 per hole
  });

  it("throws on a non-positive radius", () => {
    expect(() => boltCircleCenterline({ x: 0, y: 0 }, 0)).toThrow();
  });
});
