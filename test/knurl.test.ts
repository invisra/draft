import { describe, expect, it } from "vitest";
import { knurl, knurlNote } from "../src/hatch/knurl.js";
import { rectangle } from "../src/geometry/shapes.js";

const region = () => rectangle(0, 0, 30, 12);

describe("knurl", () => {
  it("diamond draws two crossed families (more lines than a single straight family)", () => {
    const diamond = knurl(region(), { pattern: "diamond", spacingMM: 2 });
    const straight = knurl(region(), { pattern: "straight", angleDeg: 45, spacingMM: 2 });
    expect(diamond.length).toBeGreaterThan(0);
    expect(straight.length).toBeGreaterThan(0);
    // one +45 family + one -45 family ≈ double the single family
    expect(diamond.length).toBe(straight.length * 2);
  });

  it("straight draws a single family of lines", () => {
    const els = knurl(region(), { pattern: "straight" });
    expect(els.length).toBeGreaterThan(0);
    for (const e of els) expect(e.toSVG()).toContain("<path");
  });

  it("finer spacing yields more lines", () => {
    const coarse = knurl(region(), { pattern: "straight", angleDeg: 90, spacingMM: 4 });
    const fine = knurl(region(), { pattern: "straight", angleDeg: 90, spacingMM: 1 });
    expect(fine.length).toBeGreaterThan(coarse.length);
  });

  it("defaults to a diamond pattern", () => {
    const def = knurl(region()).length;
    const diamond = knurl(region(), { pattern: "diamond" }).length;
    expect(def).toBe(diamond);
  });

  it("honors color and stroke width", () => {
    const svg = knurl(region(), { color: "gray", strokeWidthMM: 0.1 })[0]!.toSVG();
    expect(svg).toContain('stroke="gray"');
    expect(svg).toContain('stroke-width="0.1"');
  });
});

describe("knurlNote", () => {
  it("formats the conventional callout note", () => {
    expect(knurlNote(0.8)).toBe("0.8 DIAMOND KNURL");
    expect(knurlNote(0.5, "straight")).toBe("0.5 STRAIGHT KNURL");
    expect(knurlNote("0.3")).toBe("0.3 DIAMOND KNURL");
  });
});
