import { Path } from "../geometry/path.js";
import { rectangle } from "../geometry/shapes.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive } from "../svg/renderable.js";
import { TextElement } from "../svg/text.js";

/** `Sheet`'s border style: a single plain frame, or one with a zone reference grid. */
export type BorderStyle = "plain" | "zoned";

/** Options for {@link renderPlainBorder}. */
export interface BorderOptions {
  /** Defaults to 0.5mm. */
  strokeWidthMM?: number;
}

/** Options for {@link renderZonedBorder}. */
export interface ZonedBorderOptions extends BorderOptions {
  /** Approximate zone size; the actual count is rounded to divide each edge evenly. Defaults to 50mm, per common practice. */
  targetZoneSizeMM?: number;
  /** Stroke width of the zone-divider tick marks. Defaults to 0.2mm. */
  tickStrokeWidthMM?: number;
  /** Font size of the row/column zone labels. Defaults to 2.5mm. */
  labelSizeMM?: number;
}

// I and O are conventionally skipped: too easily confused with the digits 1 and 0.
const ZONE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function zoneLetters(count: number): string[] {
  if (count > ZONE_LETTERS.length) {
    throw new Error(`Zoned border needs ${count} row zones, but only ${ZONE_LETTERS.length} unambiguous letters are available`);
  }
  return ZONE_LETTERS.slice(0, count).split("");
}

/** The sheet's outer frame as a single element: a rectangle inset from the paper edge by the margin. Backs {@link renderPlainBorder} and the DXF export. */
export function plainBorderElements(widthMM: number, heightMM: number, marginMM: number, options: BorderOptions = {}): DxfPrimitive[] {
  const strokeWidth = options.strokeWidthMM ?? 0.5;
  const path = rectangle(marginMM, marginMM, widthMM - 2 * marginMM, heightMM - 2 * marginMM);
  return [new DrawingElement(path, { stroke: { color: "black", width: strokeWidth } })];
}

/** The sheet's outer frame: a single rectangle inset from the paper edge by the margin. */
export function renderPlainBorder(widthMM: number, heightMM: number, marginMM: number, options: BorderOptions = {}): string {
  return plainBorderElements(widthMM, heightMM, marginMM, options)
    .map((el) => el.toSVG())
    .join("\n");
}

/** The zoned border's constituent elements (frame + zone ticks + row/column labels). Backs {@link renderZonedBorder} and the DXF export. */
export function zonedBorderElements(widthMM: number, heightMM: number, marginMM: number, options: ZonedBorderOptions = {}): DxfPrimitive[] {
  const strokeWidth = options.strokeWidthMM ?? 0.5;
  const tickStroke = options.tickStrokeWidthMM ?? 0.2;
  const labelSize = options.labelSizeMM ?? 2.5;
  const targetZoneSize = options.targetZoneSizeMM ?? 50;

  const innerWidth = widthMM - 2 * marginMM;
  const innerHeight = heightMM - 2 * marginMM;
  const numCols = Math.max(2, Math.round(innerWidth / targetZoneSize));
  const numRows = Math.max(2, Math.round(innerHeight / targetZoneSize));
  const colWidth = innerWidth / numCols;
  const rowHeight = innerHeight / numRows;

  const parts: DxfPrimitive[] = [...plainBorderElements(widthMM, heightMM, marginMM, { strokeWidthMM: strokeWidth })];
  const tickOptions = { stroke: { color: "black", width: tickStroke } };

  for (let i = 1; i < numCols; i++) {
    const x = marginMM + i * colWidth;
    parts.push(new DrawingElement(new Path().moveTo(x, heightMM - marginMM).lineTo(x, heightMM), tickOptions));
    parts.push(new DrawingElement(new Path().moveTo(x, 0).lineTo(x, marginMM), tickOptions));
  }
  for (let i = 1; i < numRows; i++) {
    const y = marginMM + i * rowHeight;
    parts.push(new DrawingElement(new Path().moveTo(0, y).lineTo(marginMM, y), tickOptions));
    parts.push(new DrawingElement(new Path().moveTo(widthMM - marginMM, y).lineTo(widthMM, y), tickOptions));
  }

  for (let i = 0; i < numCols; i++) {
    const cx = marginMM + (i + 0.5) * colWidth;
    const label = String(i + 1);
    parts.push(new TextElement({ x: cx, y: heightMM - marginMM / 2 - labelSize * 0.35 }, label, { size: labelSize, anchor: "middle" }));
    parts.push(new TextElement({ x: cx, y: marginMM / 2 - labelSize * 0.35 }, label, { size: labelSize, anchor: "middle" }));
  }

  const letters = zoneLetters(numRows);
  for (let i = 0; i < numRows; i++) {
    const cy = heightMM - marginMM - (i + 0.5) * rowHeight;
    const label = letters[i] as string;
    parts.push(new TextElement({ x: marginMM / 2, y: cy - labelSize * 0.35 }, label, { size: labelSize, anchor: "middle" }));
    parts.push(new TextElement({ x: widthMM - marginMM / 2, y: cy - labelSize * 0.35 }, label, { size: labelSize, anchor: "middle" }));
  }

  return parts;
}

/**
 * The border frame plus a map-style zone reference grid in the margin strip: numbered
 * columns along the top/bottom (1, 2, 3... left to right) and lettered rows along the
 * sides (A, B, C... top to bottom), so a location can be called out like "zone C3" —
 * used by revision callouts. Follows the numbering/lettering direction documented for
 * ISO 5457; exact starting corner varies a little across ASME/company templates in
 * practice, so treat the direction here as a sensible default rather than gospel.
 */
export function renderZonedBorder(widthMM: number, heightMM: number, marginMM: number, options: ZonedBorderOptions = {}): string {
  return zonedBorderElements(widthMM, heightMM, marginMM, options)
    .map((el) => el.toSVG())
    .join("\n");
}
