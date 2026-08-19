import { describe, expect, it } from "vitest";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { RadialDimension, DiameterDimension } from "../src/dimension/radialDimension.js";
import { Callout } from "../src/dimension/callout.js";
import { arrowhead } from "../src/dimension/arrowhead.js";

function countTag(svg: string, tag: string): number {
  return (svg.match(new RegExp(`<${tag} `, "g")) ?? []).length;
}

describe("LinearDimension", () => {
  it("auto-formats the measured distance for a horizontal dimension", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 42, y: 0 }, { offset: 10 }).toSVG();
    expect(svg).toContain(">42.00<");
  });

  it("measures only the axis component for horizontal/vertical orientation, ignoring off-axis offset", () => {
    // p1 and p2 differ in y, but a horizontal dimension should report the x-distance only.
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 30, y: 12 }, { offset: 10, orientation: "horizontal" }).toSVG();
    expect(svg).toContain(">30.00<");
  });

  it("measures the full point-to-point distance for aligned orientation", () => {
    // 3-4-5 triangle
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 3, y: 4 }, { offset: 5 }).toSVG();
    expect(svg).toContain(">5.00<");
  });

  it("respects an explicit text override", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 42, y: 0 }, { offset: 10, text: "1.750 TYP" }).toSVG();
    expect(svg).toContain(">1.750 TYP<");
  });

  it("draws two extension lines, a broken dimension line, and two arrowheads", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 42, y: 0 }, { offset: 10 }).toSVG();
    // 2 extension lines + 2 dimension-line segments (broken around text) + 2 arrowhead triangles = 6 <path>
    expect(countTag(svg, "path")).toBe(6);
  });

  it("respects custom stroke width and text size", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 42, y: 0 }, { offset: 10, strokeWidthMM: 0.4, textSizeMM: 4 }).toSVG();
    expect(svg).toContain('stroke-width="0.4"');
    expect(svg).toContain('font-size="4"');
  });

  it("breakAt gaps a crossing extension line into two segments (extra path)", () => {
    const base = { offset: 10, orientation: "horizontal" as const };
    const plain = new LinearDimension({ x: 0, y: 0 }, { x: 42, y: 0 }, base).toSVG();
    // a vertical obstacle crossing the left extension line (which runs up from x≈0)
    const broken = new LinearDimension({ x: 0, y: 0 }, { x: 42, y: 0 }, {
      ...base,
      breakAt: [{ kind: "segment", p1: { x: -5, y: 5 }, p2: { x: 5, y: 5 } }],
    }).toSVG();
    expect(countTag(broken, "path")).toBe(countTag(plain, "path") + 1);
  });

  it("breakAt leaves output unchanged when no obstacle crosses", () => {
    const base = { offset: 10, orientation: "horizontal" as const };
    const plain = new LinearDimension({ x: 0, y: 0 }, { x: 42, y: 0 }, base).toSVG();
    const withFarObstacle = new LinearDimension({ x: 0, y: 0 }, { x: 42, y: 0 }, {
      ...base,
      breakAt: [{ kind: "segment", p1: { x: 100, y: 100 }, p2: { x: 110, y: 100 } }],
    }).toSVG();
    expect(withFarObstacle).toBe(plain);
  });
});

describe("RadialDimension / DiameterDimension", () => {
  it("labels the radius with an R prefix", () => {
    const svg = new RadialDimension({ x: 0, y: 0 }, 5, { angleDeg: 45 }).toSVG();
    expect(svg).toContain(">R5.00<");
  });

  it("labels the diameter with the diameter symbol and doubled value", () => {
    const svg = new DiameterDimension({ x: 0, y: 0 }, 5, { angleDeg: 45 }).toSVG();
    expect(svg).toContain(">⌀10.00<");
  });

  it("anchors leader text to the right when pointing rightward, left when pointing leftward", () => {
    const rightSvg = new RadialDimension({ x: 0, y: 0 }, 5, { angleDeg: 10 }).toSVG();
    const leftSvg = new RadialDimension({ x: 0, y: 0 }, 5, { angleDeg: 170 }).toSVG();
    expect(rightSvg).toContain('text-anchor="start"');
    expect(leftSvg).toContain('text-anchor="end"');
  });
});

describe("Callout", () => {
  it("renders arbitrary text at the end of an elbow leader", () => {
    const svg = new Callout({ x: 0, y: 0 }, "TYP 4X", { angleDeg: 30 }).toSVG();
    expect(svg).toContain(">TYP 4X<");
  });

  it("can omit the arrowhead", () => {
    const withArrow = new Callout({ x: 0, y: 0 }, "NOTE", { angleDeg: 0 }).toSVG();
    const withoutArrow = new Callout({ x: 0, y: 0 }, "NOTE", { angleDeg: 0, arrow: false }).toSVG();
    expect(countTag(withArrow, "path")).toBe(countTag(withoutArrow, "path") + 1);
  });
});

describe("arrowhead", () => {
  it("is a filled, closed triangular path with no stroke attribute", () => {
    const svg = arrowhead({ x: 10, y: 0 }, { x: 1, y: 0 }).toSVG();
    expect(svg).toContain('fill="black"');
    expect(svg).not.toContain("stroke=");
    expect(svg).toContain('Z"');
    expect(svg.trim().endsWith("/>")).toBe(true);
  });

  it("the tip sits exactly at the given point", () => {
    const el = arrowhead({ x: 10, y: 5 }, { x: 0, y: 1 }, { length: 3, width: 1 });
    const box = el.path.boundingBox();
    // pointing straight up (+y direction, tip-to-tail), so the tip is the topmost point
    expect(box.maxY).toBeCloseTo(5);
    expect(box.maxX).toBeGreaterThan(9);
    expect(box.minX).toBeLessThan(11);
  });
});
