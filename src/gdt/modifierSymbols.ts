import { Path } from "../geometry/path.js";
import { circle as circleShape } from "../geometry/shapes.js";
import { normalize, subtractPoints, distance, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive } from "../svg/renderable.js";
import { TextElement } from "../svg/text.js";
import { arrowhead } from "../dimension/arrowhead.js";
import { estimateTextWidth } from "../dimension/label.js";

/**
 * ASME Y14.5 tolerance-zone *application* symbols — the ones drawn on the leader or
 * adjacent to a feature control frame rather than inside its compartments: the
 * all-around and all-over "extent of the controlled feature" symbols, the
 * between (`↔`) symbol, and the continuous-feature (`CF`) indicator. (The
 * in-frame modifiers — material condition, projected zone, etc. — live on
 * {@link FeatureControlFrame}; the datum-translation `▷` modifier lives on its
 * datum references.)
 */

/** Shared style for the modifier symbols. */
export interface ModifierSymbolOptions {
  /** Nominal glyph size in mm (circle diameter / arrow-label height). Defaults to 3. */
  sizeMM?: number;
  /** Stroke width in mm. Defaults to 0.25. */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

interface ResolvedModifierStyle {
  sizeMM: number;
  strokeWidthMM: number;
  color: string;
}

function resolve(options: ModifierSymbolOptions): ResolvedModifierStyle {
  return {
    sizeMM: options.sizeMM ?? 3,
    strokeWidthMM: options.strokeWidthMM ?? 0.25,
    color: options.color ?? "black",
  };
}

/**
 * The ASME Y14.5 §8.3.1 **all-around** symbol: the circle drawn at the leader's
 * bend (knee) to indicate a profile tolerance applies all around the outline of
 * the feature. `junction` is where the circle is centered (the leader break).
 */
export function allAroundSymbol(junction: Point, options: ModifierSymbolOptions = {}): DrawingElement[] {
  const style = resolve(options);
  const stroke = { stroke: { color: style.color, width: style.strokeWidthMM } };
  return [new DrawingElement(circleShape(junction.x, junction.y, style.sizeMM / 2), stroke)];
}

/**
 * The ASME Y14.5-2018 §8.3.2 **all-over** symbol: two concentric circles at the
 * leader's bend, indicating a profile tolerance applies over all surfaces of the
 * part (the 3-D counterpart to all-around). `junction` is the circles' center.
 */
export function allOverSymbol(junction: Point, options: ModifierSymbolOptions = {}): DrawingElement[] {
  const style = resolve(options);
  const stroke = { stroke: { color: style.color, width: style.strokeWidthMM } };
  const outer = style.sizeMM / 2;
  return [
    new DrawingElement(circleShape(junction.x, junction.y, outer), stroke),
    new DrawingElement(circleShape(junction.x, junction.y, outer * 0.55), stroke),
  ];
}

/** Options for {@link betweenSymbol}. */
export interface BetweenSymbolOptions extends ModifierSymbolOptions {
  /** Reference letter/label placed at the `from` end (e.g. "A"). */
  fromLabel?: string;
  /** Reference letter/label placed at the `to` end (e.g. "B"). */
  toLabel?: string;
}

/**
 * The ASME Y14.5 §8.6 **between** symbol (`↔`): a double-headed arrow spanning
 * `from`→`to` that limits where a profile tolerance applies (e.g. "the profile
 * applies between points A and B"). Optional {@link BetweenSymbolOptions.fromLabel}
 * / {@link BetweenSymbolOptions.toLabel} place the point-identification letters just
 * beyond each arrowhead.
 */
export function betweenSymbol(from: Point, to: Point, options: BetweenSymbolOptions = {}): DxfPrimitive[] {
  const style = resolve(options);
  const len = distance(from, to);
  if (len === 0) throw new Error("betweenSymbol: from and to must differ");
  const dir = normalize(subtractPoints(to, from));
  const back = { x: -dir.x, y: -dir.y };
  const arrowLen = style.sizeMM * 0.9;
  const arrowW = arrowLen * 0.5;
  const stroke = { stroke: { color: style.color, width: style.strokeWidthMM } };
  const out: DxfPrimitive[] = [
    new DrawingElement(new Path().moveTo(from.x, from.y).lineTo(to.x, to.y), stroke),
    arrowhead(to, dir, { length: arrowLen, width: arrowW, color: style.color }),
    arrowhead(from, back, { length: arrowLen, width: arrowW, color: style.color }),
  ];
  const gap = style.sizeMM * 0.6;
  if (options.fromLabel !== undefined) {
    out.push(
      new TextElement({ x: from.x + back.x * gap, y: from.y + back.y * gap - style.sizeMM * 0.35 }, options.fromLabel, {
        size: style.sizeMM,
        anchor: "middle",
        color: style.color,
      }),
    );
  }
  if (options.toLabel !== undefined) {
    out.push(
      new TextElement({ x: to.x + dir.x * gap, y: to.y + dir.y * gap - style.sizeMM * 0.35 }, options.toLabel, {
        size: style.sizeMM,
        anchor: "middle",
        color: style.color,
      }),
    );
  }
  return out;
}

/** Options for {@link continuousFeatureNote}. */
export interface ContinuousFeatureOptions {
  /** Text height in mm. Defaults to 3. */
  textSizeMM?: number;
  /** Defaults to "black". */
  color?: string;
  /** Horizontal text anchor. Defaults to "start" (anchor at the left of the note). */
  anchor?: "start" | "middle" | "end";
}

/**
 * The ASME Y14.5 §7.4.1 **continuous-feature** indicator: the abbreviation `CF`,
 * placed near a group of interrupted features (or their dimension / feature
 * control frame) to specify they are to be treated as one continuous feature of
 * size. `anchor` is the note's baseline reference point.
 */
export function continuousFeatureNote(anchor: Point, options: ContinuousFeatureOptions = {}): DxfPrimitive[] {
  const size = options.textSizeMM ?? 3;
  return [
    new TextElement({ x: anchor.x, y: anchor.y }, "CF", {
      size,
      anchor: options.anchor ?? "start",
      color: options.color ?? "black",
    }),
  ];
}

/** Width of the `CF` continuous-feature note at the given text size (mm), for layout. */
export function continuousFeatureNoteWidth(textSizeMM = 3): number {
  return estimateTextWidth("CF", textSizeMM);
}
