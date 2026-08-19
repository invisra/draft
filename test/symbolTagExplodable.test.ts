import { describe, expect, it } from "vitest";
import { ItemBalloon } from "../src/annotation/itemBalloon.js";
import { RevisionSymbol } from "../src/annotation/revisionCloud.js";
import { OrdinateOrigin } from "../src/dimension/ordinateDimension.js";
import type { Explodable, Renderable } from "../src/svg/renderable.js";

// The symbol/tag family now backs toSVG() with toElements() (the DXF export path); these guard
// that the two never drift.
describe("symbol/tag Explodable", () => {
  const cases: Array<[string, Explodable & Renderable]> = [
    ["ItemBalloon", new ItemBalloon({ x: 0, y: 0 }, 7, { angleDeg: 45 })],
    ["RevisionSymbol", new RevisionSymbol({ x: 0, y: 0 }, "B", { shape: "triangle" })],
    ["OrdinateOrigin", new OrdinateOrigin({ x: 0, y: 0 })],
  ];

  it("derives toSVG() byte-for-byte from toElements()", () => {
    for (const [name, obj] of cases) {
      const fromElements = obj
        .toElements()
        .map((el) => el.toSVG())
        .join("\n");
      expect(fromElements, name).toBe(obj.toSVG());
      expect(obj.toElements().length, name).toBeGreaterThan(0);
    }
  });
});
