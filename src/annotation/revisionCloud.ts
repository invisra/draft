import { Path } from "../geometry/path.js";
import { addPoints, magnitude, point, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import { TextElement } from "../svg/text.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";

/** Options for {@link revisionCloud}. */
export interface RevisionCloudOptions {
  /** Target chord length of each scalloped arc "bump". Actual length varies per edge so bumps divide it evenly. Defaults to 8mm. */
  arcLengthMM?: number;
  /** How far each bump bulges outward, as a fraction of its own chord length. Defaults to 0.18 — a gentle, recognizable scallop, not a sharp tooth. */
  bulgeRatio?: number;
  /**
   * Freehand look: randomly vary each bump's chord length and bulge by up to this fraction (0–1), so
   * the scallops read as hand-drawn rather than evenly divided (as AutoCAD's REVCLOUD does). 0 (the
   * default) keeps the even, repeatable division. Output stays deterministic — see {@link seed}.
   */
  jitter?: number;
  /** Seed for the deterministic pseudo-random variation used by {@link jitter}. Same seed → identical output. Defaults to 1. */
  seed?: number;
  /** Defaults to 0.35mm. */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

/** A tiny deterministic PRNG (mulberry32) so `jitter` output stays byte-stable across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function outwardNormals(points: readonly Point[]): boolean {
  // shoelace signed area: positive => CCW winding (standard Y-up convention), for which the
  // outward normal of an edge (dx,dy) is (dy,-dx); CW winding flips it to (-dy,dx).
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area >= 0;
}

/**
 * A conventional "revision cloud": a scalloped boundary of consecutive outward-bulging arcs
 * marking a changed area, most commonly paired with a `revisionSymbol` calling out the revision
 * letter. `boundary` is a closed polygon (e.g. `rectangle()`, or an arbitrary point list) — not
 * numerically dimensioned by any standard (even AutoCAD's own REVCLOUD describes its arc length
 * as an approximate, randomized target, not a fixed value), so `arcLengthMM`/`bulgeRatio` are a
 * reasonable, visually-verified default rather than a spec value. Set `jitter` for a hand-drawn look
 * (bumps of varied size); output stays deterministic for a given `seed`.
 */
export function revisionCloud(boundary: Path | readonly Point[], options: RevisionCloudOptions = {}): DrawingElement {
  const points = Array.isArray(boundary) ? boundary : (boundary as Path).flatten();
  if (points.length < 2) throw new Error("revisionCloud requires at least 2 boundary points");

  const targetArcLength = options.arcLengthMM ?? 8;
  const bulgeRatio = options.bulgeRatio ?? 0.18;
  const jitter = Math.max(0, Math.min(1, options.jitter ?? 0));
  const rng = mulberry32(options.seed ?? 1);
  const strokeOptions = { stroke: { color: options.color ?? "black", width: options.strokeWidthMM ?? 0.35 } };
  const ccw = outwardNormals(points);

  const path = new Path();
  let started = false;

  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const edge = subtractPoints(b, a);
    const edgeLength = magnitude(edge);
    if (edgeLength === 0) continue;

    const dir = scalePoint(edge, 1 / edgeLength);
    const outward = ccw ? point(dir.y, -dir.x) : point(-dir.y, dir.x);
    const bumpCount = Math.max(1, Math.round(edgeLength / targetArcLength));

    // Chord lengths: even by default, or randomized weights (normalized to still span the edge) when jitter > 0.
    const weights = Array.from({ length: bumpCount }, () => (jitter > 0 ? 1 + (rng() * 2 - 1) * jitter : 1));
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    const chords = weights.map((w) => (w / weightSum) * edgeLength);

    let offset = 0;
    for (let k = 0; k < bumpCount; k++) {
      const chordLength = chords[k]!;
      const chordStart = addPoints(a, scalePoint(dir, offset));
      const chordEnd = addPoints(a, scalePoint(dir, offset + chordLength));
      offset += chordLength;
      if (!started) {
        path.moveTo(chordStart.x, chordStart.y);
        started = true;
      }
      // per-bump bulge (varied a little under jitter), and the arc radius through both chord ends
      const bulge = chordLength * bulgeRatio * (jitter > 0 ? 1 + (rng() * 2 - 1) * jitter * 0.5 : 1);
      const radius = (chordLength * chordLength) / (8 * bulge) + bulge / 2;
      const chordMid = addPoints(chordStart, scalePoint(subtractPoints(chordEnd, chordStart), 0.5));
      const center = addPoints(chordMid, scalePoint(outward, -(radius - bulge)));
      const startAngle = Math.atan2(chordStart.y - center.y, chordStart.x - center.x);
      const endAngle = Math.atan2(chordEnd.y - center.y, chordEnd.x - center.x);
      path.arc({ center, radius, startAngle, endAngle, counterclockwise: ccw });
    }
  }
  path.close();
  return new DrawingElement(path, strokeOptions);
}

/** The enclosing shape for a {@link RevisionSymbol}'s letter. */
export type RevisionSymbolShape = "circle" | "triangle";

/** Options for a {@link RevisionSymbol}. */
export interface RevisionSymbolOptions {
  /** ASME Y14.35 specifies enclosing the revision letter in a circle; "triangle" is the widely-used industry "delta" alternative. Defaults to "circle". */
  shape?: RevisionSymbolShape;
  /** Overall size (circle diameter, or triangle height-ish scale). Defaults to 6mm. */
  sizeMM?: number;
  /** Defaults to 0.25mm. */
  strokeWidthMM?: number;
  /** Defaults to `sizeMM * 0.55`. */
  textSizeMM?: number;
  /** Defaults to "black". */
  color?: string;
}

/** A revision-letter symbol (circled per ASME Y14.35, or the common triangular "delta" alternative), typically placed at or near a `revisionCloud`. */
export class RevisionSymbol implements Renderable, Explodable {
  constructor(
    private readonly center: Point,
    private readonly letter: string,
    private readonly options: RevisionSymbolOptions = {},
  ) {}

  /** The symbol's constituent primitives, in draw order (enclosing shape, then the revision letter). */
  toElements(): DxfPrimitive[] {
    const shape = this.options.shape ?? "circle";
    const size = this.options.sizeMM ?? 6;
    const strokeWidthMM = this.options.strokeWidthMM ?? 0.25;
    const color = this.options.color ?? "black";
    const textSize = this.options.textSizeMM ?? size * 0.55;
    const strokeOptions = { stroke: { color, width: strokeWidthMM } };
    const { center } = this;

    let shapePath: Path;
    let textY = center.y - textSize * 0.35;
    if (shape === "circle") {
      shapePath = new Path().moveTo(center.x + size / 2, center.y);
      shapePath.arc({ center, radius: size / 2, startAngle: 0, endAngle: Math.PI, counterclockwise: true });
      shapePath.arc({ center, radius: size / 2, startAngle: Math.PI, endAngle: 2 * Math.PI, counterclockwise: true });
      shapePath.close();
    } else {
      const h = size * 0.9;
      const halfW = h * 0.58;
      shapePath = new Path()
        .moveTo(center.x, center.y + h * 0.62)
        .lineTo(center.x + halfW, center.y - h * 0.38)
        .lineTo(center.x - halfW, center.y - h * 0.38)
        .close();
      textY = center.y - h * 0.05 - textSize * 0.35;
    }

    const shapeEl = new DrawingElement(shapePath, strokeOptions);
    const textEl = new TextElement({ x: center.x, y: textY }, this.letter, { size: textSize, anchor: "middle", color });
    return [shapeEl, textEl];
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}
