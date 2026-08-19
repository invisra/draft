import { describe, expect, it } from "vitest";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { LINE_STYLES } from "../src/svg/lineStyles.js";
import { STANDARD_SCALES, nearestStandardScale, isStandardScale } from "../src/svg/standardScales.js";

// Arrowheads are filled <path>s (fill="black", no stroke); dimension/extension lines are fill="none".
const countArrowheads = (svg: string) => (svg.match(/<path d="[^"]*" fill="black"/g) ?? []).length;

describe("not-to-scale dimension (underlined value)", () => {
  it("underlines the value only when notToScale is set", () => {
    const plain = new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, { offset: 10 }).toSVG();
    const nts = new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, { offset: 10, notToScale: true }).toSVG();
    expect(plain).not.toContain("text-decoration");
    expect(nts).toContain('text-decoration="underline"');
  });

  it("underlines both lines of a limits display", () => {
    const nts = new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, {
      offset: 10,
      tolerance: 0.1,
      toleranceDisplay: "limits",
      notToScale: true,
    }).toSVG();
    expect((nts.match(/text-decoration="underline"/g) ?? []).length).toBe(2);
  });
});

describe("half (symmetry) dimension", () => {
  it("shows the full (doubled) value and only one arrowhead", () => {
    const full = new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, { offset: 10 }).toSVG();
    const half = new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, { offset: 10, half: true }).toSVG();
    expect(full).toContain(">20.00<");
    expect(countArrowheads(full)).toBe(2);
    // Half: p1..p2 span is 20, so the full symmetric value is 40; only the p2 arrowhead is drawn.
    expect(half).toContain(">40.00<");
    expect(countArrowheads(half)).toBe(1);
  });

  it("carries the doubled value into the native DXF dimension data", () => {
    const data = new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, { offset: 10, half: true }).dimensionData();
    expect(data.text).toContain("40");
  });
});

describe("line-style presets", () => {
  it("adds break, section, and cutting line types", () => {
    expect(LINE_STYLES.break).toBeDefined();
    expect(LINE_STYLES.section).toBeDefined();
    expect(LINE_STYLES.cutting.dasharray).toBeDefined(); // cutting plane is dashed
    expect(LINE_STYLES.break.dasharray).toBeUndefined(); // break is a thin continuous line
  });
});

describe("standard scales", () => {
  it("snaps to the nearest preferred scale in ratio space", () => {
    expect(nearestStandardScale(3)).toBe(2); // 3:1 → 2:1
    expect(nearestStandardScale(0.3)).toBe(1 / 5); // 1:3.33 → 1:5
    expect(nearestStandardScale(1.1)).toBe(1);
    expect(nearestStandardScale(11)).toBe(10);
  });

  it("recognizes exact standard scales and rejects a non-positive scale", () => {
    expect(isStandardScale(2)).toBe(true);
    expect(isStandardScale(1 / 50)).toBe(true);
    expect(isStandardScale(3)).toBe(false);
    expect(() => nearestStandardScale(0)).toThrow();
  });

  it("accepts a custom scale list (e.g. ASME 1:4)", () => {
    expect(nearestStandardScale(0.24, [1, 1 / 2, 1 / 4, 1 / 8])).toBe(1 / 4);
    expect(STANDARD_SCALES).toContain(1);
  });
});
