import { describe, expect, it } from "vitest";
import { Sheet } from "../src/sheet/sheet.js";
import { Layer } from "../src/svg/layer.js";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { AngularDimension } from "../src/dimension/angularDimension.js";
import { RadialDimension } from "../src/dimension/radialDimension.js";
import { ASME_INCH, ASME_METRIC, ISO_METRIC } from "../src/dimension/standards.js";
import { mergeDimensionDefaults } from "../src/dimension/style.js";
import { MM_PER_INCH } from "../src/units.js";

const inches = (n: number) => n * MM_PER_INCH;

describe("Sheet dimensionDefaults", () => {
  it("applies a document-wide inch default to every dimension without per-call unit", () => {
    const sheet = new Sheet({ dimensionDefaults: ASME_INCH });
    sheet.add(new LinearDimension({ x: 0, y: 0 }, { x: inches(2), y: 0 }, { offset: -10, orientation: "horizontal" }));
    expect(sheet.toSVG()).toContain(">2.000<");
  });

  it("lets a per-dimension option override the document default", () => {
    const sheet = new Sheet({ dimensionDefaults: ASME_INCH });
    // this one dimension opts back into millimeters
    sheet.add(new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -10, orientation: "horizontal", unit: "mm" }));
    const svg = sheet.toSVG();
    expect(svg).toContain(">80.00<");
    expect(svg).not.toContain(">3.150<"); // would be the inch reading of 80mm
  });

  it("propagates the default through a Layer to its children", () => {
    const sheet = new Sheet({ dimensionDefaults: ASME_INCH });
    const layer = new Layer({ name: "dims" });
    layer.add(new RadialDimension({ x: 0, y: 0 }, inches(0.25), { angleDeg: 45 }));
    sheet.add(layer);
    expect(sheet.toSVG()).toContain(">R.250<");
  });

  it("does not leak the linear display unit into angular dimensions (they stay degrees)", () => {
    const sheet = new Sheet({ dimensionDefaults: ASME_INCH });
    sheet.add(new AngularDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { radius: 20 }));
    const svg = sheet.toSVG();
    expect(svg).toContain(">90.00°<"); // precision 2, not the inch-derived 3-place "90.000°"
    expect(svg).not.toContain(">90.000°<");
  });

  it("leaves output in millimeters when no default is set (unchanged legacy behavior)", () => {
    const sheet = new Sheet();
    sheet.add(new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -10, orientation: "horizontal" }));
    expect(sheet.toSVG()).toContain(">80.00<");
  });

  it("a metric profile applies ISO/ASME zero rules (trailing zeros dropped)", () => {
    const sheet = new Sheet({ dimensionDefaults: ASME_METRIC });
    sheet.add(new LinearDimension({ x: 0, y: 0 }, { x: 12.5, y: 0 }, { offset: -10, orientation: "horizontal" }));
    expect(sheet.toSVG()).toContain(">12.5<");
  });
});

describe("standard presets", () => {
  it("expose the expected style fields", () => {
    expect(ASME_INCH).toEqual({ unit: "in", zeroHandling: "inch" });
    expect(ASME_METRIC).toEqual({ unit: "mm", zeroHandling: "metric" });
    expect(ISO_METRIC).toEqual({ unit: "mm", zeroHandling: "metric" });
  });
});

describe("mergeDimensionDefaults", () => {
  it("returns options unchanged when there are no defaults", () => {
    const opts = { offset: -10, unit: "mm" as const };
    expect(mergeDimensionDefaults(opts, undefined)).toBe(opts);
  });

  it("merges defaults under options, so options win", () => {
    const merged = mergeDimensionDefaults({ offset: -10, unit: "mm" as const }, { unit: "in", textSizeMM: 4 });
    expect(merged).toEqual({ offset: -10, unit: "mm", textSizeMM: 4 });
  });
});
