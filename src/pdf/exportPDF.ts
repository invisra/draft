import type { Sheet } from "../sheet/sheet.js";
import { parseColor } from "./colors.js";
import { buildEmbeddedFontObjects } from "./embeddedFont.js";
import { textWidth, type StandardFont } from "../svg/fontMetrics.js";
import { parseSvgDocument, type LayerNode, type SvgNode } from "./parseSvg.js";
import { PdfWriter, pdfArray, pdfDict, pdfNumber, pdfRef, pdfString } from "./pdfWriter.js";
import { svgPathDataToPdfOps } from "./svgPathToPdfOps.js";
import { parseFont, type ParsedFont } from "./ttf.js";

const MM_PER_INCH = 25.4;
const POINTS_PER_INCH = 72;
const PT_PER_MM = POINTS_PER_INCH / MM_PER_INCH;

// PDF text renders with standard (non-embedded) fonts only — Helvetica/Helvetica-Bold — for a
// dependency-free, zero-bundled-assets exporter. Those only cover WinAnsiEncoding (Latin-1), not
// arbitrary Unicode, so the handful of drafting symbols this library treats as literal Unicode
// text (not vector shapes) are substituted with their historical pre-Unicode equivalents: Ø was
// the standard typewriter-era diameter symbol substitute (and is itself a real WinAnsi glyph);
// CBORE/CSK are the spelled-out abbreviations used on drawings without a symbol font. Everything
// else this library draws (GD&T characteristic symbols, circled M/L modifiers, arrowheads, the
// projection symbol, ...) is already vector geometry, not text, so it's unaffected.
const TEXT_SUBSTITUTIONS: readonly [RegExp, string][] = [
  [/⌀/g, "Ø"],
  [/⌴/g, "CBORE "],
  [/⌵/g, "CSK "],
  [/□/g, "SQ "],
  [/↧/g, "DEEP "],
];

function sanitizeForStandardFont(text: string): string {
  return TEXT_SUBSTITUTIONS.reduce((s, [pattern, replacement]) => s.replace(pattern, replacement), text);
}

/**
 * The PDF text matrix (`Tm`) for a parsed text node, with the anchor offset `dx`
 * applied along the reading direction. PDF text space is y-up, so the SVG
 * wrapper's linear part `[a, b, c, d]` (`c, d` carry the SVG Y-flip) becomes
 * `[a, b, -c, -d]` — which for the default upright text `[1, 0, 0, -1]` is the
 * identity `1 0 0 1`, preserving existing output. The reading axis is `(a, b)`,
 * so the anchor shift lands at `(x + a·dx, y + b·dx)`.
 */
function textMatrix(node: Extract<SvgNode, { type: "text" }>, dx: number): string {
  const [a, b, c, d] = node.matrix ?? [1, 0, 0, -1];
  const tx = node.x + a * dx;
  const ty = node.y + b * dx;
  return `${pdfNumber(a)} ${pdfNumber(b)} ${pdfNumber(-c)} ${pdfNumber(-d)} ${pdfNumber(tx)} ${pdfNumber(ty)}`;
}

const LINECAP: Record<string, number> = { butt: 0, round: 1, square: 2 };
const LINEJOIN: Record<string, number> = { miter: 0, round: 1, bevel: 2 };

interface OcgEntry {
  id: number;
  name: string;
  propertyName: string;
  visible: boolean;
}

/** An embedded caller-supplied font: the parsed font, its PDF resource name, and the glyphs it ends up using (glyph id → codepoint, for the width array and ToUnicode map). */
interface EmbeddedFontContext {
  font: ParsedFont;
  resourceName: string;
  used: Map<number, number>;
}

/** Walks parsed SVG nodes, emitting PDF content-stream operators; records one OCG per Layer encountered. */
class ContentBuilder {
  private ops = "";
  readonly ocgs: OcgEntry[] = [];

  constructor(
    private readonly fontResourceName: (font: StandardFont) => string,
    private readonly allocateOcgId: () => number,
    private readonly embedded?: EmbeddedFontContext,
  ) {}

  private emitPath(node: Extract<SvgNode, { type: "path" }>): void {
    const pathOps = svgPathDataToPdfOps(node.d);
    if (pathOps.length === 0) return;

    const hasFill = node.fill !== "none";
    const hasStroke = node.stroke !== undefined;
    if (!hasFill && !hasStroke) return;

    this.ops += "q\n";
    if (hasFill) {
      const [r, g, b] = parseColor(node.fill);
      this.ops += `${pdfNumber(r)} ${pdfNumber(g)} ${pdfNumber(b)} rg\n`;
    }
    if (hasStroke) {
      const [r, g, b] = parseColor(node.stroke!);
      this.ops += `${pdfNumber(r)} ${pdfNumber(g)} ${pdfNumber(b)} RG\n`;
      this.ops += `${pdfNumber(node.strokeWidth ?? 0.25)} w\n`;
      if (node.dasharray) this.ops += `[${node.dasharray.map(pdfNumber).join(" ")}] 0 d\n`;
      if (node.linecap !== undefined && node.linecap in LINECAP) this.ops += `${LINECAP[node.linecap]} J\n`;
      if (node.linejoin !== undefined && node.linejoin in LINEJOIN) this.ops += `${LINEJOIN[node.linejoin]} j\n`;
    }
    this.ops += `${pathOps.join("\n")}\n`;
    this.ops += hasFill && hasStroke ? "B\n" : hasFill ? "f\n" : "S\n";
    this.ops += "Q\n";
  }

  /** Renders text with the embedded font: real Unicode (no substitution), shown as Identity-H 2-byte glyph ids. */
  private emitEmbeddedText(node: Extract<SvgNode, { type: "text" }>, embedded: EmbeddedFontContext): void {
    if (node.content === "") return;
    const { font, used } = embedded;
    let widthUnits = 0;
    let hex = "";
    for (const ch of node.content) {
      const cp = ch.codePointAt(0)!;
      const gid = font.gidForCodepoint(cp);
      used.set(gid, cp);
      widthUnits += font.advanceWidth(gid);
      hex += gid.toString(16).padStart(4, "0");
    }
    const width = (widthUnits / font.unitsPerEm) * node.fontSize;
    const dx = node.anchor === "middle" ? -width / 2 : node.anchor === "end" ? -width : 0;
    const [r, g, b] = parseColor(node.fill);
    // A single embedded font carries one weight; synthesize bold by stroking the glyph outlines
    // (text render mode 2 = fill + stroke) with a hairline proportional to the font size.
    const bold = node.weight === "bold";

    this.ops += "q\n";
    this.ops += `${pdfNumber(r)} ${pdfNumber(g)} ${pdfNumber(b)} rg\n`;
    if (bold) {
      this.ops += `${pdfNumber(r)} ${pdfNumber(g)} ${pdfNumber(b)} RG\n`;
      this.ops += `${pdfNumber(node.fontSize * 0.03)} w\n`;
      this.ops += "2 Tr\n";
    }
    this.ops += "BT\n";
    this.ops += `${embedded.resourceName} ${pdfNumber(node.fontSize)} Tf\n`;
    this.ops += `${textMatrix(node, dx)} Tm\n`;
    this.ops += `<${hex}> Tj\n`;
    this.ops += "ET\n";
    this.ops += "Q\n";
  }

  private emitText(node: Extract<SvgNode, { type: "text" }>): void {
    if (this.embedded) {
      this.emitEmbeddedText(node, this.embedded);
      return;
    }
    const content = sanitizeForStandardFont(node.content);
    if (content === "") return;

    const font: StandardFont = node.weight === "bold" ? "Helvetica-Bold" : "Helvetica";
    const width = textWidth(content, font, node.fontSize);
    const dx = node.anchor === "middle" ? -width / 2 : node.anchor === "end" ? -width : 0;
    const [r, g, b] = parseColor(node.fill);

    this.ops += "q\n";
    this.ops += `${pdfNumber(r)} ${pdfNumber(g)} ${pdfNumber(b)} rg\n`;
    this.ops += "BT\n";
    this.ops += `${this.fontResourceName(font)} ${pdfNumber(node.fontSize)} Tf\n`;
    this.ops += `${textMatrix(node, dx)} Tm\n`;
    this.ops += `${pdfString(content)} Tj\n`;
    this.ops += "ET\n";
    this.ops += "Q\n";
  }

  private emitLayer(node: LayerNode): void {
    const propertyName = `MC${this.ocgs.length + 1}`;
    const id = this.allocateOcgId();
    this.ocgs.push({ id, name: node.name, propertyName, visible: node.visible });
    this.ops += `/OC /${propertyName} BDC\n`;
    for (const child of node.children) this.emitNode(child);
    this.ops += "EMC\n";
  }

  /** A view is a transparent group — its children already carry the baked-in view transform, so they render inline with no optional-content group (a view is not a togglable layer). */
  private emitView(node: Extract<SvgNode, { type: "view" }>): void {
    for (const child of node.children) this.emitNode(child);
  }

  emitNode(node: SvgNode): void {
    if (node.type === "path") this.emitPath(node);
    else if (node.type === "text") this.emitText(node);
    else if (node.type === "view") this.emitView(node);
    else this.emitLayer(node);
  }

  emitAll(nodes: readonly SvgNode[]): void {
    for (const node of nodes) this.emitNode(node);
  }

  build(): string {
    return this.ops;
  }
}

/** Options for {@link exportPDF}. */
export interface PDFExportOptions {
  /** Overrides the exported page size; defaults to the sheet's own physical size. */
  widthMM?: number;
  /** Overrides the exported page height; defaults to the sheet's own physical size. */
  heightMM?: number;
  /**
   * A caller-supplied TrueType font to embed and use for **all** text, instead
   * of the default (non-embedded) Helvetica. Pass the raw `.ttf` bytes as
   * `data`. This unlocks arbitrary Unicode (the library's own `⌀`/`⌴`/`⌵`
   * drafting symbols render as themselves rather than being substituted with
   * ASCII), while keeping the exporter dependency-free and shipping no bundled
   * font — you provide the font. The whole font is embedded (not subsetted) as
   * a hex-encoded `FontFile2`, so output stays plain-ASCII and deterministic.
   * Only `glyf`-based TrueType is supported (not CFF/OpenType `OTTO`), and text
   * weight is not synthesized — every run uses the supplied font.
   */
  font?: {
    /** The raw TrueType (`.ttf`) file bytes. */
    data: Uint8Array;
  };
}

/**
 * Renders a `Sheet` to a single-page PDF — the whole sheet (border, title block, dimensions,
 * GD&T, hatching, everything), not a geometry-only subset, since this works by parsing the exact
 * SVG markup `sheet.toSVG()` already produces rather than re-deriving CAD-native entities the way
 * `exportDXF()` must. `Layer`s become real PDF Optional Content Groups — toggleable in a viewer's
 * layers panel, with a hidden (`visible: false`) `Layer` starting in the OCG "OFF" state, same
 * spirit as its `display:none` SVG rendering but genuinely interactive in PDF. By default it uses
 * standard (non-embedded) Helvetica — see the module-level comment on `TEXT_SUBSTITUTIONS` for the
 * resulting text-fidelity tradeoff — or pass `options.font` a TrueType font to embed and render all
 * text in, which unlocks arbitrary Unicode (see {@link PDFExportOptions}). Output is plain-ASCII and
 * deterministic (no timestamps or random IDs) — even an embedded font is hex-encoded — so it can be
 * snapshot-tested like this library's SVG/DXF output.
 */
export function exportPDF(sheet: Sheet, options: PDFExportOptions = {}): string {
  const doc = parseSvgDocument(sheet.toSVG());
  const widthMM = options.widthMM ?? doc.widthMM;
  const heightMM = options.heightMM ?? doc.heightMM;

  const embeddedFont = options.font ? parseFont(options.font.data) : undefined;

  const writer = new PdfWriter();
  const catalogId = writer.allocateId();
  const pagesId = writer.allocateId();
  const pageId = writer.allocateId();
  const fontResourceName = (font: StandardFont): string => (font === "Helvetica-Bold" ? "/F2" : "/F1");

  let fontResource: string;
  let builder: ContentBuilder;
  if (embeddedFont) {
    const embedded: EmbeddedFontContext = { font: embeddedFont, resourceName: "/F0", used: new Map() };
    builder = new ContentBuilder(fontResourceName, () => writer.allocateId(), embedded);
    builder.emitAll(doc.children);
    const type0Id = buildEmbeddedFontObjects(writer, embeddedFont, embedded.used);
    fontResource = pdfDict({ F0: pdfRef(type0Id) });
  } else {
    // Non-embedded path: object allocation order is preserved exactly so existing output stays byte-identical.
    const helveticaId = writer.addObject(pdfDict({ Type: "/Font", Subtype: "/Type1", BaseFont: "/Helvetica", Encoding: "/WinAnsiEncoding" }));
    const helveticaBoldId = writer.addObject(
      pdfDict({ Type: "/Font", Subtype: "/Type1", BaseFont: "/Helvetica-Bold", Encoding: "/WinAnsiEncoding" }),
    );
    builder = new ContentBuilder(fontResourceName, () => writer.allocateId());
    builder.emitAll(doc.children);
    fontResource = pdfDict({ F1: pdfRef(helveticaId), F2: pdfRef(helveticaBoldId) });
  }

  for (const ocg of builder.ocgs) {
    writer.setObject(ocg.id, pdfDict({ Type: "/OCG", Name: pdfString(ocg.name) }));
  }

  const scale = PT_PER_MM;
  const contentId = writer.addStreamObject({}, `${pdfNumber(scale)} 0 0 ${pdfNumber(scale)} 0 0 cm\n${builder.build()}`);

  const resources: Record<string, string> = {
    Font: fontResource,
  };
  if (builder.ocgs.length > 0) {
    resources.Properties = pdfDict(Object.fromEntries(builder.ocgs.map((o) => [o.propertyName, pdfRef(o.id)])));
  }

  writer.setObject(
    pageId,
    pdfDict({
      Type: "/Page",
      Parent: pdfRef(pagesId),
      MediaBox: pdfArray(["0", "0", pdfNumber(widthMM * scale), pdfNumber(heightMM * scale)]),
      Resources: pdfDict(resources),
      Contents: pdfRef(contentId),
    }),
  );
  writer.setObject(pagesId, pdfDict({ Type: "/Pages", Kids: pdfArray([pdfRef(pageId)]), Count: "1" }));

  const catalogEntries: Record<string, string> = { Type: "/Catalog", Pages: pdfRef(pagesId) };
  if (builder.ocgs.length > 0) {
    const allOcgs = pdfArray(builder.ocgs.map((o) => pdfRef(o.id)));
    const offOcgs = pdfArray(builder.ocgs.filter((o) => !o.visible).map((o) => pdfRef(o.id)));
    catalogEntries.OCProperties = pdfDict({ OCGs: allOcgs, D: pdfDict({ OFF: offOcgs }) });
  }
  writer.setObject(catalogId, pdfDict(catalogEntries));

  return writer.build(catalogId);
}
