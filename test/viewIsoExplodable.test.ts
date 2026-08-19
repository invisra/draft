import { describe, expect, it } from "vitest";
import { ViewLabel, ViewArrow } from "../src/annotation/viewLabel.js";
import { CuttingPlaneLine } from "../src/annotation/cuttingPlaneLine.js";
import { IsometricText } from "../src/annotation/isometricText.js";
import { IsometricLinearDimension } from "../src/annotation/isometricDimension.js";
import { ArcLengthDimension } from "../src/dimension/arcLengthDimension.js";
import { JoggedRadiusDimension } from "../src/dimension/joggedRadiusDimension.js";
import { exportDXF } from "../src/dxf/exportDXF.js";
import type { Explodable, Renderable, RenderContext } from "../src/svg/renderable.js";

function section(dxf: string, name: string): string {
  const start = dxf.indexOf(`2\n${name}\n`);
  const end = dxf.indexOf("0\nENDSEC\n", start);
  return dxf.slice(start, end);
}

// Batch 4: view annotations, misc dimensions, and (best-effort) isometric annotations.
describe("view/iso/misc-dim Explodable", () => {
  // These derive toSVG() from toElements() exactly (no sheared text), so guard byte-identity
  // both without and with a view transform (which must bake in identically).
  const derivable: Array<[string, Explodable & Renderable]> = [
    ["ViewLabel", new ViewLabel({ x: 0, y: 0 }, "SECTION A-A", { scale: "SCALE 2:1", underline: true })],
    ["ViewArrow", new ViewArrow({ x: 0, y: 0 }, { angleDeg: 30, label: "A" })],
    ["CuttingPlaneLine", new CuttingPlaneLine([{ x: 0, y: 0 }, { x: 20, y: 0 }], { viewDirectionDeg: 90, label: "A" })],
    ["ArcLengthDimension", new ArcLengthDimension({ x: 0, y: 0 }, 30, 0, 60, { offset: 10 })],
    ["JoggedRadiusDimension", new JoggedRadiusDimension({ x: 0, y: 0 }, { x: 40, y: 20 }, 100, {})],
  ];

  it("derives toSVG() byte-for-byte from toElements(), with and without a view transform", () => {
    const ctx: RenderContext = { transform: { scale: 2, translate: { x: 10, y: 5 }, rotation: 0 } };
    for (const [name, obj] of derivable) {
      expect(obj.toElements().map((el) => el.toSVG()).join("\n"), name).toBe(obj.toSVG());
      expect(obj.toElements(ctx).map((el) => el.toSVG()).join("\n"), `${name}+ctx`).toBe(obj.toSVG(ctx));
    }
  });

  it("isometric annotations keep sheared/obliqued text in SVG but explode to upright DXF text", () => {
    const isoText = new IsometricText({ x: 0, y: 0 }, "TOP", { plane: "top" });
    expect(isoText.toSVG()).toContain("matrix("); // obliqued onto the plane
    expect(isoText.toElements()).toHaveLength(1); // one upright TextElement for DXF

    const isoDim = new IsometricLinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, { plane: "top", offset: 8 });
    expect(isoDim.toSVG()).toContain("matrix(");
    // geometry (2 ext + dim line + 2 arrows) + 1 value text
    expect(isoDim.toElements().length).toBe(6);
  });

  it("all export onto the ANNOTATIONS layer with their text content", () => {
    const isoText = new IsometricText({ x: 0, y: 0 }, "TOP", { plane: "top" });
    const isoDim = new IsometricLinearDimension({ x: 0, y: 0 }, { x: 20, y: 0 }, { plane: "top", offset: 8 });
    const entities = section(exportDXF([...derivable.map(([, o]) => o), isoText, isoDim]), "ENTITIES");
    expect(entities).toContain("0\nTEXT\n8\nANNOTATIONS\n");
    expect(entities).toContain("1\nSECTION A-A\n");
    expect(entities).toContain("1\nTOP\n");
    expect(entities).toContain("0\nPOLYLINE\n8\nANNOTATIONS\n");
  });
});
