import type { Sheet } from "./sheet.js";

/** A sheet's resolved position within a {@link DrawingSet}, passed to each {@link SheetFactory}. */
export interface SheetContext {
  /** 1-based position within the set. */
  index: number;
  /** Total number of sheets in the set. */
  total: number;
  /** Convenience "N OF M" label, e.g. "2 OF 5" — the common ASME sheet-field convention. */
  sheetLabel: string;
}

/** Builds a `Sheet` given its resolved position in a {@link DrawingSet}. */
export type SheetFactory = (ctx: SheetContext) => Sheet;

/**
 * An ordered set of sheets, e.g. an overview sheet plus a detail sheet per
 * view. Solves the ordering problem plain `Sheet[]` can't: a sheet's title
 * block typically needs to show "2 OF 5", but you don't know the total sheet
 * count until every sheet has been added — so sheets are added as factories
 * and only built once the set is complete and the total is known.
 *
 * ```ts
 * const set = new DrawingSet();
 * set.add(({ sheetLabel }) => {
 *   const sheet = new Sheet();
 *   sheet.setTitleBlock(new TitleBlock({ title: "BRACKET", drawingNumber: "DRW-1", sheet: sheetLabel }));
 *   return sheet;
 * });
 * const svgs = set.toSVGs(); // one string per sheet, in add() order
 * ```
 */
export class DrawingSet {
  private readonly factories: SheetFactory[] = [];

  /** Registers a sheet factory, in the order it should appear in the set. Returns `this` for chaining. */
  add(factory: SheetFactory): this {
    this.factories.push(factory);
    return this;
  }

  /** Builds every sheet, in order, with its resolved { index, total, sheetLabel } context. */
  build(): Sheet[] {
    const total = this.factories.length;
    return this.factories.map((factory, i) => factory({ index: i + 1, total, sheetLabel: `${i + 1} OF ${total}` }));
  }

  /** Convenience: build() then render every sheet to its own standalone SVG document string. */
  toSVGs(): string[] {
    return this.build().map((sheet) => sheet.toSVG());
  }
}
