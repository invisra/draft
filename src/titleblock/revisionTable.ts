import type { Point } from "../geometry/point.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";
import { gridColumnElements, gridHeight, type GridRow } from "./grid.js";

/** One row of a {@link RevisionTable}. */
export interface RevisionEntry {
  /** Revision letter/number, e.g. "A". */
  rev: string;
  /** What changed. */
  description: string;
  /** Date of the revision. */
  date: string;
  /** Approver's initials/name. */
  approved?: string;
  /** References the sheet's zoned border grid, e.g. "B3", so a reader can find where the change was made. */
  zone?: string;
}

/** A column key into {@link RevisionEntry}, for {@link RevisionTableOptions.columns}. */
export type RevisionColumn = "zone" | "rev" | "description" | "date" | "approved";

/** Options for a {@link RevisionTable}. */
export interface RevisionTableOptions {
  /** Which columns to show, and in what order. Defaults to rev/description/date/approved (no zone). */
  columns?: readonly RevisionColumn[];
  /** Defaults to 90mm. */
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

const COLUMN_LABELS: Record<RevisionColumn, string> = {
  zone: "ZONE",
  rev: "REV",
  description: "DESCRIPTION",
  date: "DATE",
  approved: "APPROVED",
};

const COLUMN_WIDTH_FRACTIONS: Record<RevisionColumn, number> = {
  zone: 0.1,
  rev: 0.12,
  description: 0.44,
  date: 0.16,
  approved: 0.18,
};

const DEFAULT_COLUMNS: readonly RevisionColumn[] = ["rev", "description", "date", "approved"];

/**
 * A revision history table: a header row of column labels, then one row per
 * entry — most recent revision first (entries are rendered top to bottom in
 * the order given, so pass newest-first). `anchor` is the table's top-left
 * corner; it grows downward and rightward from there. Built on the same grid
 * primitives as the title blocks, so it matches their visual language.
 */
export class RevisionTable implements Renderable, Explodable {
  /** Total table height in mm (header + all entry rows). */
  readonly heightMM: number;

  private readonly columns: readonly RevisionColumn[];
  private readonly widthMM: number;
  private readonly headerHeightMM: number;
  private readonly rowHeightMM: number;
  private readonly textSizeMM: number;
  private readonly strokeWidthMM: number;
  private readonly color: string | undefined;

  constructor(
    private readonly anchor: Point,
    private readonly entries: readonly RevisionEntry[],
    options: RevisionTableOptions = {},
  ) {
    this.columns = options.columns ?? DEFAULT_COLUMNS;
    this.widthMM = options.widthMM ?? 90;
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
        return { kind: "caption" as const, widthFraction: fractions[i]!, text: value, align: c === "description" ? "start" : "middle" };
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
