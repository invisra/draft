import type { Path } from "../geometry/path.js";
import { toMM } from "../units.js";
import type { DrawingElement } from "../svg/element.js";
import { hatch } from "./hatch.js";

/** One parallel-line family within a {@link HatchPattern}. */
export interface HatchLineFamily {
  /** Direction of this line family in degrees, 0 = +X axis. */
  angleDeg: number;
  /** Perpendicular distance between lines in this family, in mm. */
  spacingMM: number;
  /** Perpendicular offset (mm) of this family from the pattern's shared origin — lets families at the same angle interleave rather than coincide. Defaults to 0. */
  phaseMM?: number;
  /** Dash/gap lengths (mm), alternating, same convention as `Stroke.dasharray`. Omit for a continuous line. */
  dasharray?: readonly number[];
  /** `"round"` renders a 0-length dasharray entry as a dot (used for dash-dot families). */
  linecap?: "butt" | "round" | "square";
}

/** A named, multi-line-family material hatch pattern (e.g. {@link ANSI31}), for use with {@link hatchPattern}. */
export interface HatchPattern {
  /** Pattern name, e.g. "ANSI31". */
  name: string;
  /** What material(s) this pattern conventionally represents. */
  description: string;
  /** The parallel-line families that make up the pattern. */
  families: readonly HatchLineFamily[];
}

/** Options for {@link hatchPattern}. */
export interface HatchPatternOptions {
  /** Uniform scale applied to every family's spacing/phase/dash lengths, like AutoCAD's hatch scale (HPSCALE). Defaults to 1. */
  scale?: number;
  /** Overrides every family's line width. Defaults to `hatch()`'s own default (0.18mm). */
  strokeWidthMM?: number;
  /** Overrides every family's line color. Defaults to "black". */
  color?: string;
}

/**
 * Fills `boundary` with a named multi-line-family material pattern (see
 * `ANSI31`–`ANSI38` below) by running `hatch()` once per family and
 * concatenating the results — same "one `DrawingElement` per line" return
 * shape as `hatch()` itself.
 */
export function hatchPattern(boundary: Path | readonly Path[], pattern: HatchPattern, options: HatchPatternOptions = {}): DrawingElement[] {
  const scale = options.scale ?? 1;
  return pattern.families.flatMap((family) =>
    hatch(boundary, {
      angleDeg: family.angleDeg,
      spacingMM: family.spacingMM * scale,
      phaseMM: (family.phaseMM ?? 0) * scale,
      ...(family.dasharray ? { dasharray: family.dasharray.map((d) => d * scale) } : {}),
      ...(family.linecap ? { linecap: family.linecap } : {}),
      ...(options.strokeWidthMM !== undefined ? { strokeWidthMM: options.strokeWidthMM } : {}),
      ...(options.color !== undefined ? { color: options.color } : {}),
    }),
  );
}

function inches(value: number): number {
  return toMM(value, "in");
}

// acad.pat represents a dash-dot "dot" as a literal 0-length dash segment (paired with a round
// linecap). Verified against librsvg: a true 0-length dasharray entry renders as nothing, not a
// dot — only a small positive length actually draws (as a round linecap makes it look circular).
const DOT = 0.01;

// Converted from AutoCAD's acad.pat, the de facto standard set of section-lining material
// symbols in US mechanical drafting practice (each pattern's own line spacing/dash values are
// given in inches there, regardless of drawing units — converted to mm here via toMM/MM_PER_INCH,
// not rounded, so a pattern rendered at scale 1 matches AutoCAD's own default HPSCALE=1 exactly).
//
// ANSI36 and ANSI38 drop one detail from the source: acad.pat staggers each successive row's dash
// phase along the line direction ("brick coursing"), which would require a per-row dash offset our
// engine doesn't model (each hatch line's dasharray restarts at that line's own clipped start point
// regardless). The line angles, spacing, and dash rhythm are otherwise exact — only that stagger is
// dropped, so both patterns render as a regular (non-staggered) grid instead of a brick-like one.

/** ANSI31 hatch pattern: iron, brick, stone masonry (general purpose). */
export const ANSI31: HatchPattern = {
  name: "ANSI31",
  description: "Iron, brick, stone masonry (general purpose)",
  families: [{ angleDeg: 45, spacingMM: inches(0.125) }],
};

/** ANSI32 hatch pattern: steel. */
export const ANSI32: HatchPattern = {
  name: "ANSI32",
  description: "Steel",
  families: [
    { angleDeg: 45, spacingMM: inches(0.375) },
    { angleDeg: 45, spacingMM: inches(0.375), phaseMM: inches(0.125) },
  ],
};

/** ANSI33 hatch pattern: bronze, brass, copper, composites. */
export const ANSI33: HatchPattern = {
  name: "ANSI33",
  description: "Bronze, brass, copper, composites",
  families: [
    { angleDeg: 45, spacingMM: inches(0.25) },
    { angleDeg: 45, spacingMM: inches(0.25), phaseMM: inches(0.125), dasharray: [inches(0.125), inches(0.0625)] },
  ],
};

/** ANSI34 hatch pattern: plastic, rubber, electrical insulation. */
export const ANSI34: HatchPattern = {
  name: "ANSI34",
  description: "Plastic, rubber, electrical insulation",
  families: [
    { angleDeg: 45, spacingMM: inches(0.75) },
    { angleDeg: 45, spacingMM: inches(0.75), phaseMM: inches(0.125) },
    { angleDeg: 45, spacingMM: inches(0.75), phaseMM: inches(0.25) },
    { angleDeg: 45, spacingMM: inches(0.75), phaseMM: inches(0.375) },
  ],
};

/** ANSI35 hatch pattern: fire brick, refractory material. */
export const ANSI35: HatchPattern = {
  name: "ANSI35",
  description: "Fire brick, refractory material",
  families: [
    { angleDeg: 45, spacingMM: inches(0.25) },
    {
      angleDeg: 45,
      spacingMM: inches(0.25),
      phaseMM: inches(0.125),
      dasharray: [inches(0.3125), inches(0.0625), DOT, inches(0.0625)],
      linecap: "round",
    },
  ],
};

/** ANSI36 hatch pattern: marble, slate, glass. */
export const ANSI36: HatchPattern = {
  name: "ANSI36",
  description: "Marble, slate, glass",
  families: [
    {
      angleDeg: 45,
      spacingMM: inches(0.125),
      dasharray: [inches(0.3125), inches(0.0625), DOT, inches(0.0625)],
      linecap: "round",
    },
  ],
};

/** ANSI37 hatch pattern: lead, zinc, magnesium, sound/heat/electrical insulation. */
export const ANSI37: HatchPattern = {
  name: "ANSI37",
  description: "Lead, zinc, magnesium, sound/heat/electrical insulation",
  families: [
    { angleDeg: 45, spacingMM: inches(0.125) },
    { angleDeg: 135, spacingMM: inches(0.125) },
  ],
};

/** ANSI38 hatch pattern: aluminum. */
export const ANSI38: HatchPattern = {
  name: "ANSI38",
  description: "Aluminum",
  families: [
    { angleDeg: 45, spacingMM: inches(0.125) },
    { angleDeg: 135, spacingMM: inches(0.125), dasharray: [inches(0.3125), inches(0.1875)] },
  ],
};

/** Every built-in {@link HatchPattern} (ANSI31-ANSI38), keyed by name. */
export const ANSI_HATCH_PATTERNS = {
  ANSI31,
  ANSI32,
  ANSI33,
  ANSI34,
  ANSI35,
  ANSI36,
  ANSI37,
  ANSI38,
} as const satisfies Record<string, HatchPattern>;
