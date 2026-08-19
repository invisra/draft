import { rectangle } from "../geometry/shapes.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive } from "../svg/renderable.js";
import { TextElement } from "../svg/text.js";

/** A cell showing a small corner label plus either a single large value or a few small stacked lines. */
export interface LabeledCell {
  /** Discriminant for the {@link GridCell} union. */
  kind: "labeled";
  /** Fraction (0-1) of the row's total width. */
  widthFraction: number;
  /** Small corner label, e.g. "SIZE", "DWG NO". Omit (empty string) for a value-only cell. */
  label: string;
  /** Large single value, bold, aligned per `align`. Ignored if `lines` is set. */
  value?: string | undefined;
  /** A few small stacked lines instead of one large value (e.g. a multi-line tolerance note). */
  lines?: readonly string[] | undefined;
  /** Overrides the value's text size. */
  valueSize?: number;
  /** Value alignment within the cell. Defaults to "middle". */
  align?: "start" | "middle";
}

/** A cell showing only static text, no corner label (row captions, column headers, table cells). */
export interface CaptionCell {
  /** Discriminant for the {@link GridCell} union. */
  kind: "caption";
  /** Fraction (0-1) of the row's total width. */
  widthFraction: number;
  /** The text to show. */
  text: string;
  /** Overrides the text size. */
  size?: number;
  /** Bold weight. Defaults to false. */
  bold?: boolean;
  /** Defaults to "middle" (centered). "start" left-aligns with a small inset — better for longer free text. */
  align?: "start" | "middle";
}

/** A single cell in a {@link GridRow}: either a {@link LabeledCell} or a {@link CaptionCell}. */
export type GridCell = LabeledCell | CaptionCell;

/** One row of a title-block-style grid, rendered by {@link renderGridColumn}. */
export interface GridRow {
  /** Row height, in mm. */
  heightMM: number;
  /** Cells, left to right, filling the row's full width. */
  cells: GridCell[];
}

/** Shared text/stroke style for {@link renderGridColumn}. */
export interface GridStyle {
  /** Corner-label text size. */
  labelSize: number;
  /** Value text size. */
  valueSize: number;
  /** Cell border stroke width, in mm. */
  strokeWidthMM: number;
  /** Defaults to "black". */
  color?: string | undefined;
}

/** Sums a column's row heights — the total height `renderGridColumn` will occupy. */
export function gridHeight(rows: readonly GridRow[]): number {
  return rows.reduce((a, r) => a + r.heightMM, 0);
}

/**
 * The constituent {@link DrawingElement}/{@link TextElement} pieces of one column
 * of a title-block-style grid: bordered cells, each either a small corner label
 * with a large value (or a few small stacked lines), or plain caption text. Backs
 * both {@link renderGridColumn} (SVG) and the DXF export of every title block and
 * table that builds on this grid.
 */
export function gridColumnElements(x0: number, y0: number, width: number, rows: readonly GridRow[], style: GridStyle): DxfPrimitive[] {
  const parts: DxfPrimitive[] = [];
  const color = style.color ?? "black";
  const strokeOptions = { stroke: { color, width: style.strokeWidthMM } };
  const totalHeight = gridHeight(rows);
  let rowY = y0 + totalHeight;

  for (const row of rows) {
    rowY -= row.heightMM;
    let cellX = x0;
    for (const cell of row.cells) {
      const cellWidth = width * cell.widthFraction;
      parts.push(new DrawingElement(rectangle(cellX, rowY, cellWidth, row.heightMM), strokeOptions));

      if (cell.kind === "caption") {
        if (cell.text) {
          const align = cell.align ?? "middle";
          const x = align === "middle" ? cellX + cellWidth / 2 : cellX + 1.3;
          parts.push(
            new TextElement({ x, y: rowY + row.heightMM / 2 - (cell.size ?? style.labelSize) * 0.35 }, cell.text, {
              size: cell.size ?? style.labelSize,
              anchor: align,
              weight: cell.bold ? "bold" : "normal",
              color,
            }),
          );
        }
      } else {
        if (cell.label) {
          parts.push(
            new TextElement({ x: cellX + 1.3, y: rowY + row.heightMM - style.labelSize * 1.15 }, cell.label, {
              size: style.labelSize,
              anchor: "start",
              color: "#555555",
            }),
          );
        }
        if (cell.lines && cell.lines.length > 0) {
          const lineSize = style.labelSize * 1.05;
          const startY = rowY + row.heightMM - style.labelSize * 1.15 - lineSize * 1.3;
          cell.lines.forEach((line, i) => {
            parts.push(new TextElement({ x: cellX + 1.3, y: startY - i * lineSize * 1.3 }, line, { size: lineSize, anchor: "start", color }));
          });
        } else if (cell.value) {
          const align = cell.align ?? "middle";
          const x = align === "middle" ? cellX + cellWidth / 2 : cellX + 1.3;
          parts.push(
            new TextElement({ x, y: rowY + 2.3 }, cell.value, {
              size: cell.valueSize ?? style.valueSize,
              anchor: align,
              weight: "bold",
              color,
            }),
          );
        }
      }
      cellX += cellWidth;
    }
  }
  return parts;
}

/**
 * Renders one column of a title-block-style grid to SVG. Shared by `TitleBlock`,
 * `GridTitleBlock`, and `ISO7200TitleBlock` — the same visual language across
 * every title block style. See {@link gridColumnElements} for the element list
 * the DXF export uses.
 */
export function renderGridColumn(x0: number, y0: number, width: number, rows: readonly GridRow[], style: GridStyle): string {
  return gridColumnElements(x0, y0, width, rows, style)
    .map((el) => el.toSVG())
    .join("\n");
}
