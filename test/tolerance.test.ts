import { describe, expect, it } from "vitest";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { AngularDimension } from "../src/dimension/angularDimension.js";
import { RadialDimension, DiameterDimension } from "../src/dimension/radialDimension.js";
import { formatLimits, formatToleranceText, normalizeTolerance } from "../src/dimension/tolerance.js";

describe("normalizeTolerance", () => {
  it("expands a plain number into a symmetric plus/minus pair", () => {
    expect(normalizeTolerance(0.1)).toEqual({ plus: 0.1, minus: 0.1 });
  });

  it("passes an explicit plus/minus pair through unchanged", () => {
    expect(normalizeTolerance({ plus: 0.2, minus: 0.05 })).toEqual({ plus: 0.2, minus: 0.05 });
  });
});

describe("formatToleranceText", () => {
  it("returns the nominal text unchanged with no tolerance", () => {
    expect(formatToleranceText("80", {}, 2)).toBe("80");
  });

  it("appends a single ± suffix for a symmetric tolerance", () => {
    expect(formatToleranceText("80", { tolerance: 0.1 }, 2)).toBe("80 ±0.10");
  });

  it("appends a +/- pair for an asymmetric tolerance", () => {
    expect(formatToleranceText("80", { tolerance: { plus: 0.1, minus: 0.05 } }, 2)).toBe("80 +0.10/-0.05");
  });
});

describe("formatToleranceText: reference dimensions", () => {
  it("parenthesizes a plain nominal value", () => {
    expect(formatToleranceText("40.00", { reference: true }, 2)).toBe("(40.00)");
  });

  it("parenthesizes the whole nominal + tolerance string, not just the nominal", () => {
    expect(formatToleranceText("40.00", { reference: true, tolerance: 0.1 }, 2)).toBe("(40.00 ±0.10)");
  });
});

describe("formatToleranceText: repetition count & typical", () => {
  it("prefixes a repetition count as {n}X", () => {
    expect(formatToleranceText("⌀5.00", { count: 4 }, 2)).toBe("4X ⌀5.00");
  });

  it("keeps the count outside the tolerance", () => {
    expect(formatToleranceText("10.00", { count: 2, tolerance: 0.1 }, 2)).toBe("2X 10.00 ±0.10");
  });

  it("appends TYP for a typical dimension", () => {
    expect(formatToleranceText("R3.00", { typical: true }, 2)).toBe("R3.00 TYP");
  });

  it("wraps count outside and TYP after the reference parentheses", () => {
    expect(formatToleranceText("8.00", { count: 6, reference: true, typical: true }, 2)).toBe("6X (8.00) TYP");
  });
});

describe("formatLimits", () => {
  it("computes upper and lower limits from a symmetric tolerance", () => {
    expect(formatLimits(80, 0.1, 2)).toEqual({ upper: "80.10", lower: "79.90" });
  });

  it("computes upper and lower limits from an asymmetric tolerance", () => {
    expect(formatLimits(80, { plus: 0.1, minus: 0.05 }, 2)).toEqual({ upper: "80.10", lower: "79.95" });
  });
});

describe("LinearDimension tolerance display", () => {
  it("shows a symmetric tolerance inline next to the nominal value", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -10, orientation: "horizontal", tolerance: 0.1 }).toSVG();
    expect(svg).toContain(">80.00 ±0.10<");
  });

  it("shows stacked upper/lower limits with toleranceDisplay: limits, omitting the nominal", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, {
      offset: -10,
      orientation: "horizontal",
      tolerance: 0.1,
      toleranceDisplay: "limits",
    }).toSVG();
    expect(svg).toContain(">80.10<");
    expect(svg).toContain(">79.90<");
    expect(svg).not.toContain(">80.00<");
  });

  it("plain dimensions (no tolerance option) use fixed decimal places, matching the rest of the sheet", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -10, orientation: "horizontal" }).toSVG();
    expect(svg).toContain(">80.00<");
  });

  it("reference: parenthesizes the value", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -10, orientation: "horizontal", reference: true }).toSVG();
    expect(svg).toContain(">(80.00)<");
  });

  it("basic: draws a box (an extra rectangle path) around the value and widens the dimension-line gap to fit it", () => {
    const plain = new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -10, orientation: "horizontal" }).toSVG();
    const basic = new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -10, orientation: "horizontal", basic: true }).toSVG();
    expect(basic).toContain(">80.00<");
    const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;
    expect(countPaths(basic)).toBe(countPaths(plain) + 1); // one extra path: the box
  });
});

describe("AngularDimension tolerance display", () => {
  it("shows a symmetric tolerance inline next to the degree value", () => {
    const svg = new AngularDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { radius: 20, tolerance: 0.5 }).toSVG();
    expect(svg).toContain(">90.00° ±0.50<");
  });
});

describe("RadialDimension / DiameterDimension tolerance display", () => {
  it("appends an inline tolerance to the R label", () => {
    const svg = new RadialDimension({ x: 0, y: 0 }, 5, { angleDeg: 45, tolerance: 0.1 }).toSVG();
    expect(svg).toContain(">R5.00 ±0.10<");
  });

  it("appends an inline tolerance to the diameter label", () => {
    const svg = new DiameterDimension({ x: 0, y: 0 }, 5, { angleDeg: 45, tolerance: { plus: 0.1, minus: 0 } }).toSVG();
    expect(svg).toContain(">⌀10.00 +0.10/-0.00<");
  });

  it("reference: parenthesizes the diameter label", () => {
    const svg = new DiameterDimension({ x: 0, y: 0 }, 5, { angleDeg: 45, reference: true }).toSVG();
    expect(svg).toContain(">(⌀10.00)<");
  });

  it("basic: draws a box around the radius label", () => {
    const plain = new RadialDimension({ x: 0, y: 0 }, 5, { angleDeg: 45 }).toSVG();
    const basic = new RadialDimension({ x: 0, y: 0 }, 5, { angleDeg: 45, basic: true }).toSVG();
    const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;
    expect(basic).toContain(">R5.00<");
    expect(countPaths(basic)).toBe(countPaths(plain) + 1);
  });
});

describe("repetition count on dimension classes", () => {
  it("LinearDimension shows the count prefix", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -10, orientation: "horizontal", count: 2 }).toSVG();
    expect(svg).toContain(">2X 80.00<");
  });

  it("DiameterDimension combines count and THRU-style diameter value", () => {
    const svg = new DiameterDimension({ x: 0, y: 0 }, 2.5, { angleDeg: 45, count: 4 }).toSVG();
    expect(svg).toContain(">4X ⌀5.00<");
  });

  it("carries the count into the native DXF DIMENSION text", () => {
    const dim = new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -10, orientation: "horizontal", count: 3 });
    expect(dim.dimensionData().text).toBe("3X 80.00");
  });

  it("does not repeat the count or TYP inside a dual-unit bracket", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 50.8, y: 0 }, {
      offset: -10,
      orientation: "horizontal",
      count: 4,
      typical: true,
      dualUnit: "in",
    }).toSVG();
    // 4X and TYP appear once on the primary; the [in] bracket is the bare converted value (no repeated qualifiers)
    expect(svg).toContain(">4X 50.80 TYP [2.000]<");
  });
});

describe("spherical & square feature prefixes", () => {
  it("RadialDimension: spherical prefixes SR", () => {
    const svg = new RadialDimension({ x: 0, y: 0 }, 5, { angleDeg: 45, spherical: true }).toSVG();
    expect(svg).toContain(">SR5.00<");
  });

  it("DiameterDimension: spherical prefixes S⌀", () => {
    const svg = new DiameterDimension({ x: 0, y: 0 }, 5, { angleDeg: 45, spherical: true }).toSVG();
    expect(svg).toContain(">S⌀10.00<");
  });

  it("LinearDimension: square prefixes □ (SVG and native DXF text)", () => {
    const opts = { offset: -10, orientation: "horizontal" as const, square: true };
    expect(new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, opts).toSVG()).toContain(">□20.00<");
    expect(new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, opts).dimensionData().text).toBe("□20.00");
  });

  it("square combines with a repetition count", () => {
    const svg = new LinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, { offset: -10, orientation: "horizontal", square: true, count: 2 }).toSVG();
    expect(svg).toContain(">2X □20.00<");
  });
});
