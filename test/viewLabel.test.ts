import { describe, expect, it } from "vitest";
import { ViewLabel, ViewArrow } from "../src/annotation/viewLabel.js";
import { View } from "../src/svg/view.js";

describe("ViewLabel", () => {
  it("renders a bold, centered title", () => {
    const svg = new ViewLabel({ x: 50, y: 10 }, "SECTION A-A").toSVG();
    expect(svg).toContain(">SECTION A-A<");
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain('text-anchor="middle"');
  });

  it("adds a smaller scale caption below the title", () => {
    const svg = new ViewLabel({ x: 0, y: 20 }, "DETAIL A", { scale: "SCALE 2:1", textSizeMM: 5 }).toSVG();
    expect(svg).toContain(">DETAIL A<");
    expect(svg).toContain(">SCALE 2:1<");
    // title at y=20; the scale caption sits below (smaller y after the Y-flip translate)
    const titleY = svg.indexOf("translate(0 20)");
    const scaleY = svg.indexOf("translate(0 13.75)"); // 20 - 5 * 1.25
    expect(titleY).toBeGreaterThanOrEqual(0);
    expect(scaleY).toBeGreaterThanOrEqual(0);
  });

  it("draws an underline rule spanning the title width when requested", () => {
    const plain = new ViewLabel({ x: 0, y: 0 }, "VIEW A").toSVG();
    const underlined = new ViewLabel({ x: 0, y: 0 }, "VIEW A", { underline: true }).toSVG();
    const countPaths = (svg: string) => (svg.match(/<path /g) ?? []).length;
    expect(countPaths(underlined)).toBe(countPaths(plain) + 1);
  });

  it("honors a custom color and text size", () => {
    const svg = new ViewLabel({ x: 0, y: 0 }, "VIEW B", { color: "red", textSizeMM: 6 }).toSVG();
    expect(svg).toContain('fill="red"');
    expect(svg).toContain('font-size="6"');
  });
});

describe("ViewArrow", () => {
  it("draws a shaft, a filled arrowhead, and a bold letter", () => {
    const svg = new ViewArrow({ x: 0, y: 0 }, { angleDeg: 0, label: "A", lengthMM: 12 }).toSVG();
    // shaft from tail (0,0) toward +X for 12mm
    expect(svg).toContain("M 0 0 L 12 0");
    // arrowhead tip (filled triangle) at the shaft tip (12, 0)
    expect(svg).toMatch(/<path d="M 12 0 L [^"]+ Z" fill="black"/);
    expect(svg).toContain(">A<");
    expect(svg).toContain('font-weight="bold"');
  });

  it("places the label behind the tail (opposite the sight direction)", () => {
    const svg = new ViewArrow({ x: 10, y: 0 }, { angleDeg: 0, label: "A", labelSizeMM: 5 }).toSVG();
    // tail at x=10, arrow points +X, so the label sits at x = 10 - 5*0.9 = 5.5
    expect(svg).toContain("translate(5.5 ");
  });

  it("maps its position through a view transform while staying paper-size", () => {
    const view = new View({ scale: 2 });
    view.add(new ViewArrow({ x: 5, y: 0 }, { angleDeg: 0, label: "A", lengthMM: 12 }));
    const svg = view.toSVG();
    // tail maps to x=10 (scaled), but the 12mm shaft stays paper-size → tip at x=22
    expect(svg).toContain("M 10 0 L 22 0");
  });
});
