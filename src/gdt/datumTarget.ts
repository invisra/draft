import { circle as circleShape, rectangle as rectangleShape } from "../geometry/shapes.js";
import { Path } from "../geometry/path.js";
import { addPoints, point, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";
import { TextElement } from "../svg/text.js";
import { hatch } from "../hatch/hatch.js";
import { estimateTextWidth } from "../dimension/label.js";

/** Options for a {@link DatumTargetSymbol}. */
export interface DatumTargetSymbolOptions {
  /** Direction (degrees, 0 = +X axis) the leader points, from the target location outward to the symbol. */
  angleDeg: number;
  /** Diameter of a circular contact area, shown in the upper half (e.g. 6 -> "⌀6.00"). Omit for a point or line target — the upper half is then left blank, per convention. */
  areaSize?: number;
  /** Upper-half free text for a non-circular contact area, e.g. `"10X6"` for a rectangular target (pair with {@link datumTargetRectangle}). Overrides `areaSize`. */
  areaText?: string;
  /** "near" (default): a solid leader, the target is on the visible side. "far": a dashed leader, the target is on the hidden/back side. */
  side?: "near" | "far";
  /** Defaults to 10mm. */
  leaderLengthMM?: number;
  /** Base circle diameter; auto-grows to fit its text if needed. Defaults to 8mm. */
  diameterMM?: number;
  /** Defaults to 0.25mm. */
  strokeWidthMM?: number;
  /** Lower-half (datum letter/number) text size. Defaults to `diameterMM * 0.4`. */
  textSizeMM?: number;
  /** Defaults to "black". */
  color?: string;
  /** Decimal places for `areaSize`. Defaults to 2. */
  precision?: number;
}

/**
 * An ASME Y14.5 datum target symbol: a circle divided in half by a horizontal line, with a
 * leader to the target location. The lower half always shows the datum letter + target number
 * (e.g. "A1"); the upper half shows a circular contact area's diameter (`areaSize` → "⌀6.00") or a
 * non-circular area's dimensions (`areaText` → e.g. "10X6"), and is left blank for a point or line
 * target. Distinct from `DatumFeatureSymbol`, which tags an entire feature as a datum rather than a
 * specific point/line/area used to establish one.
 */
export class DatumTargetSymbol implements Renderable, Explodable {
  constructor(
    private readonly touchPoint: Point,
    private readonly letter: string,
    private readonly targetNumber: number,
    private readonly options: DatumTargetSymbolOptions,
  ) {}

  /** The symbol's constituent primitives, in draw order (leader, circle, divider, lower label, optional upper label). */
  toElements(): DxfPrimitive[] {
    const baseDiameter = this.options.diameterMM ?? 8;
    const textSize = this.options.textSizeMM ?? baseDiameter * 0.4;
    const leaderLength = this.options.leaderLengthMM ?? 10;
    const strokeWidthMM = this.options.strokeWidthMM ?? 0.25;
    const color = this.options.color ?? "black";
    const precision = this.options.precision ?? 2;
    const side = this.options.side ?? "near";

    const lowerLabel = `${this.letter}${this.targetNumber}`;
    const upperLabel =
      this.options.areaText ?? (this.options.areaSize !== undefined ? `⌀${this.options.areaSize.toFixed(precision)}` : undefined);
    const upperTextSize = textSize * 0.85;
    // the circle must be wide enough to fit whichever half's text is longest, with a small margin
    const diameter = Math.max(
      baseDiameter,
      estimateTextWidth(lowerLabel, textSize) + textSize,
      upperLabel ? estimateTextWidth(upperLabel, upperTextSize) + upperTextSize : 0,
    );
    const radius = diameter / 2;

    const rad = (this.options.angleDeg * Math.PI) / 180;
    const dir = point(Math.cos(rad), Math.sin(rad));
    const center = addPoints(this.touchPoint, scalePoint(dir, leaderLength));
    const leaderEnd = subtractPoints(center, scalePoint(dir, radius));

    const strokeOptions = { stroke: { color, width: strokeWidthMM, ...(side === "far" ? { dasharray: [3, 1.5] } : {}) } };
    const leaderLine = new DrawingElement(new Path().moveTo(this.touchPoint.x, this.touchPoint.y).lineTo(leaderEnd.x, leaderEnd.y), strokeOptions);

    const circleOptions = { stroke: { color, width: strokeWidthMM } };
    const circleEl = new DrawingElement(circleShape(center.x, center.y, radius), circleOptions);
    const divider = new DrawingElement(new Path().moveTo(center.x - radius, center.y).lineTo(center.x + radius, center.y), circleOptions);

    const lowerText = new TextElement({ x: center.x, y: center.y - radius * 0.55 }, lowerLabel, {
      size: textSize,
      anchor: "middle",
      color,
    });

    const parts: DxfPrimitive[] = [leaderLine, circleEl, divider, lowerText];
    if (upperLabel !== undefined) {
      const upperText = new TextElement({ x: center.x, y: center.y + radius * 0.15 }, upperLabel, {
        size: upperTextSize,
        anchor: "middle",
        color,
      });
      parts.push(upperText);
    }
    return parts;
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}

/** Style options shared by {@link datumTargetPoint}, {@link datumTargetLine}, and {@link datumTargetArea}. */
export interface DatumTargetMarkerOptions {
  /** Defaults to 0.25mm. */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

/**
 * The "X" mark identifying a datum target POINT — a single point of contact between the datum
 * simulator and the part. `size` is the X's half-diagonal (arm length). Returns two elements (one
 * per diagonal stroke) since `Path` only supports a single continuous subpath — same reason
 * `centerMark()` returns an array rather than one compound cross-shaped path.
 */
export function datumTargetPoint(center: Point, size = 2.5, options: DatumTargetMarkerOptions = {}): DrawingElement[] {
  const strokeOptions = { stroke: { color: options.color ?? "black", width: options.strokeWidthMM ?? 0.25 } };
  const diagonal1 = new Path().moveTo(center.x - size, center.y - size).lineTo(center.x + size, center.y + size);
  const diagonal2 = new Path().moveTo(center.x - size, center.y + size).lineTo(center.x + size, center.y - size);
  return [new DrawingElement(diagonal1, strokeOptions), new DrawingElement(diagonal2, strokeOptions)];
}

/** The phantom-line marker for a datum target LINE — a line contact between the datum simulator and the part, with an "X" at each end. */
export function datumTargetLine(p1: Point, p2: Point, options: DatumTargetMarkerOptions = {}): DrawingElement[] {
  const strokeOptions = { stroke: { color: options.color ?? "black", width: options.strokeWidthMM ?? 0.25 }, lineStyle: "phantom" as const };
  const line = new DrawingElement(new Path().moveTo(p1.x, p1.y).lineTo(p2.x, p2.y), strokeOptions);
  return [...datumTargetPoint(p1, undefined, options), line, ...datumTargetPoint(p2, undefined, options)];
}

/**
 * The cross-hatched, phantom-outlined marker for a datum target AREA of an **arbitrary closed
 * shape** — the contact area between the datum simulator and the part. Pass any closed boundary
 * `Path` (a rectangle, an ellipse from `ellipse(...)`, a polygon, etc.); {@link datumTargetArea} and
 * {@link datumTargetRectangle} are the circular and rectangular conveniences. Pair the returned
 * hatch/outline with a `DatumTargetSymbol` whose `areaSize`/`areaText` states the same dimensions.
 */
export function datumTargetAreaOutline(boundary: Path, options: DatumTargetMarkerOptions = {}): DrawingElement[] {
  const outline = new DrawingElement(boundary, {
    lineStyle: "phantom",
    stroke: { color: options.color ?? "black", width: options.strokeWidthMM ?? 0.25 },
  });
  return [
    ...hatch(boundary, {
      ...(options.color !== undefined ? { color: options.color } : {}),
      ...(options.strokeWidthMM !== undefined ? { strokeWidthMM: options.strokeWidthMM } : {}),
    }),
    outline,
  ];
}

/** The cross-hatched, phantom-outlined marker for a **circular** datum target area. Pair with a `DatumTargetSymbol` whose `areaSize` states the same diameter. */
export function datumTargetArea(center: Point, radius: number, options: DatumTargetMarkerOptions = {}): DrawingElement[] {
  return datumTargetAreaOutline(circleShape(center.x, center.y, radius), options);
}

/** The cross-hatched, phantom-outlined marker for a **rectangular** datum target area, `width`×`height` centered on `center`. Pair with a `DatumTargetSymbol` whose `areaText` states the same dimensions (e.g. `"10X6"`). */
export function datumTargetRectangle(center: Point, width: number, height: number, options: DatumTargetMarkerOptions = {}): DrawingElement[] {
  return datumTargetAreaOutline(rectangleShape(center.x - width / 2, center.y - height / 2, width, height), options);
}
