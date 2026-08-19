import { describe, expect, it } from "vitest";
import { renderCharacteristicSymbol, type GDTCharacteristic } from "../src/gdt/symbols.js";
import { FeatureControlFrame, CompositeFeatureControlFrame } from "../src/gdt/featureControlFrame.js";
import { DatumFeatureSymbol } from "../src/gdt/datumFeatureSymbol.js";
import { DatumTargetSymbol } from "../src/gdt/datumTarget.js";

const ALL_CHARACTERISTICS: GDTCharacteristic[] = [
  "straightness",
  "flatness",
  "circularity",
  "cylindricity",
  "profile-line",
  "profile-surface",
  "angularity",
  "perpendicularity",
  "parallelism",
  "position",
  "concentricity",
  "symmetry",
  "circular-runout",
  "total-runout",
];

describe("renderCharacteristicSymbol", () => {
  it("renders all 14 characteristics without throwing, producing non-empty SVG", () => {
    for (const c of ALL_CHARACTERISTICS) {
      const svg = renderCharacteristicSymbol(c, { x: 0, y: 0 }, 5);
      expect(svg.length).toBeGreaterThan(0);
    }
  });

  it("profile-line is open (no Z) while profile-surface is closed (has Z)", () => {
    const line = renderCharacteristicSymbol("profile-line", { x: 0, y: 0 }, 5);
    const surface = renderCharacteristicSymbol("profile-surface", { x: 0, y: 0 }, 5);
    expect(line).not.toContain("Z");
    expect(surface).toContain("Z");
  });

  it("total-runout has twice the arrowheads (filled triangles) of circular-runout", () => {
    const countFills = (svg: string) => (svg.match(/fill="black"/g) ?? []).length;
    const circular = renderCharacteristicSymbol("circular-runout", { x: 0, y: 0 }, 5);
    const total = renderCharacteristicSymbol("total-runout", { x: 0, y: 0 }, 5);
    expect(countFills(total)).toBe(countFills(circular) * 2);
  });

  it("concentricity draws two circles, circularity draws one", () => {
    const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;
    const single = renderCharacteristicSymbol("circularity", { x: 0, y: 0 }, 5);
    const double = renderCharacteristicSymbol("concentricity", { x: 0, y: 0 }, 5);
    expect(countPaths(double)).toBe(countPaths(single) * 2);
  });
});

describe("FeatureControlFrame", () => {
  it("renders the characteristic symbol and tolerance value", () => {
    const svg = new FeatureControlFrame({ x: 0, y: 0 }, "flatness", 0.05).toSVG();
    expect(svg).toContain(">0.05<");
  });

  it("prefixes the tolerance with the diameter symbol when requested", () => {
    const svg = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.1, { diameter: true }).toSVG();
    expect(svg).toContain(">⌀0.10<");
  });

  it("renders a circled M for an MMC modifier on the tolerance", () => {
    const svg = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.1, { modifier: "MMC" }).toSVG();
    expect(svg).toContain(">M<");
  });

  it("renders each datum reference letter in its own compartment", () => {
    const svg = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.1, {
      datums: [{ letter: "A" }, { letter: "B", modifier: "LMC" }, { letter: "C" }],
    }).toSVG();
    expect(svg).toContain(">A<");
    expect(svg).toContain(">B<");
    expect(svg).toContain(">C<");
    expect(svg).toContain(">L<");
  });

  it("grows wider with more datum references (more compartment dividers)", () => {
    const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;
    const zero = new FeatureControlFrame({ x: 0, y: 0 }, "flatness", 0.05).toSVG();
    const three = new FeatureControlFrame({ x: 0, y: 0 }, "flatness", 0.05, {
      datums: [{ letter: "A" }, { letter: "B" }, { letter: "C" }],
    }).toSVG();
    expect(countPaths(three)).toBeGreaterThan(countPaths(zero));
  });

  it("renders a circled P for a projected tolerance zone", () => {
    const plain = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.1, { diameter: true }).toSVG();
    const projected = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.1, { diameter: true, projectedZone: true }).toSVG();
    const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;
    expect(projected).toContain(">P<");
    // one extra <path> for the circle around the P
    expect(countPaths(projected)).toBe(countPaths(plain) + 1);
  });

  it("renders the projected height after the P, and implies the symbol", () => {
    const svg = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.14, { diameter: true, modifier: "MMC", projectedHeight: 25 }).toSVG();
    expect(svg).toContain(">⌀0.14<");
    expect(svg).toContain(">M<"); // material modifier still shown
    expect(svg).toContain(">P<"); // projected height implies the symbol
    expect(svg).toContain(">25.00<"); // the height value
  });

  it("orders the tolerance cell as value, material modifier, P, then height (left to right)", () => {
    const svg = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.14, { modifier: "MMC", projectedHeight: 25 }).toSVG();
    const at = (needle: string) => svg.indexOf(needle);
    expect(at(">0.14<")).toBeLessThan(at(">M<"));
    expect(at(">M<")).toBeLessThan(at(">P<"));
    expect(at(">P<")).toBeLessThan(at(">25.00<"));
  });

  it("renders free-state Ⓕ and tangent-plane Ⓣ modifiers", () => {
    const plain = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.1).toSVG();
    const svg = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.1, { freeState: true, tangentPlane: true }).toSVG();
    const countPaths = (s: string) => (s.match(/<path /g) ?? []).length;
    expect(svg).toContain(">F<");
    expect(svg).toContain(">T<");
    expect(countPaths(svg)).toBe(countPaths(plain) + 2); // one circle each
  });

  it("renders the unequally-disposed Ⓤ with its amount, right after the value", () => {
    const svg = new FeatureControlFrame({ x: 0, y: 0 }, "profile-surface", 0.4, { unequallyDisposedValue: 0.1 }).toSVG();
    const at = (needle: string) => svg.indexOf(needle);
    expect(svg).toContain(">U<");
    expect(svg).toContain(">0.10<");
    expect(at(">0.40<")).toBeLessThan(at(">U<"));
    expect(at(">U<")).toBeLessThan(at(">0.10<"));
  });

  it("unequallyDisposed alone shows just the Ⓤ symbol (no amount)", () => {
    const svg = new FeatureControlFrame({ x: 0, y: 0 }, "profile-surface", 0.4, { unequallyDisposed: true }).toSVG();
    expect(svg).toContain(">U<");
    expect(svg).not.toContain(">0.10<");
  });
});

describe("FeatureControlFrame — statistical tolerance", () => {
  it("adds the boxed ST statistical-tolerance symbol only when requested", () => {
    const plain = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.2, { diameter: true }).toSVG();
    const stat = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.2, { diameter: true, statistical: true }).toSVG();
    expect(plain).not.toContain(">ST<");
    expect(stat).toContain(">ST<");
  });
});

describe("CompositeFeatureControlFrame", () => {
  const boxHeight = (svg: string): number => {
    const m = /M [\d.-]+ ([\d.-]+) L [\d.-]+ [\d.-]+ L [\d.-]+ ([\d.-]+)/.exec(svg)!;
    return Math.abs(parseFloat(m[2]!) - parseFloat(m[1]!));
  };

  it("requires at least two tolerance-zone rows", () => {
    expect(() => new CompositeFeatureControlFrame({ x: 0, y: 0 }, "position", [{ toleranceValue: 0.1 }])).toThrow();
  });

  it("renders both the PLTZF and FRTZF rows' content", () => {
    const svg = new CompositeFeatureControlFrame({ x: 0, y: 0 }, "position", [
      { toleranceValue: 0.25, diameter: true, modifier: "MMC", datums: [{ letter: "A" }, { letter: "B" }, { letter: "C" }] },
      { toleranceValue: 0.1, diameter: true, modifier: "MMC", datums: [{ letter: "A" }] },
    ]).toSVG();
    expect(svg).toContain(">⌀0.25<");
    expect(svg).toContain(">⌀0.10<");
    expect(svg).toContain(">A<");
    expect(svg).toContain(">B<");
    expect(svg).toContain(">C<");
  });

  it("draws the characteristic symbol once (shared), not once per row", () => {
    const svg = new CompositeFeatureControlFrame({ x: 0, y: 0 }, "position", [
      { toleranceValue: 0.25, diameter: true, datums: [{ letter: "A" }] },
      { toleranceValue: 0.1, diameter: true, datums: [{ letter: "A" }] },
    ]).toSVG();
    // The position symbol's circle is the only arc path; if drawn per row there would be two.
    const arcPaths = (svg.match(/<path d="[^"]*A /g) ?? []).length;
    expect(arcPaths).toBe(1);
  });

  it("stacks rows vertically (three rows are 1.5× the height of two)", () => {
    const rows = [
      { toleranceValue: 0.2, datums: [{ letter: "A" }] },
      { toleranceValue: 0.1, datums: [{ letter: "A" }] },
      { toleranceValue: 0.05, datums: [{ letter: "A" }] },
    ];
    const two = new CompositeFeatureControlFrame({ x: 0, y: 0 }, "position", rows.slice(0, 2)).toSVG();
    const three = new CompositeFeatureControlFrame({ x: 0, y: 0 }, "position", rows).toSVG();
    expect(boxHeight(three)).toBeCloseTo(boxHeight(two) * 1.5, 5);
  });

  it("supports the statistical symbol on a row", () => {
    const svg = new CompositeFeatureControlFrame({ x: 0, y: 0 }, "position", [
      { toleranceValue: 0.25, diameter: true, statistical: true, datums: [{ letter: "A" }] },
      { toleranceValue: 0.1, diameter: true, datums: [{ letter: "A" }] },
    ]).toSVG();
    expect(svg).toContain(">ST<");
  });
});

describe("DatumFeatureSymbol", () => {
  it("renders the datum letter inside a box", () => {
    const svg = new DatumFeatureSymbol({ x: 0, y: 0 }, "A", { angleDeg: 90 }).toSVG();
    expect(svg).toContain(">A<");
  });

  it("the filled triangle's tip sits exactly at the touch point", () => {
    const symbol = new DatumFeatureSymbol({ x: 10, y: 20 }, "A", { angleDeg: 0 });
    const svg = symbol.toSVG();
    // triangle path starts with "M 10 20" (tip at touch point)
    expect(svg).toContain('d="M 10 20');
  });

  it("uses a filled triangle by default and an outline one when filled: false", () => {
    const trianglePath = (svg: string) => svg.split("\n")[0]!;
    const filled = new DatumFeatureSymbol({ x: 0, y: 0 }, "A", { angleDeg: 0 }).toSVG();
    const outline = new DatumFeatureSymbol({ x: 0, y: 0 }, "A", { angleDeg: 0, filled: false }).toSVG();
    expect(trianglePath(filled)).toContain('fill="black"');
    expect(trianglePath(filled)).not.toContain("stroke=");
    expect(trianglePath(outline)).toContain('fill="none"');
    expect(trianglePath(outline)).toContain('stroke="black"');
  });
});

describe("Explodable GD&T (toElements)", () => {
  // The DXF export explodes these via toElements(); toSVG() must stay derivable from the same
  // element list so the SVG and DXF renderings can never drift apart.
  it("derives toSVG() byte-for-byte from toElements() for every frame type", () => {
    const cases = [
      new FeatureControlFrame({ x: 5, y: 5 }, "position", 0.5, {
        diameter: true,
        modifier: "MMC",
        projectedHeight: 25,
        statistical: true,
        datums: [{ letter: "A" }, { letter: "B", modifier: "LMC" }, { letter: "C" }],
      }),
      new CompositeFeatureControlFrame({ x: 0, y: 0 }, "position", [
        { toleranceValue: 0.5, diameter: true, datums: [{ letter: "A" }, { letter: "B" }, { letter: "C" }] },
        { toleranceValue: 0.1, diameter: true, datums: [{ letter: "A" }] },
      ]),
      new DatumFeatureSymbol({ x: 0, y: 0 }, "A", { angleDeg: 90 }),
      new DatumTargetSymbol({ x: 0, y: 0 }, "A", 1, { angleDeg: 45, areaSize: 6 }),
    ];
    for (const c of cases) {
      const fromElements = c
        .toElements()
        .map((el) => el.toSVG())
        .join("\n");
      expect(fromElements).toBe(c.toSVG());
      expect(c.toElements().length).toBeGreaterThan(0);
    }
  });
});
