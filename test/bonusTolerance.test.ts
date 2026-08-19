import { describe, expect, it } from "vitest";
import { bonusTolerance, totalToleranceAt, virtualCondition, type FeatureToleranceInput } from "../src/gdt/bonusTolerance.js";

describe("bonusTolerance & virtualCondition", () => {
  const hole: FeatureToleranceInput = { featureType: "internal", minSize: 10.0, maxSize: 10.5, geometricTolerance: 0.2, modifier: "MMC" };
  const shaft: FeatureToleranceInput = { featureType: "external", minSize: 9.5, maxSize: 10.0, geometricTolerance: 0.1, modifier: "MMC" };

  it("identifies MMC/LMC for internal vs external features", () => {
    expect(virtualCondition(hole).mmc).toBe(10.0); // smallest hole
    expect(virtualCondition(hole).lmc).toBe(10.5);
    expect(virtualCondition(shaft).mmc).toBe(10.0); // largest shaft
    expect(virtualCondition(shaft).lmc).toBe(9.5);
  });

  it("computes bonus tolerance as departure from MMC, clamped to the size tolerance", () => {
    expect(bonusTolerance(hole, 10.3)).toBeCloseTo(0.3, 6); // hole opened 0.3 past MMC
    expect(bonusTolerance(hole, 10.0)).toBeCloseTo(0, 6); // at MMC → no bonus
    expect(bonusTolerance(hole, 11.0)).toBeCloseTo(0.5, 6); // clamped to full size tolerance
    expect(totalToleranceAt(hole, 10.3)).toBeCloseTo(0.5, 6); // 0.2 geometric + 0.3 bonus
    expect(bonusTolerance(shaft, 9.7)).toBeCloseTo(0.3, 6); // shaft 0.3 under MMC
  });

  it("earns no bonus for RFS", () => {
    expect(bonusTolerance({ ...hole, modifier: "RFS" }, 10.3)).toBe(0);
  });

  it("computes virtual & resultant condition at MMC (Y14.5)", () => {
    // internal at MMC: VC = MMC − t, RC = LMC + t
    expect(virtualCondition(hole).virtualCondition).toBeCloseTo(9.8, 6);
    expect(virtualCondition(hole).resultantCondition).toBeCloseTo(10.7, 6);
    // external at MMC: VC = MMC + t, RC = LMC − t
    expect(virtualCondition(shaft).virtualCondition).toBeCloseTo(10.1, 6);
    expect(virtualCondition(shaft).resultantCondition).toBeCloseTo(9.4, 6);
  });

  it("computes virtual & resultant condition at LMC (roles reverse)", () => {
    // internal at LMC: VC = LMC + t, RC = MMC − t
    const holeLmc = virtualCondition({ ...hole, modifier: "LMC" });
    expect(holeLmc.virtualCondition).toBeCloseTo(10.7, 6);
    expect(holeLmc.resultantCondition).toBeCloseTo(9.8, 6);
    // external at LMC: VC = LMC − t, RC = MMC + t
    const shaftLmc = virtualCondition({ ...shaft, modifier: "LMC" });
    expect(shaftLmc.virtualCondition).toBeCloseTo(9.4, 6);
    expect(shaftLmc.resultantCondition).toBeCloseTo(10.1, 6);
  });
});
