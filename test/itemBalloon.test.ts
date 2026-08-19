import { describe, expect, it } from "vitest";
import { ItemBalloon } from "../src/annotation/itemBalloon.js";

function countTag(svg: string, tag: string): number {
  return (svg.match(new RegExp(`<${tag} `, "g")) ?? []).length;
}

describe("ItemBalloon", () => {
  it("shows the item number inside a circle", () => {
    const svg = new ItemBalloon({ x: 0, y: 0 }, 3, { angleDeg: 45 }).toSVG();
    expect(svg).toContain(">3<");
    expect(svg).toMatch(/<path d="M [\d.-]+ [\d.-]+ A [\d.]+ [\d.]+/); // at least one arc-based (circle) path: the balloon
  });

  it("accepts a string item number too", () => {
    const svg = new ItemBalloon({ x: 0, y: 0 }, "3A", { angleDeg: 45 }).toSVG();
    expect(svg).toContain(">3A<");
  });

  it('defaults to a "dot" terminus: a small filled circle at the touch point, no arrowhead', () => {
    const svg = new ItemBalloon({ x: 10, y: 10 }, 1, { angleDeg: 0 }).toSVG();
    const filledPaths = [...svg.matchAll(/<path d="([^"]+)" fill="black" \/>/g)];
    // exactly one small filled shape: the dot (the balloon circle itself is unfilled/stroked, not "black" fill)
    expect(filledPaths.length).toBe(1);
  });

  it('"arrow" terminus draws a filled arrowhead (a 3-point triangle) instead of a dot', () => {
    const dotSvg = new ItemBalloon({ x: 10, y: 10 }, 1, { angleDeg: 0, terminus: "dot" }).toSVG();
    const arrowSvg = new ItemBalloon({ x: 10, y: 10 }, 1, { angleDeg: 0, terminus: "arrow" }).toSVG();
    expect(countTag(dotSvg, "path")).toBe(countTag(arrowSvg, "path")); // dot circle vs arrow triangle: same path count
    expect(arrowSvg).toContain(" Z\" fill=\"black\""); // arrowhead is a closed (Z) filled triangle
  });

  it("the balloon circle sits at the end of the leader's horizontal shoulder", () => {
    const svg = new ItemBalloon({ x: 0, y: 0 }, 1, { angleDeg: 0, leaderLengthMM: 8, elbowLengthMM: 4, radiusMM: 3 }).toSVG();
    // shoulder runs rightward (angleDeg 0 -> shoulderSign +1) from elbow (8,0) to shoulderEnd (12,0);
    // circle center should be further right by radiusMM: (12+3, 0) = (15, 0)
    expect(svg).toContain("M 18 0 A 3 3");
  });

  it("respects a custom color", () => {
    const svg = new ItemBalloon({ x: 0, y: 0 }, 1, { angleDeg: 45, color: "blue" }).toSVG();
    expect(svg).toContain('stroke="blue"');
    expect(svg).toContain('fill="blue"');
  });
});
