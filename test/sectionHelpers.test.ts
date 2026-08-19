import { describe, expect, it } from "vitest";
import { rectangle } from "../src/geometry/shapes.js";
import { halfSection, revolvedSection, removedSection } from "../src/annotation/sectionHelpers.js";

describe("halfSection", () => {
  it("hatches one side and returns an axis centerline along the cut", () => {
    const boundary = rectangle(0, 0, 20, 10);
    const result = halfSection(boundary, { p1: { x: 10, y: -5 }, p2: { x: 10, y: 15 }, keep: "left" });
    expect(result.hatch.length).toBeGreaterThan(0);
    expect(result.centerline).toHaveLength(1);
    // The centerline is drawn with the dashed centerline preset.
    expect(result.centerline[0]!.toSVG()).toContain("stroke-dasharray");
  });

  it("hatches less than a full section of the same region", () => {
    const boundary = rectangle(0, 0, 20, 10);
    const full = revolvedSection(boundary, { spacingMM: 2 }); // full region, same spacing
    const half = halfSection(boundary, { p1: { x: 10, y: -5 }, p2: { x: 10, y: 15 }, keep: "left" }, { spacingMM: 2 });
    expect(half.hatch.length).toBeLessThan(full.hatch.length);
  });
});

describe("revolvedSection", () => {
  it("uses a thin (0.25mm) visible outline by default", () => {
    const result = revolvedSection(rectangle(0, 0, 6, 6));
    expect(result.outline.length).toBeGreaterThan(0);
    expect(result.outline[0]!.toSVG()).toContain('stroke-width="0.25"');
  });

  it("still lets the caller override the outline weight", () => {
    const result = revolvedSection(rectangle(0, 0, 6, 6), { outlineStrokeWidthMM: 0.5 });
    expect(result.outline[0]!.toSVG()).toContain('stroke-width="0.5"');
  });
});

describe("removedSection", () => {
  it("adds a centered SECTION title beneath the profile when labeled", () => {
    const result = removedSection(rectangle(0, 0, 10, 8), { label: "SECTION A-A" });
    expect(result.label).toBeDefined();
    expect(result.label!.toSVG()).toContain("SECTION A-A");
  });

  it("omits the label when none is given", () => {
    const result = removedSection(rectangle(0, 0, 10, 8));
    expect(result.label).toBeUndefined();
    expect(result.hatch.length).toBeGreaterThan(0);
  });
});
