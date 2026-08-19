import { Path } from "../geometry/path.js";
import { addPoints, point, scalePoint, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive } from "../svg/renderable.js";
import type { TextAnchor } from "../svg/text.js";
import { TextElement } from "../svg/text.js";
import { arrowhead } from "./arrowhead.js";
import { resolveDimensionStyle, type DimensionStyle } from "./style.js";

/** Options shared by every elbow-leader annotation (`Callout`, `RadialDimension`, `ItemBalloon`, `DetailViewCallout`). */
export interface LeaderOptions extends DimensionStyle {
  /** Length of the leader segment from `start` outward, before the elbow. Defaults to 8mm. */
  leaderLengthMM?: number;
  /** Length of the horizontal shoulder segment after the elbow, leading into the text. Defaults to 4mm. */
  elbowLengthMM?: number;
  /** Whether to draw an arrowhead at `start`. Defaults to true. */
  arrow?: boolean;
}

/** Computed geometry for an elbow leader, as returned by {@link computeLeaderGeometry}. */
export interface LeaderGeometry {
  /** Where the leader bends from its diagonal run into the horizontal shoulder. */
  elbow: Point;
  /** The far end of the horizontal shoulder, where text/icons begin. */
  shoulderEnd: Point;
  /** +1 if the shoulder (and text) run rightward from the elbow, -1 if leftward. */
  shoulderSign: 1 | -1;
  /** Where a line of text at this shoulder should anchor: "start" if the shoulder runs right, "end" if left. */
  textAnchor: TextAnchor;
  /** The x position to pass as a text element's x, given `textAnchor` and a small gap from the shoulder end. */
  textX: number;
}

/** The straight-leader + elbow + shoulder geometry shared by every elbow-leader annotation, without any text/arrow rendering. */
export function computeLeaderGeometry(start: Point, angleDeg: number, options: LeaderOptions = {}): LeaderGeometry {
  const leaderLength = options.leaderLengthMM ?? 8;
  const elbowLength = options.elbowLengthMM ?? 4;
  const textGap = 1;

  const rad = (angleDeg * Math.PI) / 180;
  const direction = point(Math.cos(rad), Math.sin(rad));
  const elbow = addPoints(start, scalePoint(direction, leaderLength));
  const shoulderSign: 1 | -1 = direction.x >= 0 ? 1 : -1;
  const shoulderEnd = addPoints(elbow, point(shoulderSign * elbowLength, 0));
  const textAnchor: TextAnchor = shoulderSign >= 0 ? "start" : "end";
  const textX = shoulderEnd.x + shoulderSign * textGap;

  return { elbow, shoulderEnd, shoulderSign, textAnchor, textX };
}

/** The leader line + elbow + shoulder + optional arrowhead as elements, without text — backs {@link renderLeaderLine} and the DXF export of every elbow-leader annotation. */
export function leaderLineElements(start: Point, angleDeg: number, geometry: LeaderGeometry, options: LeaderOptions = {}): DrawingElement[] {
  const style = resolveDimensionStyle(options);
  const showArrow = options.arrow ?? true;
  const rad = (angleDeg * Math.PI) / 180;
  const direction = point(Math.cos(rad), Math.sin(rad));

  const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };
  const parts: DrawingElement[] = [
    new DrawingElement(new Path().moveTo(start.x, start.y).lineTo(geometry.elbow.x, geometry.elbow.y), strokeOptions),
    new DrawingElement(new Path().moveTo(geometry.elbow.x, geometry.elbow.y).lineTo(geometry.shoulderEnd.x, geometry.shoulderEnd.y), strokeOptions),
  ];
  if (showArrow) {
    parts.push(arrowhead(start, scalePoint(direction, -1), { length: style.arrowLengthMM, width: style.arrowWidthMM, color: style.color }));
  }
  return parts;
}

/** The leader line + elbow + shoulder + optional arrowhead, without text — for callers composing their own text/icon layout (see `Callout`). */
export function renderLeaderLine(start: Point, angleDeg: number, geometry: LeaderGeometry, options: LeaderOptions = {}): string {
  return leaderLineElements(start, angleDeg, geometry, options)
    .map((el) => el.toSVG())
    .join("\n");
}

/** The elbow leader line + shoulder + arrowhead + text as elements — backs {@link renderElbowLeader} and the DXF export of the callout family. */
export function elbowLeaderElements(start: Point, angleDeg: number, text: string | readonly string[], options: LeaderOptions = {}): DxfPrimitive[] {
  const style = resolveDimensionStyle(options);
  const geometry = computeLeaderGeometry(start, angleDeg, options);
  const parts: DxfPrimitive[] = [...leaderLineElements(start, angleDeg, geometry, options)];

  const lines = typeof text === "string" ? [text] : text;
  const lineSpacing = style.textSizeMM * 1.3;
  lines.forEach((line, i) => {
    parts.push(
      new TextElement({ x: geometry.textX, y: geometry.shoulderEnd.y - style.textSizeMM * 0.35 - i * lineSpacing }, line, {
        size: style.textSizeMM,
        anchor: geometry.textAnchor,
        color: style.color,
      }),
    );
  });

  return parts;
}

/**
 * A leader with a standard elbow: a straight segment from `start` outward along
 * `angleDeg`, then a horizontal shoulder (direction picked by which side `start`
 * is pointing toward) leading into horizontal text — so the label stays readable
 * regardless of the leader's angle. Shared by radius/diameter dimensions and
 * generic callouts. `text` may be an array for stacked lines (first line at the
 * shoulder, each subsequent line below it). See {@link elbowLeaderElements} for
 * the element list the DXF export uses.
 */
export function renderElbowLeader(start: Point, angleDeg: number, text: string | readonly string[], options: LeaderOptions = {}): string {
  return elbowLeaderElements(start, angleDeg, text, options)
    .map((el) => el.toSVG())
    .join("\n");
}
