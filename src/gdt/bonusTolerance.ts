/**
 * ASME Y14.5 material-condition calculations for a feature of size carrying a geometric tolerance:
 * bonus tolerance (the extra tolerance earned as a feature departs from MMC/LMC) and the virtual /
 * resultant condition (the collective worst-case boundaries). Pure calculation — pairs with the
 * feature-control-frame drawing in {@link FeatureControlFrame}.
 */

/** Which material condition the geometric tolerance applies at. `RFS` (regardless of feature size) earns no bonus. */
export type MaterialConditionModifier = "MMC" | "LMC" | "RFS";

/** Input for a {@link virtualCondition} / {@link bonusTolerance} calculation. */
export interface FeatureToleranceInput {
  /** `internal` = a hole/slot (MMC is the smallest size); `external` = a pin/shaft (MMC is the largest size). */
  featureType: "internal" | "external";
  /** Lower size limit of the feature. */
  minSize: number;
  /** Upper size limit of the feature. */
  maxSize: number;
  /** The geometric tolerance value from the feature control frame. */
  geometricTolerance: number;
  /** The material-condition modifier the tolerance is applied at (Ⓜ/Ⓛ/RFS). */
  modifier: MaterialConditionModifier;
}

/** Result of {@link virtualCondition}. */
export interface VirtualConditionResult {
  /** Maximum-material size (smallest hole / largest shaft). */
  mmc: number;
  /** Least-material size (largest hole / smallest shaft). */
  lmc: number;
  /** Virtual condition — the constant worst-case boundary generated at the modifier's material condition. */
  virtualCondition: number;
  /** Resultant condition — the worst-case boundary at the opposite material condition. */
  resultantCondition: number;
}

function mmcLmc(input: FeatureToleranceInput): { mmc: number; lmc: number } {
  return input.featureType === "internal"
    ? { mmc: input.minSize, lmc: input.maxSize } // hole: MMC = smallest
    : { mmc: input.maxSize, lmc: input.minSize }; // shaft: MMC = largest
}

/**
 * Bonus tolerance earned at a produced `actualSize`: the feature's departure from the modifier's
 * material condition (MMC or LMC), clamped to the size tolerance. `RFS` earns no bonus (returns 0).
 */
export function bonusTolerance(input: FeatureToleranceInput, actualSize: number): number {
  if (input.modifier === "RFS") return 0;
  const { mmc, lmc } = mmcLmc(input);
  const from = input.modifier === "MMC" ? mmc : lmc;
  const departure = Math.abs(actualSize - from);
  return Math.min(departure, Math.abs(lmc - mmc));
}

/** Total positional/orientation tolerance available at a produced `actualSize` (geometric tolerance + bonus). */
export function totalToleranceAt(input: FeatureToleranceInput, actualSize: number): number {
  return input.geometricTolerance + bonusTolerance(input, actualSize);
}

/**
 * Virtual and resultant condition boundaries (ASME Y14.5). At MMC the virtual condition adds the
 * tolerance for an external feature and subtracts it for an internal one; at LMC the roles reverse.
 * `RFS` (like MMC) anchors the virtual condition at MMC using the stated geometric tolerance — there
 * is simply no bonus, so {@link bonusTolerance} returns 0.
 */
export function virtualCondition(input: FeatureToleranceInput): VirtualConditionResult {
  const { mmc, lmc } = mmcLmc(input);
  const t = input.geometricTolerance;
  const external = input.featureType === "external";
  // At MMC: external VC = MMC + t, internal VC = MMC − t; resultant is the opposite at LMC.
  // At LMC: external VC = LMC − t, internal VC = LMC + t; resultant is the opposite at MMC.
  const atMMC = input.modifier !== "LMC"; // MMC and RFS both anchor the VC at MMC
  const base = atMMC ? mmc : lmc;
  const other = atMMC ? lmc : mmc;
  const sign = external ? 1 : -1;
  const vcSign = atMMC ? sign : -sign;
  return {
    mmc,
    lmc,
    virtualCondition: base + vcSign * t,
    resultantCondition: other - vcSign * t,
  };
}
