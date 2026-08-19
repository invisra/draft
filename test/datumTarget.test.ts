import { describe, expect, it } from "vitest";
import {
  DatumTargetSymbol,
  datumTargetArea,
  datumTargetAreaOutline,
  datumTargetLine,
  datumTargetPoint,
  datumTargetRectangle,
} from "../src/gdt/datumTarget.js";
import { ellipse } from "../src/geometry/shapes.js";

function countTag(svg: string, tag: string): number {
  return (svg.match(new RegExp(`<${tag} `, "g")) ?? []).length;
}

describe("DatumTargetSymbol", () => {
  it("shows the datum letter + target number in the lower half", () => {
    const svg = new DatumTargetSymbol({ x: 0, y: 0 }, "A", 1, { angleDeg: 45 }).toSVG();
    expect(svg).toContain(">A1<");
  });

  it("leaves the upper half blank (no extra text) for a point/line target (no areaSize)", () => {
    const svg = new DatumTargetSymbol({ x: 0, y: 0 }, "A", 1, { angleDeg: 45 }).toSVG();
    expect(countTag(svg, "text")).toBe(1);
  });

  it("shows the area diameter in the upper half when areaSize is given", () => {
    const svg = new DatumTargetSymbol({ x: 0, y: 0 }, "B", 1, { angleDeg: 45, areaSize: 12 }).toSVG();
    expect(svg).toContain(">B1<");
    expect(svg).toContain(">⌀12.00<");
    expect(countTag(svg, "text")).toBe(2);
  });

  it("shows non-circular area dimensions in the upper half via areaText (overriding areaSize)", () => {
    const svg = new DatumTargetSymbol({ x: 0, y: 0 }, "C", 2, { angleDeg: 45, areaText: "10X6", areaSize: 12 }).toSVG();
    expect(svg).toContain(">C2<");
    expect(svg).toContain(">10X6<");
    expect(svg).not.toContain(">⌀12.00<"); // areaText overrides areaSize
    expect(countTag(svg, "text")).toBe(2);
  });

  it("draws a solid leader by default (near side), dashed for the far side", () => {
    const near = new DatumTargetSymbol({ x: 0, y: 0 }, "A", 1, { angleDeg: 45 }).toSVG();
    const far = new DatumTargetSymbol({ x: 0, y: 0 }, "A", 1, { angleDeg: 45, side: "far" }).toSVG();
    expect(near).not.toContain("stroke-dasharray");
    expect(far).toContain("stroke-dasharray");
  });

  it("auto-grows the circle to fit a long area-size label rather than overflowing it", () => {
    const small = new DatumTargetSymbol({ x: 0, y: 0 }, "B", 1, { angleDeg: 45, diameterMM: 8 }).toSVG();
    const withArea = new DatumTargetSymbol({ x: 0, y: 0 }, "B", 1, { angleDeg: 45, diameterMM: 8, areaSize: 123.45 }).toSVG();
    const radiusOf = (svg: string) => parseFloat(/A ([\d.]+) [\d.]+ 0 0 1/.exec(svg)![1]!);
    expect(radiusOf(withArea)).toBeGreaterThan(radiusOf(small));
  });

  it("respects a custom color and stroke width", () => {
    const svg = new DatumTargetSymbol({ x: 0, y: 0 }, "A", 1, { angleDeg: 45, color: "blue", strokeWidthMM: 0.4 }).toSVG();
    expect(svg).toContain('stroke="blue"');
    expect(svg).toContain('stroke-width="0.4"');
  });
});

describe("datumTargetPoint", () => {
  it("returns two separate line elements forming an X (Path doesn't support compound subpaths)", () => {
    const elements = datumTargetPoint({ x: 0, y: 0 });
    expect(elements).toHaveLength(2);
    for (const el of elements) {
      expect(el.path.getSegments()).toHaveLength(1);
      expect(el.path.getSegments()[0]!.type).toBe("line");
    }
  });

  it("the two diagonals actually cross (form an X, not two parallel/coincident lines)", () => {
    const [d1, d2] = datumTargetPoint({ x: 0, y: 0 }, 3);
    const s1 = d1!.path.getSegments()[0]! as { type: "line"; start: { x: number; y: number }; end: { x: number; y: number } };
    const s2 = d2!.path.getSegments()[0]! as { type: "line"; start: { x: number; y: number }; end: { x: number; y: number } };
    // one diagonal goes bottom-left to top-right, the other top-left to bottom-right
    expect(Math.sign(s1.end.x - s1.start.x)).toBe(Math.sign(s1.end.y - s1.start.y));
    expect(Math.sign(s2.end.x - s2.start.x)).not.toBe(Math.sign(s2.end.y - s2.start.y));
  });
});

describe("datumTargetLine", () => {
  it("returns X marks at both ends plus a phantom connecting line", () => {
    const elements = datumTargetLine({ x: 0, y: 0 }, { x: 20, y: 0 });
    expect(elements).toHaveLength(5); // 2 + line + 2
    const svg = elements.map((e) => e.toSVG()).join("\n");
    expect(svg).toContain("24,1.5,3,1.5,3,1.5"); // phantom dasharray, per LINE_STYLES.phantom
  });
});

describe("datumTargetArea", () => {
  it("returns hatch lines plus a phantom-line circular outline", () => {
    const elements = datumTargetArea({ x: 0, y: 0 }, 6);
    expect(elements.length).toBeGreaterThan(1);
    const svg = elements.map((e) => e.toSVG()).join("\n");
    expect(svg).toContain("24,1.5,3,1.5,3,1.5"); // the phantom outline
  });
});

describe("datumTargetRectangle", () => {
  it("returns hatch lines plus a phantom-line rectangular outline centered on the point", () => {
    const elements = datumTargetRectangle({ x: 10, y: 10 }, 8, 4);
    expect(elements.length).toBeGreaterThan(1);
    const outline = elements[elements.length - 1]!; // outline is appended last
    expect(outline.toSVG()).toContain("24,1.5,3,1.5,3,1.5"); // phantom
    // 8×4 centered on (10,10) → lower-left corner (6, 8)
    expect(outline.toSVG()).toContain("M 6 8");
  });
});

describe("datumTargetAreaOutline", () => {
  it("hatches and phantom-outlines an arbitrary closed boundary (e.g. an ellipse)", () => {
    const elements = datumTargetAreaOutline(ellipse(0, 0, 8, 4));
    expect(elements.length).toBeGreaterThan(1);
    const svg = elements.map((e) => e.toSVG()).join("\n");
    expect(svg).toContain("24,1.5,3,1.5,3,1.5"); // the phantom outline
  });
});
