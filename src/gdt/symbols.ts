import { Path } from "../geometry/path.js";
import { circle as circleShape } from "../geometry/shapes.js";
import { normalize, point, subtractPoints, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import { arrowhead } from "../dimension/arrowhead.js";

/**
 * The 14 ASME Y14.5 geometric characteristic symbols. `concentricity` and
 * `symmetry` were deprecated in ASME Y14.5-2018 in favor of position
 * tolerancing, but still appear on legacy drawings and remain part of the
 * traditional 14-symbol chart, so they're included here.
 */
export type GDTCharacteristic =
  | "straightness"
  | "flatness"
  | "circularity"
  | "cylindricity"
  | "profile-line"
  | "profile-surface"
  | "angularity"
  | "perpendicularity"
  | "parallelism"
  | "position"
  | "concentricity"
  | "symmetry"
  | "circular-runout"
  | "total-runout";

/** Style options for {@link renderCharacteristicSymbol}. */
export interface SymbolStyle {
  /** Defaults to 0.25mm. */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

function resolveStroke(style: SymbolStyle) {
  return { stroke: { color: style.color ?? "black", width: style.strokeWidthMM ?? 0.25 } };
}

function seg(strokeOptions: ReturnType<typeof resolveStroke>, x1: number, y1: number, x2: number, y2: number): DrawingElement {
  return new DrawingElement(new Path().moveTo(x1, y1).lineTo(x2, y2), strokeOptions);
}

function runoutArrow(c: Point, s: number, offset: number, style: SymbolStyle): DrawingElement[] {
  const stroke = resolveStroke(style);
  const arrowLen = s * 0.5;
  const tail = point(c.x - s * 0.8, c.y - s * 0.75 + offset);
  const tip = point(c.x + s * 0.55, c.y + s * 0.85 + offset);
  const dir = normalize(subtractPoints(tip, tail));
  const lineEnd = point(tip.x - dir.x * arrowLen, tip.y - dir.y * arrowLen);
  return [
    seg(stroke, tail.x, tail.y, lineEnd.x, lineEnd.y),
    arrowhead(tip, dir, { length: arrowLen, width: arrowLen * 0.45, color: style.color ?? "black" }),
  ];
}

/**
 * The constituent {@link DrawingElement}s of one of the 14 characteristic
 * symbols, centered at `c`, sized to roughly fit a 2s x 2s box. Backs both
 * {@link renderCharacteristicSymbol} (SVG) and the DXF export of feature control
 * frames.
 */
export function characteristicSymbolElements(characteristic: GDTCharacteristic, c: Point, s: number, style: SymbolStyle = {}): DrawingElement[] {
  const stroke = resolveStroke(style);

  switch (characteristic) {
    case "straightness":
      return [seg(stroke, c.x - s, c.y, c.x + s, c.y)];

    case "flatness": {
      const h = s * 0.85;
      const path = new Path()
        .moveTo(c.x - s, c.y - h / 2)
        .lineTo(c.x + s * 0.6, c.y - h / 2)
        .lineTo(c.x + s, c.y + h / 2)
        .lineTo(c.x - s * 0.6, c.y + h / 2)
        .close();
      return [new DrawingElement(path, stroke)];
    }

    case "circularity":
      return [new DrawingElement(circleShape(c.x, c.y, s * 0.8), stroke)];

    case "cylindricity": {
      const r = s * 0.55;
      const circleEl = new DrawingElement(circleShape(c.x, c.y, r), stroke);
      const left = seg(stroke, c.x - s * 0.95, c.y - s * 0.9, c.x - s * 0.55, c.y + s * 0.9);
      const right = seg(stroke, c.x + s * 0.55, c.y - s * 0.9, c.x + s * 0.95, c.y + s * 0.9);
      return [circleEl, left, right];
    }

    case "profile-line": {
      const path = new Path().arc({ center: point(c.x, c.y - s * 0.2), radius: s * 0.8, startAngle: 0, endAngle: Math.PI, counterclockwise: true });
      return [new DrawingElement(path, stroke)];
    }

    case "profile-surface": {
      const path = new Path()
        .arc({ center: point(c.x, c.y - s * 0.2), radius: s * 0.8, startAngle: 0, endAngle: Math.PI, counterclockwise: true })
        .close();
      return [new DrawingElement(path, stroke)];
    }

    case "angularity": {
      const vertex = point(c.x - s * 0.7, c.y - s * 0.6);
      const p1 = point(c.x + s * 0.85, c.y - s * 0.15);
      const p2 = point(c.x - s * 0.15, c.y + s * 0.85);
      const path = new Path().moveTo(p1.x, p1.y).lineTo(vertex.x, vertex.y).lineTo(p2.x, p2.y);
      return [new DrawingElement(path, stroke)];
    }

    case "perpendicularity": {
      const hLine = seg(stroke, c.x - s * 0.8, c.y - s * 0.7, c.x + s * 0.8, c.y - s * 0.7);
      const vLine = seg(stroke, c.x, c.y - s * 0.7, c.x, c.y + s * 0.85);
      return [hLine, vLine];
    }

    case "parallelism": {
      const line1 = seg(stroke, c.x - s * 0.85, c.y - s * 0.35, c.x + s * 0.85, c.y - s * 0.35);
      const line2 = seg(stroke, c.x - s * 0.85, c.y + s * 0.35, c.x + s * 0.85, c.y + s * 0.35);
      return [line1, line2];
    }

    case "position": {
      const circleEl = new DrawingElement(circleShape(c.x, c.y, s * 0.55), stroke);
      const hLine = seg(stroke, c.x - s * 0.85, c.y, c.x + s * 0.85, c.y);
      const vLine = seg(stroke, c.x, c.y - s * 0.85, c.x, c.y + s * 0.85);
      return [circleEl, hLine, vLine];
    }

    case "concentricity": {
      const outer = new DrawingElement(circleShape(c.x, c.y, s * 0.85), stroke);
      const inner = new DrawingElement(circleShape(c.x, c.y, s * 0.4), stroke);
      return [outer, inner];
    }

    case "symmetry": {
      const top = seg(stroke, c.x - s * 0.6, c.y + s * 0.5, c.x + s * 0.6, c.y + s * 0.5);
      const mid = seg(stroke, c.x - s * 0.85, c.y, c.x + s * 0.85, c.y);
      const bottom = seg(stroke, c.x - s * 0.6, c.y - s * 0.5, c.x + s * 0.6, c.y - s * 0.5);
      return [top, mid, bottom];
    }

    case "circular-runout":
      return runoutArrow(c, s, 0, style);

    case "total-runout": {
      const perpOffset = s * 0.32;
      return [...runoutArrow(c, s, -perpOffset / 2, style), ...runoutArrow(c, s, perpOffset / 2, style)];
    }

    default: {
      const exhaustiveCheck: never = characteristic;
      throw new Error(`Unknown GD&T characteristic: ${String(exhaustiveCheck)}`);
    }
  }
}

/** Renders one of the 14 characteristic symbols to SVG, centered at `c`, sized to roughly fit a 2s x 2s box. */
export function renderCharacteristicSymbol(characteristic: GDTCharacteristic, c: Point, s: number, style: SymbolStyle = {}): string {
  return characteristicSymbolElements(characteristic, c, s, style)
    .map((el) => el.toSVG())
    .join("\n");
}
