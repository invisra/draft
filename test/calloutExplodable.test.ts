import { describe, expect, it } from "vitest";
import { Callout } from "../src/dimension/callout.js";
import { MultiLeader } from "../src/dimension/multiLeader.js";
import { DetailViewCallout } from "../src/annotation/detailViewCallout.js";
import type { Explodable, Renderable } from "../src/svg/renderable.js";

// Every callout/leader now backs its toSVG() with toElements() (the DXF export path). These guard
// that the two never drift: the joined element SVG must equal toSVG() byte-for-byte, with and
// without a view transform (which must be baked identically into both paths).
describe("callout/leader Explodable", () => {
  const withoutCtx: Array<[string, Explodable & Renderable]> = [
    ["Callout", new Callout({ x: 3, y: 7 }, "TYP 4X", { angleDeg: 45 })],
    ["MultiLeader", new MultiLeader([{ x: 0, y: 0 }, { x: 5, y: 2 }], ["4X", "THRU"], { landing: { x: 20, y: 20 } })],
    ["DetailViewCallout", new DetailViewCallout({ x: 0, y: 0 }, 10, { angleDeg: 45, label: "A" })],
  ];

  it("derives toSVG() byte-for-byte from toElements() (no context)", () => {
    for (const [name, obj] of withoutCtx) {
      const fromElements = obj
        .toElements()
        .map((el) => el.toSVG())
        .join("\n");
      expect(fromElements, name).toBe(obj.toSVG());
      expect(obj.toElements().length, name).toBeGreaterThan(0);
    }
  });

  it("bakes an active view transform into toElements() identically to toSVG(context)", () => {
    const ctx = { transform: { scale: 2, translate: { x: 100, y: 50 }, rotation: 0 } };
    // DetailViewCallout ignores context by design; the rest are view-aware.
    const viewAware = withoutCtx.filter(([name]) => name !== "DetailViewCallout");
    for (const [name, obj] of viewAware) {
      const fromElements = obj
        .toElements(ctx)
        .map((el) => el.toSVG())
        .join("\n");
      expect(fromElements, name).toBe(obj.toSVG(ctx));
    }
  });
});
