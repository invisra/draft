import { describe, expect, it } from "vitest";
import { DetailViewCallout } from "../src/annotation/detailViewCallout.js";

describe("DetailViewCallout", () => {
  it("draws a phantom-line circle at the given center/radius", () => {
    const svg = new DetailViewCallout({ x: 10, y: 10 }, 5, { angleDeg: 45, label: "A" }).toSVG();
    // phantom dasharray, per LINE_STYLES.phantom
    expect(svg).toContain('stroke-dasharray="24,1.5,3,1.5,3,1.5"');
    expect(svg).toContain("M 15 10 A 5 5"); // circle path starting at (center.x+radius, center.y)
  });

  it('shows "DETAIL {label}" by default', () => {
    const svg = new DetailViewCallout({ x: 0, y: 0 }, 5, { angleDeg: 0, label: "B" }).toSVG();
    expect(svg).toContain(">DETAIL B<");
  });

  it("text overrides the auto-formatted label entirely", () => {
    const svg = new DetailViewCallout({ x: 0, y: 0 }, 5, { angleDeg: 0, label: "B", text: "SEE DETAIL B" }).toSVG();
    expect(svg).toContain(">SEE DETAIL B<");
    expect(svg).not.toContain(">DETAIL B<");
  });

  it("the leader's arrow touches the circle boundary in the angleDeg direction", () => {
    const svg = new DetailViewCallout({ x: 0, y: 0 }, 5, { angleDeg: 0, label: "A" }).toSVG();
    // arrowhead tip (a filled triangle) should start at the boundary point (5, 0) for angleDeg=0
    expect(svg).toMatch(/<path d="M 5 0 L [^"]+ Z" fill="black"/);
  });

  it("respects a custom color and stroke width", () => {
    const svg = new DetailViewCallout({ x: 0, y: 0 }, 5, { angleDeg: 45, label: "A", color: "blue", strokeWidthMM: 0.4 }).toSVG();
    expect(svg).toContain('stroke="blue"');
    expect(svg).toContain('stroke-width="0.4"');
  });
});
