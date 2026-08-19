import type { DxfPrimitive } from "../svg/renderable.js";
import type { GridRow } from "./grid.js";
import { GridTitleBlock, type GridTitleBlockOptions } from "./gridTitleBlock.js";
import type { TitleBlockLike, TitleBlockRenderContext } from "./titleBlock.js";

/**
 * The ISO 7200:2004 title-block field set. Field names follow the standard's
 * §5 terminology; `size` (§5.3.11 "paper size") falls back to the Sheet's
 * paper size label, same as `TitleBlock`. Per §4, ISO 7200 deliberately keeps
 * the title block's own field count to a minimum — fields like scale and
 * projection are meant to live outside it — so this covers the standard's
 * mandatory fields (§5.1–5.3, obligation "M") plus a few near-universal
 * optional ones (revision index, sheet), not every optional field it defines.
 */
export interface ISO7200Fields {
  /** §5.2.2, mandatory. */
  title: string;
  /** §5.1.2, mandatory. */
  legalOwner: string;
  /** §5.1.3, mandatory. */
  identificationNumber: string;
  /** §5.3.6, mandatory. */
  documentType: string;
  /** §5.1.5, mandatory. */
  dateOfIssue: string;
  /** §5.3.5, mandatory. */
  creator: string;
  /** §5.3.4, mandatory. */
  approvalPerson: string;
  /** §5.1.4, optional; letters I and O should be avoided (easily confused with 1 and 0). */
  revisionIndex?: string;
  /** §5.1.6/§5.1.7, optional; pre-formatted, e.g. "1/3". */
  sheet?: string;
  /** §5.3.11, optional. Falls back to the Sheet's paper size label when unset. */
  size?: string | undefined;
}

const ROW_HEIGHTS_MM = [10, 7, 7] as const;

function buildRows(f: ISO7200Fields): GridRow[] {
  return [
    { heightMM: ROW_HEIGHTS_MM[0], cells: [{ kind: "labeled", widthFraction: 1, label: "TITLE", value: f.title, valueSize: 3.6 }] },
    {
      heightMM: ROW_HEIGHTS_MM[1],
      cells: [
        { kind: "labeled", widthFraction: 0.35, label: "LEGAL OWNER", value: f.legalOwner },
        { kind: "labeled", widthFraction: 0.25, label: "DOCUMENT TYPE", value: f.documentType },
        { kind: "labeled", widthFraction: 0.25, label: "IDENTIFICATION NO", value: f.identificationNumber },
        { kind: "labeled", widthFraction: 0.15, label: "SIZE", value: f.size },
      ],
    },
    {
      heightMM: ROW_HEIGHTS_MM[2],
      cells: [
        { kind: "labeled", widthFraction: 0.22, label: "CREATOR", value: f.creator },
        { kind: "labeled", widthFraction: 0.18, label: "DATE OF ISSUE", value: f.dateOfIssue },
        { kind: "labeled", widthFraction: 0.22, label: "APPROVAL PERSON", value: f.approvalPerson },
        { kind: "labeled", widthFraction: 0.12, label: "REV", value: f.revisionIndex },
        { kind: "labeled", widthFraction: 0.26, label: "SHEET", value: f.sheet },
      ],
    },
  ];
}

/** An ISO 7200:2004-based title block: a single full-width column, deliberately fewer fields than the ASME corner block. */
export class ISO7200TitleBlock implements TitleBlockLike {
  readonly heightMM: number = ROW_HEIGHTS_MM.reduce((a, b) => a + b, 0);

  constructor(
    private readonly fields: ISO7200Fields,
    private readonly options: GridTitleBlockOptions = {},
  ) {}

  private inner(f: ISO7200Fields): GridTitleBlock {
    return new GridTitleBlock([{ widthFraction: 1, rows: buildRows(f) }], { ...this.options, widthMM: this.options.widthMM ?? 180 });
  }

  /** The title block's constituent geometry/text primitives (delegated to the underlying single-column grid). */
  renderElements(ctx: TitleBlockRenderContext): DxfPrimitive[] {
    const f: ISO7200Fields = this.fields.size ? this.fields : { ...this.fields, size: ctx.paperSizeLabel };
    return this.inner(f).renderElements(ctx);
  }

  render(ctx: TitleBlockRenderContext): string {
    const f: ISO7200Fields = this.fields.size ? this.fields : { ...this.fields, size: ctx.paperSizeLabel };
    return this.inner(f).render(ctx);
  }
}
