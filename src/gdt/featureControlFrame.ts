import { rectangle, roundedRectangle, circle as circleShape } from "../geometry/shapes.js";
import { Path } from "../geometry/path.js";
import type { Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";
import { TextElement } from "../svg/text.js";
import { formatFixed } from "../util.js";
import { estimateTextWidth } from "../dimension/label.js";
import { characteristicSymbolElements, type GDTCharacteristic } from "./symbols.js";

/** ASME Y14.5 material condition modifier: maximum (MMC) or least (LMC) material condition. */
export type MaterialCondition = "MMC" | "LMC";

/** One datum reference compartment in a {@link FeatureControlFrame}. */
export interface DatumReferenceSpec {
  /** Datum letter, e.g. "A". */
  letter: string;
  /** Material condition modifier on this datum reference. */
  modifier?: MaterialCondition;
  /**
   * ASME Y14.5 §7.11.9 translation modifier: adds the `▷` symbol after the datum letter and any
   * material modifier, indicating the datum feature simulator is free to translate (is not fixed in
   * location for that datum reference).
   */
  translation?: boolean;
}

/** Options for a {@link FeatureControlFrame}. */
export interface FeatureControlFrameOptions {
  /** Prefixes the tolerance value with the diameter symbol (for a cylindrical tolerance zone). */
  diameter?: boolean;
  /** Material condition modifier on the tolerance value itself. */
  modifier?: MaterialCondition;
  /**
   * ASME Y14.5 §10.3.4 projected tolerance zone: adds the circled `Ⓟ` after the tolerance and any
   * material modifier. Implied when {@link FeatureControlFrameOptions.projectedHeight} is given.
   */
  projectedZone?: boolean;
  /**
   * Minimum height of the projected tolerance zone, rendered after `Ⓟ` (e.g. `⌀0.14 Ⓟ 25`). Omit
   * to show only the `Ⓟ` symbol — the height is then given separately at the projection line.
   */
  projectedHeight?: number;
  /** ASME Y14.5 free-state modifier: adds the circled `Ⓕ` (a tolerance that applies in the part's free/unrestrained state). */
  freeState?: boolean;
  /** ASME Y14.5 tangent-plane modifier: adds the circled `Ⓣ` (the tolerance controls the tangent plane, not the surface). */
  tangentPlane?: boolean;
  /** ASME Y14.5 statistical-tolerance symbol: adds the boxed `ST` after the tolerance (the tolerance is to be held statistically). */
  statistical?: boolean;
  /**
   * ASME Y14.5 §11.3 unequally-disposed-profile modifier: adds the circled `Ⓤ` after the tolerance
   * (e.g. `0.4 Ⓤ 0.1`). Implied when {@link FeatureControlFrameOptions.unequallyDisposedValue} is given.
   */
  unequallyDisposed?: boolean;
  /** The amount of the profile tolerance in the "outward"/plus direction, rendered after `Ⓤ`. Omit to show only the `Ⓤ` symbol. */
  unequallyDisposedValue?: number;
  /** 0 to 3 datum reference compartments, most restrictive first. */
  datums?: readonly DatumReferenceSpec[];
  /** Decimal places for the tolerance value. Defaults to 2. */
  precision?: number;
  /** Defaults to 0.25mm. */
  strokeWidthMM?: number;
  /** Defaults to 3mm. */
  textSizeMM?: number;
  /** Defaults to "black". */
  color?: string;
}

interface ResolvedStyle {
  strokeWidthMM: number;
  textSizeMM: number;
  color: string;
}

function circledLetter(center: Point, letter: string, radius: number, style: ResolvedStyle): DxfPrimitive[] {
  const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };
  const circleEl = new DrawingElement(circleShape(center.x, center.y, radius), strokeOptions);
  const textSize = radius * 1.2;
  const textEl = new TextElement({ x: center.x, y: center.y - textSize * 0.35 }, letter, {
    size: textSize,
    anchor: "middle",
    color: style.color,
  });
  return [circleEl, textEl];
}

/** One compartment's content: a main value plus optional trailing modifiers (material condition, projected-zone `Ⓟ`, free-state `Ⓕ`, tangent-plane `Ⓣ`, unequally-disposed `Ⓤ`). */
interface CellSpec {
  mainText: string;
  modifier?: MaterialCondition;
  /** Adds the circled `Ⓤ` unequally-disposed-profile symbol (rendered right after the value). */
  unequal?: boolean;
  /** Unequal-profile amount, rendered as plain text after `Ⓤ`. */
  unequalText?: string;
  /** Adds the circled `Ⓟ` projected-tolerance-zone symbol. */
  projected?: boolean;
  /** Projected height value, rendered as plain text after `Ⓟ`. */
  heightText?: string;
  /** Adds the circled `Ⓕ` free-state symbol. */
  freeState?: boolean;
  /** Adds the circled `Ⓣ` tangent-plane symbol. */
  tangentPlane?: boolean;
  /** Adds the ASME Y14.5 statistical-tolerance symbol (boxed `ST`) after the value. */
  statistical?: boolean;
  /** Adds the `▷` datum-translation symbol (after the datum letter and any material modifier). */
  translation?: boolean;
}

/** One horizontal piece of a cell (text or circled letter): its width and a draw call given its left edge. */
interface CellSegment {
  width: number;
  draw: (leftX: number, cy: number) => DxfPrimitive[];
}

/** The left-to-right pieces of a cell: main value, then any material modifier, `Ⓟ`, and height. */
function cellSegments(cell: CellSpec, style: ResolvedStyle): CellSegment[] {
  const modRadius = style.textSizeMM * 0.55;
  const centeredText = (text: string): CellSegment => {
    const width = estimateTextWidth(text, style.textSizeMM);
    return {
      width,
      draw: (leftX, cy) => [
        new TextElement({ x: leftX + width / 2, y: cy - style.textSizeMM * 0.35 }, text, { size: style.textSizeMM, anchor: "middle", color: style.color }),
      ],
    };
  };
  const circled = (letter: string): CellSegment => ({
    width: modRadius * 2,
    draw: (leftX, cy) => circledLetter({ x: leftX + modRadius, y: cy }, letter, modRadius, style),
  });
  // ASME Y14.5 statistical-tolerance symbol: the letters "ST" in a rounded (stadium) frame.
  const statisticalSeg = (): CellSegment => {
    const boxH = style.textSizeMM * 1.25;
    const boxW = style.textSizeMM * 1.7;
    return {
      width: boxW,
      draw: (leftX, cy) => {
        const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };
        const box = new DrawingElement(roundedRectangle(leftX, cy - boxH / 2, boxW, boxH, boxH * 0.45), strokeOptions);
        const label = new TextElement({ x: leftX + boxW / 2, y: cy - style.textSizeMM * 0.3 }, "ST", {
          size: style.textSizeMM * 0.8,
          anchor: "middle",
          color: style.color,
        });
        return [box, label];
      },
    };
  };

  // ASME Y14.5 datum-translation symbol: a right-pointing triangle outline (▷).
  const translationSeg = (): CellSegment => {
    const tw = style.textSizeMM * 0.9;
    const th = style.textSizeMM;
    return {
      width: tw,
      draw: (leftX, cy) => {
        const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };
        const tri = new Path()
          .moveTo(leftX, cy - th / 2)
          .lineTo(leftX + tw, cy)
          .lineTo(leftX, cy + th / 2)
          .close();
        return [new DrawingElement(tri, strokeOptions)];
      },
    };
  };

  const segs: CellSegment[] = [centeredText(cell.mainText)];
  if (cell.unequal) segs.push(circled("U"));
  if (cell.unequalText) segs.push(centeredText(cell.unequalText));
  if (cell.modifier) segs.push(circled(cell.modifier === "MMC" ? "M" : "L"));
  if (cell.translation) segs.push(translationSeg());
  if (cell.statistical) segs.push(statisticalSeg());
  if (cell.projected) segs.push(circled("P"));
  if (cell.heightText) segs.push(centeredText(cell.heightText));
  if (cell.freeState) segs.push(circled("F"));
  if (cell.tangentPlane) segs.push(circled("T"));
  return segs;
}

function cellWidth(cell: CellSpec, style: ResolvedStyle): number {
  const segs = cellSegments(cell, style);
  const gap = style.textSizeMM * 0.3;
  return segs.reduce((sum, s) => sum + s.width, 0) + gap * (segs.length - 1);
}

function renderCell(cx: number, cy: number, cell: CellSpec, style: ResolvedStyle): DxfPrimitive[] {
  const segs = cellSegments(cell, style);
  const gap = style.textSizeMM * 0.3;
  const total = segs.reduce((sum, s) => sum + s.width, 0) + gap * (segs.length - 1);
  let x = cx - total / 2;
  const out: DxfPrimitive[] = [];
  for (const s of segs) {
    out.push(...s.draw(x, cy));
    x += s.width + gap;
  }
  return out;
}

/** The tolerance-and-datums content of one feature-control-frame row (everything right of the characteristic symbol). */
export interface FrameSegment {
  /** The tolerance value. */
  toleranceValue: number;
  /** Prefixes the tolerance value with the diameter symbol (a cylindrical tolerance zone). */
  diameter?: boolean;
  /** Material condition modifier on the tolerance value. */
  modifier?: MaterialCondition;
  /** Adds the projected-tolerance-zone `Ⓟ` (implied by `projectedHeight`). */
  projectedZone?: boolean;
  /** Projected-zone minimum height, rendered after `Ⓟ`. */
  projectedHeight?: number;
  /** Adds the free-state `Ⓕ` modifier. */
  freeState?: boolean;
  /** Adds the tangent-plane `Ⓣ` modifier. */
  tangentPlane?: boolean;
  /** Adds the unequally-disposed-profile `Ⓤ` (implied by `unequallyDisposedValue`). */
  unequallyDisposed?: boolean;
  /** Unequally-disposed amount, rendered after `Ⓤ`. */
  unequallyDisposedValue?: number;
  /** Adds the statistical-tolerance symbol (boxed `ST`). */
  statistical?: boolean;
  /** 0 to 3 datum reference compartments, most restrictive first. */
  datums?: readonly DatumReferenceSpec[];
}

/** Builds one row's cells (tolerance cell + datum cells) from a {@link FrameSegment}. Shared by the single and composite frames. */
function segmentCells(seg: FrameSegment, precision: number): CellSpec[] {
  const toleranceText = `${seg.diameter ? "⌀" : ""}${formatFixed(seg.toleranceValue, precision)}`;
  const projected = seg.projectedZone || seg.projectedHeight !== undefined;
  const unequal = seg.unequallyDisposed || seg.unequallyDisposedValue !== undefined;
  const datums = seg.datums ?? [];
  return [
    {
      mainText: toleranceText,
      ...(seg.modifier ? { modifier: seg.modifier } : {}),
      unequal,
      ...(seg.unequallyDisposedValue !== undefined ? { unequalText: formatFixed(seg.unequallyDisposedValue, precision) } : {}),
      projected,
      ...(seg.projectedHeight !== undefined ? { heightText: formatFixed(seg.projectedHeight, precision) } : {}),
      freeState: seg.freeState ?? false,
      tangentPlane: seg.tangentPlane ?? false,
      statistical: seg.statistical ?? false,
    },
    ...datums.map((d): CellSpec => ({
      mainText: d.letter,
      ...(d.modifier ? { modifier: d.modifier } : {}),
      ...(d.translation ? { translation: true } : {}),
    })),
  ];
}

/**
 * A GD&T feature control frame: [characteristic symbol] | [tolerance, optional
 * diameter prefix and modifiers — material condition `Ⓜ`/`Ⓛ`, unequally-disposed
 * `Ⓤ`, projected-zone `Ⓟ`, free-state `Ⓕ`, tangent-plane `Ⓣ`] | [0-3 datum
 * references, each with its own optional modifier] — the standard compartmented
 * box. `anchor` is the frame's bottom-left corner; the frame grows rightward from
 * there.
 */
export class FeatureControlFrame implements Renderable, Explodable {
  constructor(
    private readonly anchor: Point,
    private readonly characteristic: GDTCharacteristic,
    private readonly toleranceValue: number,
    private readonly options: FeatureControlFrameOptions = {},
  ) {}

  /** The frame's constituent geometry/text primitives, in draw order (box, dividers, symbol, cell contents). */
  toElements(): DxfPrimitive[] {
    const style: ResolvedStyle = {
      strokeWidthMM: this.options.strokeWidthMM ?? 0.25,
      textSizeMM: this.options.textSizeMM ?? 3,
      color: this.options.color ?? "black",
    };
    const precision = this.options.precision ?? 2;
    const h = style.textSizeMM * 2.6;
    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };

    const cells = segmentCells({ toleranceValue: this.toleranceValue, ...this.options }, precision);

    const symbolWidth = h * 1.3;
    const padding = h * 0.35;
    const cellWidths = cells.map((c) => Math.max(h * 0.9, cellWidth(c, style) + padding * 2));
    const widths = [symbolWidth, ...cellWidths];
    const totalWidth = widths.reduce((a, b) => a + b, 0);

    const parts: DxfPrimitive[] = [new DrawingElement(rectangle(this.anchor.x, this.anchor.y, totalWidth, h), strokeOptions)];

    let x = this.anchor.x;
    const cy = this.anchor.y + h / 2;
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i]!;
      if (i > 0) {
        parts.push(new DrawingElement(new Path().moveTo(x, this.anchor.y).lineTo(x, this.anchor.y + h), strokeOptions));
      }
      const cx = x + w / 2;
      if (i === 0) {
        parts.push(...characteristicSymbolElements(this.characteristic, { x: cx, y: cy }, h * 0.35, style));
      } else {
        const cell = cells[i - 1]!;
        parts.push(...renderCell(cx, cy, cell, style));
      }
      x += w;
    }

    return parts;
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}

/** One row of a {@link MultipleSingleSegmentFrame}: a full single-segment control with its own characteristic symbol. */
export interface SingleSegmentRow extends FrameSegment {
  /** The geometric characteristic for this row (each row is an independent control, so rows may differ). */
  characteristic: GDTCharacteristic;
}

/** Options for a {@link MultipleSingleSegmentFrame} (same style options as the composite frame). */
export type MultipleSingleSegmentFrameOptions = CompositeFeatureControlFrameOptions;

/**
 * An ASME Y14.5 §10.5.3 **multiple single-segment** feature control frame: two or more complete,
 * independent single-segment controls stacked into one frame — each row has its **own** characteristic
 * symbol (unlike a {@link CompositeFeatureControlFrame}, which draws one symbol spanning all rows). The
 * horizontal dividers therefore span the full width, including through the symbol column. Rows are
 * commonly the same characteristic (e.g. two position controls) referencing different datums, but each
 * row may carry a different characteristic.
 *
 * Compartment columns (symbol, tolerance, and datum columns) are aligned across rows; a row with fewer
 * datums has its last compartment extended to the frame's right edge. `anchor` is the frame's
 * bottom-left corner.
 */
export class MultipleSingleSegmentFrame implements Renderable, Explodable {
  constructor(
    private readonly anchor: Point,
    private readonly rows: readonly SingleSegmentRow[],
    private readonly options: MultipleSingleSegmentFrameOptions = {},
  ) {
    if (rows.length < 2) throw new Error("A multiple single-segment frame needs at least two rows");
  }

  /** The frame's constituent geometry/text primitives, in draw order (box, then each row's symbol, dividers, and cell contents). */
  toElements(): DxfPrimitive[] {
    const style: ResolvedStyle = {
      strokeWidthMM: this.options.strokeWidthMM ?? 0.25,
      textSizeMM: this.options.textSizeMM ?? 3,
      color: this.options.color ?? "black",
    };
    const precision = this.options.precision ?? 2;
    const rowH = style.textSizeMM * 2.6;
    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };

    const rowCells = this.rows.map((s) => segmentCells(s, precision));
    const nRows = rowCells.length;
    const padding = rowH * 0.35;
    const symbolWidth = rowH * 1.3;

    // Aligned data columns (tolerance + datums), max over the rows that have a cell there.
    const maxCols = Math.max(...rowCells.map((r) => r.length));
    const colWidths: number[] = [];
    for (let j = 0; j < maxCols; j++) {
      let w = 0;
      for (const r of rowCells) {
        const cell = r[j];
        if (cell) w = Math.max(w, cellWidth(cell, style) + padding * 2);
      }
      colWidths.push(Math.max(rowH * 0.9, w));
    }

    const totalWidth = symbolWidth + colWidths.reduce((a, b) => a + b, 0);
    const totalH = rowH * nRows;
    const right = this.anchor.x + totalWidth;

    const parts: DxfPrimitive[] = [new DrawingElement(rectangle(this.anchor.x, this.anchor.y, totalWidth, totalH), strokeOptions)];

    // Rows run top to bottom: row 0 is the top row.
    for (let i = 0; i < nRows; i++) {
      const rowTop = this.anchor.y + totalH - i * rowH;
      const rowBottom = rowTop - rowH;
      const cy = rowBottom + rowH / 2;
      if (i > 0) {
        // Full-width horizontal divider between the independent controls.
        parts.push(new DrawingElement(new Path().moveTo(this.anchor.x, rowTop).lineTo(right, rowTop), strokeOptions));
      }
      // This row's own characteristic symbol.
      parts.push(new DrawingElement(new Path().moveTo(this.anchor.x + symbolWidth, rowBottom).lineTo(this.anchor.x + symbolWidth, rowTop), strokeOptions));
      parts.push(...characteristicSymbolElements(this.rows[i]!.characteristic, { x: this.anchor.x + symbolWidth / 2, y: cy }, rowH * 0.35, style));

      const cells = rowCells[i]!;
      let x = this.anchor.x + symbolWidth;
      for (let j = 0; j < cells.length; j++) {
        const isLast = j === cells.length - 1;
        const w = isLast ? right - x : colWidths[j]!;
        if (j > 0) {
          parts.push(new DrawingElement(new Path().moveTo(x, rowBottom).lineTo(x, rowTop), strokeOptions));
        }
        parts.push(...renderCell(x + w / 2, cy, cells[j]!, style));
        x += w;
      }
    }

    return parts;
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}

/** Options for a {@link CompositeFeatureControlFrame}. */
export interface CompositeFeatureControlFrameOptions {
  /** Decimal places for tolerance values. Defaults to 2. */
  precision?: number;
  /** Defaults to 0.25mm. */
  strokeWidthMM?: number;
  /** Defaults to 3mm. */
  textSizeMM?: number;
  /** Defaults to "black". */
  color?: string;
}

/**
 * An ASME Y14.5 **composite** feature control frame: a single characteristic symbol (drawn once, in
 * a tall cell spanning the full height) followed by two or more stacked tolerance-zone rows. The
 * upper row is the pattern-locating tolerance zone framework (PLTZF); each lower row is a
 * feature-relating tolerance zone framework (FRTZF), typically a tighter tolerance referencing fewer
 * datums. This differs from stacking separate {@link FeatureControlFrame}s, where each frame repeats
 * the symbol.
 *
 * Compartment columns are aligned across rows (the tolerance column and datum columns line up); a row
 * with fewer datums has its last compartment extended to the frame's right edge. `anchor` is the
 * frame's bottom-left corner.
 */
export class CompositeFeatureControlFrame implements Renderable, Explodable {
  constructor(
    private readonly anchor: Point,
    private readonly characteristic: GDTCharacteristic,
    private readonly segments: readonly FrameSegment[],
    private readonly options: CompositeFeatureControlFrameOptions = {},
  ) {
    if (segments.length < 2) throw new Error("A composite feature control frame needs at least two tolerance-zone rows");
  }

  /** The frame's constituent geometry/text primitives, in draw order (box, shared symbol, then each row's dividers and cell contents). */
  toElements(): DxfPrimitive[] {
    const style: ResolvedStyle = {
      strokeWidthMM: this.options.strokeWidthMM ?? 0.25,
      textSizeMM: this.options.textSizeMM ?? 3,
      color: this.options.color ?? "black",
    };
    const precision = this.options.precision ?? 2;
    const rowH = style.textSizeMM * 2.6;
    const strokeOptions = { stroke: { color: style.color, width: style.strokeWidthMM } };

    const rows = this.segments.map((s) => segmentCells(s, precision));
    const nRows = rows.length;
    const padding = rowH * 0.35;

    // Aligned columns: each column's width is the max over the rows that have a cell there.
    const maxCols = Math.max(...rows.map((r) => r.length));
    const colWidths: number[] = [];
    for (let j = 0; j < maxCols; j++) {
      let w = 0;
      for (const r of rows) {
        const cell = r[j];
        if (cell) w = Math.max(w, cellWidth(cell, style) + padding * 2);
      }
      colWidths.push(Math.max(rowH * 0.9, w));
    }

    const symbolWidth = rowH * 1.3;
    const totalWidth = symbolWidth + colWidths.reduce((a, b) => a + b, 0);
    const totalH = rowH * nRows;
    const right = this.anchor.x + totalWidth;
    const symbolRight = this.anchor.x + symbolWidth;

    const parts: DxfPrimitive[] = [
      new DrawingElement(rectangle(this.anchor.x, this.anchor.y, totalWidth, totalH), strokeOptions),
      // The shared characteristic symbol spans the full height; its divider runs top to bottom.
      new DrawingElement(new Path().moveTo(symbolRight, this.anchor.y).lineTo(symbolRight, this.anchor.y + totalH), strokeOptions),
      ...characteristicSymbolElements(this.characteristic, { x: this.anchor.x + symbolWidth / 2, y: this.anchor.y + totalH / 2 }, rowH * 0.35, style),
    ];

    // Rows run top to bottom: segment 0 (PLTZF) is the top row.
    for (let i = 0; i < nRows; i++) {
      const rowTop = this.anchor.y + totalH - i * rowH;
      const rowBottom = rowTop - rowH;
      const cy = rowBottom + rowH / 2;
      if (i > 0) {
        // Horizontal divider between rows — right of the symbol cell only.
        parts.push(new DrawingElement(new Path().moveTo(symbolRight, rowTop).lineTo(right, rowTop), strokeOptions));
      }
      const cells = rows[i]!;
      let x = symbolRight;
      for (let j = 0; j < cells.length; j++) {
        const isLast = j === cells.length - 1;
        const w = isLast ? right - x : colWidths[j]!;
        if (j > 0) {
          parts.push(new DrawingElement(new Path().moveTo(x, rowBottom).lineTo(x, rowTop), strokeOptions));
        }
        parts.push(...renderCell(x + w / 2, cy, cells[j]!, style));
        x += w;
      }
    }

    return parts;
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}
