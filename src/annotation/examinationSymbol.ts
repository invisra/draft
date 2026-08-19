import { Path } from "../geometry/path.js";
import { circle as circleShape } from "../geometry/shapes.js";
import { addPoints, point, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";
import type { TextAnchor } from "../svg/text.js";
import { TextElement } from "../svg/text.js";
import { computeLeaderGeometry, leaderLineElements, type LeaderOptions } from "../dimension/leader.js";
import { resolveDimensionStyle } from "../dimension/style.js";

/**
 * One side's nondestructive-examination specification for an {@link ExaminationSymbol}: the method
 * letter designation(s), the extent examined, and the number of examinations.
 */
export interface ExamSpec {
  /**
   * Method letter designation(s) (AWS A2.4:2020 §17.3, Table A.6) — e.g. `"RT"` (radiographic),
   * `"UT"` (ultrasonic), `"MT"` (magnetic particle), `"PT"` (liquid penetrant), `"VT"` (visual),
   * `"ET"` (eddy current), `"LT"` (leak), `"AET"` (acoustic emission), `"PRT"` (proof). An array is
   * joined with a plus sign for two or more methods on the same side (§17.5.6, e.g. `["UT","RT"]` → `UT+RT`).
   */
  methods: string | string[];
  /**
   * Extent examined, shown to the **right** of the letter designation (§17.11.1): a length (e.g. `250`)
   * or a percentage of the joint (`"25%"`, §17.11.4). Omit for full length (§17.11.3).
   */
  length?: string | number;
  /** Number of examinations, shown in parentheses beyond the designation, away from the reference line (§17.12.1). */
  count?: string | number;
}

/** Options for an {@link ExaminationSymbol}. */
export interface ExaminationSymbolOptions extends LeaderOptions {
  /** Direction (degrees, 0 = +X axis) the arrow leader points, from the reference line toward the joint. */
  angleDeg: number;
  /** Examination required on the arrow side — the designation is placed **below** the reference line (§17.5.1). */
  arrowSide?: ExamSpec;
  /** Examination required on the other side — the designation is placed **above** the reference line (§17.5.2). */
  otherSide?: ExamSpec;
  /** Examination with no side significance — the designation straddles the reference line (§17.5.5). */
  centered?: ExamSpec;
  /** Examine all around the joint — a circle at the arrow/reference-line junction (§17.4). */
  allAround?: boolean;
  /** Examination to be performed in the field (on-site) — a flag at the arrow/reference-line junction (§17.4). */
  fieldExam?: boolean;
  /** Free-text note via a forked tail at the reference line's far end (§17.2 specification/reference). */
  tailNote?: string;
  /**
   * Direction of penetrating radiation (§17.4): draws an arrow at this angle (degrees, 0 = +X, CCW)
   * near the junction, labelled with the angle, for a radiographic examination. Typically used with
   * an `RT`/`NRT` method.
   */
  radiationAngleDeg?: number;
  /** Length of the horizontal reference line beyond the elbow. Defaults to 16mm. */
  refLineLengthMM?: number;
  textSizeMM?: number;
}

/**
 * An AWS A2.4 nondestructive-examination (NDE) symbol (clause 17): a reference line with an arrow
 * leader to the joint, carrying method letter designations instead of weld-type symbols. The
 * designation is placed **below** the reference line for an arrow-side examination (§17.5.1),
 * **above** for the other side (§17.5.2), or straddling the line when the method has no side
 * significance (§17.5.5); passing both `arrowSide` and `otherSide` covers a both-sides examination
 * (§17.5.3). Two or more methods on one side are joined with a plus sign (§17.5.6). Extent (length or
 * percentage) reads to the right of the designation (§17.11); the number of examinations is
 * parenthesized beyond it, away from the line (§17.12). An `allAround` circle (examine all around)
 * and a `fieldExam` flag attach at the arrow/reference-line junction (§17.4); a `radiationAngleDeg`
 * draws the radiation-direction arrow with its degree value (§17.4).
 *
 * Built on the same elbow-leader geometry as the weld symbols in
 * `@invisra/draft-mechanical`. Validated against AWS A2.4:2020
 * clause 17. Not covered (documented in the README): multiple/sequenced reference lines.
 */
export class ExaminationSymbol implements Renderable, Explodable {
  constructor(
    private readonly jointPoint: Point,
    private readonly options: ExaminationSymbolOptions,
  ) {}

  /** The examination symbol's constituent primitives, in draw order (reference line + arrow, method designations, all-around/field marks, tail note). */
  toElements(): DxfPrimitive[] {
    const { jointPoint, options } = this;
    const style = resolveDimensionStyle(options);
    const refLineLengthMM = options.refLineLengthMM ?? 16;
    const textSizeMM = options.textSizeMM ?? style.textSizeMM;
    const symbolSizeMM = 5;
    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };

    const geometry = computeLeaderGeometry(jointPoint, options.angleDeg, { ...options, elbowLengthMM: refLineLengthMM });
    const parts: DxfPrimitive[] = [...leaderLineElements(jointPoint, options.angleDeg, geometry, options)];

    const s = geometry.shoulderSign;
    const { elbow } = geometry;
    const line = elbow.y;
    const nudge = textSizeMM * 0.35;
    // The designation reads outward from the elbow toward the tail, so it never collides with the arrow leg.
    const textX = elbow.x + s * textSizeMM * 0.5;
    const anchor: TextAnchor = s >= 0 ? "start" : "end";

    const specs: { spec: ExamSpec | undefined; v: 1 | 0 | -1 }[] = [
      { spec: options.arrowSide, v: -1 },
      { spec: options.otherSide, v: 1 },
      { spec: options.centered, v: 0 },
    ];
    for (const { spec, v } of specs) {
      if (!spec) continue;
      const methods = Array.isArray(spec.methods) ? spec.methods.join("+") : spec.methods;
      const designation = spec.length !== undefined ? `${methods} ${spec.length}` : methods;
      // Below the line (arrow side), on it (centered), or above it (other side).
      const desigY = v === 0 ? line : line + v * textSizeMM * 0.95;
      parts.push(new TextElement({ x: textX, y: desigY - nudge }, designation, { size: textSizeMM, anchor, color: style.color }));

      // Number of examinations (N): parenthesized beyond the designation, away from the reference line (§17.12.1).
      if (spec.count !== undefined) {
        const tv = v === 0 ? 1 : v;
        parts.push(
          new TextElement({ x: textX, y: line + tv * textSizeMM * 2.1 - nudge }, `(${spec.count})`, { size: textSizeMM, anchor, color: style.color }),
        );
      }
    }

    if (options.allAround) {
      parts.push(new DrawingElement(circleShape(elbow.x, elbow.y, symbolSizeMM * 0.22), strokeOptions));
    }
    if (options.fieldExam) {
      const poleTop = addPoints(elbow, point(0, symbolSizeMM * 1.1));
      const flagTip = addPoints(poleTop, point(s * symbolSizeMM * 0.5, -symbolSizeMM * 0.25));
      const flagPath = new Path().moveTo(elbow.x, poleTop.y).lineTo(flagTip.x, flagTip.y).lineTo(elbow.x, poleTop.y - symbolSizeMM * 0.5).close();
      parts.push(new DrawingElement(new Path().moveTo(elbow.x, elbow.y).lineTo(elbow.x, poleTop.y), strokeOptions));
      parts.push(new DrawingElement(flagPath, { fill: style.color, stroke: "none" }));
    }

    if (options.radiationAngleDeg !== undefined) {
      // A radiation-direction arrow drawn at the actual angle, with its degree value (§17.4).
      const rad = (options.radiationAngleDeg * Math.PI) / 180;
      const dir = point(Math.cos(rad), Math.sin(rad));
      const origin = addPoints(elbow, point(s * symbolSizeMM * 2, symbolSizeMM * 1.6));
      const len = symbolSizeMM * 1.8;
      const tip = addPoints(origin, point(dir.x * len, dir.y * len));
      const head = symbolSizeMM * 0.4;
      const back = (a: number) => point(tip.x - (dir.x * Math.cos(a) - dir.y * Math.sin(a)) * head, tip.y - (dir.x * Math.sin(a) + dir.y * Math.cos(a)) * head);
      const b1 = back(0.4);
      const b2 = back(-0.4);
      parts.push(new DrawingElement(new Path().moveTo(origin.x, origin.y).lineTo(tip.x, tip.y), strokeOptions));
      parts.push(new DrawingElement(new Path().moveTo(b1.x, b1.y).lineTo(tip.x, tip.y).lineTo(b2.x, b2.y), strokeOptions));
      parts.push(
        new TextElement({ x: origin.x - s * textSizeMM * 0.3, y: origin.y - textSizeMM * 0.35 }, `${options.radiationAngleDeg}°`, {
          size: textSizeMM,
          anchor: s >= 0 ? "end" : "start",
          color: style.color,
        }),
      );
    }

    if (options.tailNote) {
      const tailStart = geometry.shoulderEnd;
      const forkGap = symbolSizeMM * 0.4;
      const forkLength = symbolSizeMM * 0.9;
      const p1 = addPoints(tailStart, point(s * forkLength, forkGap));
      const p2 = addPoints(tailStart, point(s * forkLength, -forkGap));
      parts.push(new DrawingElement(new Path().moveTo(p1.x, p1.y).lineTo(tailStart.x, tailStart.y).lineTo(p2.x, p2.y), strokeOptions));
      const textAnchor: TextAnchor = s >= 0 ? "start" : "end";
      parts.push(
        new TextElement({ x: tailStart.x + s * (forkLength + textSizeMM * 0.4), y: tailStart.y - textSizeMM * 0.35 }, options.tailNote, {
          size: textSizeMM,
          anchor: textAnchor,
          color: style.color,
        }),
      );
    }

    return parts;
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}
