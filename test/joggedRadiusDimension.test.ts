import { describe, expect, it } from "vitest";
import { JoggedRadiusDimension } from "../src/dimension/joggedRadiusDimension.js";

describe("JoggedRadiusDimension", () => {
  it("labels the true (unforeshortened) radius with an R prefix", () => {
    const svg = new JoggedRadiusDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, 500, {}).toSVG();
    expect(svg).toContain("R500.00");
  });

  it("draws a zigzag jog in the leader (a 3-segment polyline)", () => {
    const svg = new JoggedRadiusDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, 500, {}).toSVG();
    // the leader path moves once then draws three line segments (arc→k1→k2→falseCenter)
    const leaderPath = svg.split("\n").find((l) => l.includes("M ") && l.includes(" L "));
    expect(leaderPath).toBeDefined();
    expect((leaderPath!.match(/ L /g) ?? []).length).toBe(3);
  });

  it("draws an arrowhead at the arc point", () => {
    const svg = new JoggedRadiusDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, 500, {}).toSVG();
    expect(svg).toContain('fill="black"'); // the solid arrowhead
  });

  it("honors the display unit", () => {
    // 500mm = 19.685 in
    const svg = new JoggedRadiusDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, 500, { unit: "in" }).toSVG();
    expect(svg).toContain("R19.685");
  });

  it("accepts a text override", () => {
    const svg = new JoggedRadiusDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, 500, { text: "R500 TYP" }).toSVG();
    expect(svg).toContain(">R500 TYP<");
  });
});
