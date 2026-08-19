import type { Point } from "../geometry/point.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";
import { gridColumnElements, gridHeight, type GridRow } from "./grid.js";

/** One row of a {@link BOMTable}. */
export interface BOMEntry {
  /** Find/item number, cross-referenced by an `ItemBalloon` in the assembly view. */
  item: string | number;
  /** Quantity required, e.g. 4. */
  quantity: string | number;
  /** Part or spec number. */
  partNumber?: string;
  /** Part description/name. */
  description: string;
  /** Material, if shown as its own column. */
  material?: string;
}

/** A column key into {@link BOMEntry}, for {@link BOMTableOptions.columns}. */
export type BOMColumn = "item" | "quantity" | "partNumber" | "description" | "material";

/** Options for a {@link BOMTable}. */
export interface BOMTableOptions {
  /** Which columns to show, and in what order. Defaults to item/quantity/partNumber/description (no material). */
  columns?: readonly BOMColumn[];
  /** Defaults to 100mm. */
  widthMM?: number;
  /** Defaults to 5mm. */
  headerHeightMM?: number;
  /** Defaults to 6mm. */
  rowHeightMM?: number;
  /** Defaults to 2.2mm. */
  textSizeMM?: number;
  /** Defaults to 0.2mm. */
  strokeWidthMM?: number;
  /** Defaults to "black". */
  color?: string;
}

const COLUMN_LABELS: Record<BOMColumn, string> = {
  item: "ITEM",
  quantity: "QTY",
  partNumber: "PART NUMBER",
  description: "DESCRIPTION",
  material: "MATERIAL",
};

const COLUMN_WIDTH_FRACTIONS: Record<BOMColumn, number> = {
  item: 0.12,
  quantity: 0.12,
  partNumber: 0.22,
  description: 0.4,
  material: 0.14,
};

const DEFAULT_COLUMNS: readonly BOMColumn[] = ["item", "quantity", "partNumber", "description"];

/**
 * A bill of materials / parts list: a header row of column labels, then one
 * row per entry, rendered top to bottom in the order given — same
 * "caller controls order" pattern as `RevisionTable`. Many shops place this
 * table directly above the title block with item 1 in the row *nearest* the
 * title block (ascending upward) rather than at the top; that specific
 * direction isn't a single universally-cited rule, so pass `entries` in
 * whichever order matches your own convention (reverse them yourself for
 * "item 1 at the bottom"). Built on the same grid primitives as the title
 * blocks and `RevisionTable`, so it matches their visual language.
 */
export class BOMTable implements Renderable, Explodable {
  /** Total table height in mm (header + all entry rows). */
  readonly heightMM: number;

  private readonly columns: readonly BOMColumn[];
  private readonly widthMM: number;
  private readonly headerHeightMM: number;
  private readonly rowHeightMM: number;
  private readonly textSizeMM: number;
  private readonly strokeWidthMM: number;
  private readonly color: string | undefined;

  constructor(
    private readonly anchor: Point,
    private readonly entries: readonly BOMEntry[],
    options: BOMTableOptions = {},
  ) {
    this.columns = options.columns ?? DEFAULT_COLUMNS;
    this.widthMM = options.widthMM ?? 100;
    this.headerHeightMM = options.headerHeightMM ?? 5;
    this.rowHeightMM = options.rowHeightMM ?? 6;
    this.textSizeMM = options.textSizeMM ?? 2.2;
    this.strokeWidthMM = options.strokeWidthMM ?? 0.2;
    this.color = options.color;
    this.heightMM = this.headerHeightMM + entries.length * this.rowHeightMM;
  }

  private widthFractionsNormalized(): number[] {
    const raw = this.columns.map((c) => COLUMN_WIDTH_FRACTIONS[c]);
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map((f) => f / total);
  }

  /** The table's constituent geometry/text primitives, in draw order (header row, then one row per entry). */
  toElements(): DxfPrimitive[] {
    const style = { labelSize: this.textSizeMM, valueSize: this.textSizeMM, strokeWidthMM: this.strokeWidthMM, color: this.color };
    const fractions = this.widthFractionsNormalized();

    const headerRow: GridRow = {
      heightMM: this.headerHeightMM,
      cells: this.columns.map((c, i) => ({ kind: "caption" as const, widthFraction: fractions[i]!, text: COLUMN_LABELS[c], bold: true })),
    };

    const dataRows: GridRow[] = this.entries.map((entry) => ({
      heightMM: this.rowHeightMM,
      cells: this.columns.map((c, i) => {
        const value = entry[c] ?? "";
        return { kind: "caption" as const, widthFraction: fractions[i]!, text: `${value}`, align: c === "description" ? "start" : "middle" };
      }),
    }));

    const rows = [headerRow, ...dataRows];
    const y0 = this.anchor.y - gridHeight(rows);
    return gridColumnElements(this.anchor.x, y0, this.widthMM, rows, style);
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}
