import { rectangle } from "../geometry/shapes.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive } from "../svg/renderable.js";
import { TextElement } from "../svg/text.js";
import { projectionSymbolElements, type ProjectionAngle } from "./projectionSymbol.js";

/** Field values for a {@link TitleBlock}. */
export interface TitleBlockFields {
  /** Part/drawing title, shown large in the TITLE cell. */
  title: string;
  /** Shown in the DWG NO cell. */
  drawingNumber: string;
  /** Shown in the REV cell. */
  revision?: string;
  /** Sheet size letter/code, e.g. "A", "A4". Defaults to the Sheet's paper size when rendered. */
  size?: string | undefined;
  /** Shown in the SCALE cell, e.g. "1:1". */
  scale?: string;
  /** Shown in the SHEET cell, e.g. "1 OF 1". */
  sheet?: string;
  /** Shown in the MATERIAL cell. */
  material?: string;
  /** Shown in the FINISH cell. */
  finish?: string;
  /** Short lines of a general tolerance note, e.g. ["X.XX = ±0.01", "ANGLES = ±0.5°"]. */
  generalTolerance?: readonly string[];
  /** Renders the ISO 128 / ASME Y14.3 first/third-angle projection pictogram. Omitted if unset. */
  projection?: ProjectionAngle;
  /** Name shown in the DRAWN signoff row. */
  drawnBy?: string;
  /** Date shown in the DRAWN signoff row. */
  drawnDate?: string;
  /** Name shown in the CHECKED signoff row. */
  checkedBy?: string;
  /** Date shown in the CHECKED signoff row. */
  checkedDate?: string;
  /** Name shown in the ENG APPR. signoff row. */
  engApprovedBy?: string;
  /** Date shown in the ENG APPR. signoff row. */
  engApprovedDate?: string;
  /** Name shown in the MFG APPR. signoff row. */
  mfgApprovedBy?: string;
  /** Date shown in the MFG APPR. signoff row. */
  mfgApprovedDate?: string;
}

/** A cell showing a small corner label plus either a single large value or a few small stacked lines. */
interface LabeledCell {
  kind: "labeled";
  widthFraction: number;
  label: string;
  value?: string | undefined;
  lines?: readonly string[] | undefined;
  valueSize?: number;
  align?: "start" | "middle";
}

/** A cell showing only centered/static text, no corner label (row captions, column headers). */
interface CaptionCell {
  kind: "caption";
  widthFraction: number;
  text: string;
  size?: number;
  bold?: boolean;
}

/** An empty cell reserved for a pictogram (drawn separately after the grid). */
interface PictogramCell {
  kind: "pictogram";
  widthFraction: number;
  label: string;
}

type Cell = LabeledCell | CaptionCell | PictogramCell;

interface Row {
  heightMM: number;
  cells: Cell[];
}

/** Layout/style options for a {@link TitleBlock}. */
export interface TitleBlockOptions {
  /** Preferred overall width in mm; clamped to fit the sheet's drawing width if narrower. */
  widthMM?: number;
  /** Corner-label text size. Defaults to 2mm. */
  labelSize?: number;
  /** Field-value text size. Defaults to 3mm. */
  valueSize?: number;
  /** Defaults to 0.25mm. */
  strokeWidthMM?: number;
}

/** Sheet-provided context passed to {@link TitleBlockLike.render}. */
export interface TitleBlockRenderContext {
  /** Full sheet width, in mm. */
  sheetWidthMM: number;
  /** Sheet margin, in mm. */
  marginMM: number;
  /** Falls back for fields.size when not explicitly set on the TitleBlock's fields. */
  paperSizeLabel?: string;
}

/** What `Sheet.setTitleBlock()` requires — satisfied by `TitleBlock`, `GridTitleBlock`, `ISO7200TitleBlock`, or any custom implementation. */
export interface TitleBlockLike {
  /** Total title-block height in mm, so `Sheet` can size the drawing area above it. */
  readonly heightMM: number;
  /** Renders the title block's SVG markup, anchored to the sheet's bottom-right. */
  render(ctx: TitleBlockRenderContext): string;
  /**
   * Optional: the title block's constituent `DrawingElement`/`TextElement` pieces (from which
   * `render` is derived), so `exportDXF` can emit it as real DXF geometry/text via a
   * `{ titleBlock, context }` input. The built-in title blocks implement this; a custom title block
   * that only provides `render` still works on a `Sheet` but can't be DXF-exported.
   */
  renderElements?(ctx: TitleBlockRenderContext): DxfPrimitive[];
}

// header, drawn, checked, eng appr, mfg appr — 5 even rows (38 / 5 = 7.6mm each), so every
// divider sits at a regular interval and no row (or its line) looks like an odd one out.
const LEFT_ROW_HEIGHT_MM = 7.6;
const LEFT_ROW_HEIGHTS_MM = [LEFT_ROW_HEIGHT_MM, LEFT_ROW_HEIGHT_MM, LEFT_ROW_HEIGHT_MM, LEFT_ROW_HEIGHT_MM, LEFT_ROW_HEIGHT_MM] as const;
const RIGHT_ROW_HEIGHTS_MM = [8, 14, 8, 8] as const; // size/dwg/rev, title, material/finish/tol/proj, scale/sheet
const LEFT_WIDTH_FRACTION = 0.42;

/**
 * A classic bottom-right "corner block" title block, the layout most engineering
 * drawings use: a signoff block (name/date rows) on the left, and drawing
 * identification (size, number, revision, title, scale, sheet) on the right.
 * Anchored to the bottom-right of the sheet; does not span the full sheet width.
 */
export class TitleBlock implements TitleBlockLike {
  readonly heightMM: number = LEFT_ROW_HEIGHTS_MM.reduce((a, b) => a + b, 0);

  private readonly preferredWidthMM: number;
  private readonly labelSize: number;
  private readonly valueSize: number;
  private readonly strokeWidthMM: number;

  constructor(
    private readonly fields: TitleBlockFields,
    options: TitleBlockOptions = {},
  ) {
    this.preferredWidthMM = options.widthMM ?? 190;
    this.labelSize = options.labelSize ?? 2;
    this.valueSize = options.valueSize ?? 3;
    this.strokeWidthMM = options.strokeWidthMM ?? 0.25;
  }

  private leftRows(f: TitleBlockFields): Row[] {
    const signoff = (label: string, name: string | undefined, date: string | undefined): Row => ({
      heightMM: LEFT_ROW_HEIGHT_MM,
      cells: [
        { kind: "caption", widthFraction: 0.25, text: label, size: this.labelSize * 0.95 },
        { kind: "labeled", widthFraction: 0.475, label: "", value: name, align: "middle" },
        { kind: "labeled", widthFraction: 0.275, label: "", value: date, align: "middle" },
      ],
    });
    return [
      {
        heightMM: LEFT_ROW_HEIGHTS_MM[0],
        cells: [
          { kind: "caption", widthFraction: 0.25, text: "" },
          { kind: "caption", widthFraction: 0.475, text: "NAME", size: this.labelSize },
          { kind: "caption", widthFraction: 0.275, text: "DATE", size: this.labelSize },
        ],
      },
      signoff("DRAWN", f.drawnBy, f.drawnDate),
      signoff("CHECKED", f.checkedBy, f.checkedDate),
      signoff("ENG APPR.", f.engApprovedBy, f.engApprovedDate),
      signoff("MFG APPR.", f.mfgApprovedBy, f.mfgApprovedDate),
    ];
  }

  private rightRows(f: TitleBlockFields): Row[] {
    return [
      {
        heightMM: RIGHT_ROW_HEIGHTS_MM[0],
        cells: [
          { kind: "labeled", widthFraction: 0.16, label: "SIZE", value: f.size, valueSize: this.valueSize },
          { kind: "labeled", widthFraction: 0.65, label: "DWG NO", value: f.drawingNumber, valueSize: this.valueSize },
          { kind: "labeled", widthFraction: 0.19, label: "REV", value: f.revision, valueSize: this.valueSize },
        ],
      },
      {
        heightMM: RIGHT_ROW_HEIGHTS_MM[1],
        cells: [{ kind: "labeled", widthFraction: 1, label: "TITLE", value: f.title, valueSize: this.valueSize * 1.3 }],
      },
      {
        heightMM: RIGHT_ROW_HEIGHTS_MM[2],
        cells: [
          { kind: "labeled", widthFraction: 0.25, label: "MATERIAL", value: f.material },
          { kind: "labeled", widthFraction: 0.25, label: "FINISH", value: f.finish },
          { kind: "labeled", widthFraction: 0.31, label: "TOLERANCES", lines: f.generalTolerance },
          { kind: "pictogram", widthFraction: 0.19, label: "PROJ" },
        ],
      },
      {
        heightMM: RIGHT_ROW_HEIGHTS_MM[3],
        cells: [
          { kind: "labeled", widthFraction: 0.5, label: "SCALE", value: f.scale, valueSize: this.valueSize },
          { kind: "labeled", widthFraction: 0.5, label: "SHEET", value: f.sheet, valueSize: this.valueSize },
        ],
      },
    ];
  }

  private columnElements(x0: number, y0: number, width: number, rows: Row[], projection: ProjectionAngle | undefined): DxfPrimitive[] {
    const parts: DxfPrimitive[] = [];
    const strokeOptions = { stroke: { color: "black", width: this.strokeWidthMM } };
    let rowY = y0 + this.heightMM;

    for (const row of rows) {
      rowY -= row.heightMM;
      let cellX = x0;
      for (const cell of row.cells) {
        const cellWidth = width * cell.widthFraction;
        parts.push(new DrawingElement(rectangle(cellX, rowY, cellWidth, row.heightMM), strokeOptions));

        if (cell.kind === "caption") {
          if (cell.text) {
            parts.push(
              new TextElement({ x: cellX + cellWidth / 2, y: rowY + row.heightMM / 2 - (cell.size ?? this.labelSize) * 0.35 }, cell.text, {
                size: cell.size ?? this.labelSize,
                anchor: "middle",
                weight: cell.bold ? "bold" : "normal",
              }),
            );
          }
        } else if (cell.kind === "labeled") {
          if (cell.label) {
            parts.push(
              new TextElement({ x: cellX + 1.3, y: rowY + row.heightMM - this.labelSize * 1.15 }, cell.label, {
                size: this.labelSize,
                anchor: "start",
                color: "#555555",
              }),
            );
          }
          if (cell.lines && cell.lines.length > 0) {
            const lineSize = this.labelSize * 1.05;
            const startY = rowY + row.heightMM - this.labelSize * 1.15 - lineSize * 1.3;
            cell.lines.forEach((line, i) => {
              parts.push(
                new TextElement({ x: cellX + 1.3, y: startY - i * lineSize * 1.3 }, line, {
                  size: lineSize,
                  anchor: "start",
                }),
              );
            });
          } else if (cell.value) {
            const align = cell.align ?? "middle";
            const x = align === "middle" ? cellX + cellWidth / 2 : cellX + 1.3;
            parts.push(
              new TextElement({ x, y: rowY + 2.3 }, cell.value, {
                size: cell.valueSize ?? this.valueSize,
                anchor: align,
                weight: "bold",
              }),
            );
          }
        } else {
          if (projection) {
            parts.push(
              ...projectionSymbolElements({ x: cellX + cellWidth / 2, y: rowY + row.heightMM / 2 - 0.5 }, projection, {
                strokeWidthMM: this.strokeWidthMM,
                size: 2.6,
              }),
            );
          }
        }
        cellX += cellWidth;
      }
    }
    return parts;
  }

  /** The title block's constituent geometry/text primitives, in draw order (outer box, left column, right column). */
  renderElements(ctx: TitleBlockRenderContext): DxfPrimitive[] {
    const width = Math.min(this.preferredWidthMM, ctx.sheetWidthMM - 2 * ctx.marginMM);
    const x0 = ctx.sheetWidthMM - ctx.marginMM - width;
    const y0 = ctx.marginMM;
    const leftWidth = width * LEFT_WIDTH_FRACTION;
    const rightWidth = width - leftWidth;
    const f: TitleBlockFields = this.fields.size ? this.fields : { ...this.fields, size: ctx.paperSizeLabel };

    return [
      new DrawingElement(rectangle(x0, y0, width, this.heightMM), { stroke: { color: "black", width: this.strokeWidthMM } }),
      ...this.columnElements(x0, y0, leftWidth, this.leftRows(f), undefined),
      ...this.columnElements(x0 + leftWidth, y0, rightWidth, this.rightRows(f), f.projection),
    ];
  }

  render(ctx: TitleBlockRenderContext): string {
    return this.renderElements(ctx)
      .map((el) => el.toSVG())
      .join("\n");
  }
}
