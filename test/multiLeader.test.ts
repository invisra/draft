import { describe, expect, it } from "vitest";
import { MultiLeader } from "../src/dimension/multiLeader.js";

const targets = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 20, y: 0 },
];

describe("MultiLeader", () => {
  it("renders the shared note text", () => {
    const svg = new MultiLeader(targets, "3X ⌀5 THRU", { landing: { x: 40, y: 30 } }).toSVG();
    expect(svg).toContain(">3X ⌀5 THRU<");
  });

  it("draws one leader per target, a shoulder, and one arrowhead per target", () => {
    const svg = new MultiLeader(targets, "note", { landing: { x: 40, y: 30 } }).toSVG();
    // 3 leader lines + 1 shoulder + 3 arrowheads = 7 <path> elements
    expect((svg.match(/<path/g) ?? []).length).toBe(7);
  });

  it("omits arrowheads when arrow is false", () => {
    const svg = new MultiLeader(targets, "note", { landing: { x: 40, y: 30 }, arrow: false }).toSVG();
    // 3 leader lines + 1 shoulder, no arrowheads = 4 <path> elements
    expect((svg.match(/<path/g) ?? []).length).toBe(4);
  });

  it("stacks multi-line notes", () => {
    const svg = new MultiLeader(targets, ["⌀5 THRU", "3 PLACES"], { landing: { x: 40, y: 30 } }).toSVG();
    expect(svg).toContain(">⌀5 THRU<");
    expect(svg).toContain(">3 PLACES<");
    expect((svg.match(/<text/g) ?? []).length).toBe(2);
  });

  it("runs the shoulder toward the side away from the targets by default", () => {
    // landing is right of all targets → text anchored at start (runs rightward)
    const svg = new MultiLeader(targets, "note", { landing: { x: 40, y: 30 } }).toSVG();
    expect(svg).toContain('text-anchor="start"');
  });
});
