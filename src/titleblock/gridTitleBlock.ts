import { rectangle } from "../geometry/shapes.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive } from "../svg/renderable.js";
import { gridColumnElements, gridHeight, type GridRow } from "./grid.js";
import type { TitleBlockLike, TitleBlockRenderContext } from "./titleBlock.js";

/** One column of a {@link GridTitleBlock}: a fraction of the total width, plus its own stack of rows. */
export interface GridColumn {
  /** Fraction (0-1) of the title block's total width. */
  widthFraction: number;
  /** This column's rows, top to bottom. Every column's row heights must sum to the same total. */
  rows: readonly GridRow[];
}

/** Options for a {@link GridTitleBlock}. */
export interface GridTitleBlockOptions {
  /** Preferred overall width in mm; clamped to fit the sheet's drawing width if narrower. Defaults to 190. */
  widthMM?: number;
  /** Corner-label text size. Defaults to 2mm. */
  labelSize?: number;
  /** Field-value text size. Defaults to 3mm. */
  valueSize?: number;
  /** Defaults to 0.25mm. */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

/**
 * A title block built from an arbitrary declarative grid: one or more columns,
 * each a stack of rows of cells (see `grid.ts` for cell shapes). This is what
 * `TitleBlock` (the ASME corner block) and `ISO7200TitleBlock` render
 * through, and it's directly usable for a fully custom layout — anchored to
 * the bottom-right of the sheet, same as every other title block here. All
 * columns must sum their row heights to the same total (that total becomes
 * `heightMM`); nothing enforces this, so a mismatched column just renders
 * short, with no border along its unclaimed bottom strip.
 */
export class GridTitleBlock implements TitleBlockLike {
  readonly heightMM: number;

  private readonly preferredWidthMM: number;
  private readonly labelSize: number;
  private readonly valueSize: number;
  private readonly strokeWidthMM: number;
  private readonly color: string | undefined;

  constructor(
    private readonly columns: readonly GridColumn[],
    options: GridTitleBlockOptions = {},
  ) {
    this.heightMM = columns.length > 0 ? gridHeight(columns[0]!.rows) : 0;
    this.preferredWidthMM = options.widthMM ?? 190;
    this.labelSize = options.labelSize ?? 2;
    this.valueSize = options.valueSize ?? 3;
    this.strokeWidthMM = options.strokeWidthMM ?? 0.25;
    this.color = options.color;
  }

  /** The title block's constituent geometry/text primitives, in draw order (outer box, then each column). */
  renderElements(ctx: TitleBlockRenderContext): DxfPrimitive[] {
    const width = Math.min(this.preferredWidthMM, ctx.sheetWidthMM - 2 * ctx.marginMM);
    const x0 = ctx.sheetWidthMM - ctx.marginMM - width;
    const y0 = ctx.marginMM;
    const style = { labelSize: this.labelSize, valueSize: this.valueSize, strokeWidthMM: this.strokeWidthMM, color: this.color };

    const parts: DxfPrimitive[] = [
      new DrawingElement(rectangle(x0, y0, width, this.heightMM), { stroke: { color: this.color ?? "black", width: this.strokeWidthMM } }),
    ];

    let x = x0;
    for (const column of this.columns) {
      const colWidth = width * column.widthFraction;
      parts.push(...gridColumnElements(x, y0, colWidth, column.rows, style));
      x += colWidth;
    }

    return parts;
  }

  render(ctx: TitleBlockRenderContext): string {
    return this.renderElements(ctx)
      .map((el) => el.toSVG())
      .join("\n");
  }
}
