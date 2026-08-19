import { PdfWriter, pdfArray, pdfDict, pdfRef, pdfString } from "./pdfWriter.js";
import { subsetCFF, subsetFont, type ParsedFont } from "./ttf.js";

/** Lowercase hex encoding of a byte array — for embedding a font as an `ASCIIHexDecode` stream (keeps the whole PDF plain-ASCII). */
export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, "0");
  return out;
}

/** UTF-16BE hex for a Unicode codepoint (a surrogate pair for astral codepoints), for the ToUnicode CMap. */
function utf16beHex(codepoint: number): string {
  if (codepoint <= 0xffff) return codepoint.toString(16).padStart(4, "0");
  const c = codepoint - 0x10000;
  const hi = 0xd800 + (c >> 10);
  const lo = 0xdc00 + (c & 0x3ff);
  return hi.toString(16).padStart(4, "0") + lo.toString(16).padStart(4, "0");
}

/** A `/ToUnicode` CMap mapping the used glyph ids back to their Unicode codepoints, so PDF text stays selectable/searchable. */
function toUnicodeCMap(used: Map<number, number>): string {
  const entries = [...used.entries()].sort((a, b) => a[0] - b[0]);
  const bf: string[] = [];
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    bf.push(`${chunk.length} beginbfchar`);
    for (const [gid, cp] of chunk) bf.push(`<${gid.toString(16).padStart(4, "0")}> <${utf16beHex(cp)}>`);
    bf.push("endbfchar");
  }
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    ...bf,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

/**
 * Emits the PDF object graph for embedding `font` as a composite (Type0 /
 * Identity-H) font whose 2-byte codes are glyph ids directly (CIDFontType2,
 * `CIDToGIDMap /Identity`): the `FontFile2` stream (the used-glyph subset,
 * hex-encoded via `ASCIIHexDecode` so the PDF stays plain-ASCII and deterministic), a
 * `FontDescriptor`, the `CIDFontType2` with a `/W` width array for the used
 * glyphs, a `/ToUnicode` CMap, and the top-level `Type0` font. Returns the
 * Type0 font's object id (the one a page's `/Font` resource references).
 * `used` maps each used glyph id to a Unicode codepoint.
 */
export function buildEmbeddedFontObjects(writer: PdfWriter, font: ParsedFont, used: Map<number, number>): number {
  const scale = 1000 / font.unitsPerEm;
  const sc = (v: number): number => Math.round(v * scale);
  const name = "/" + font.postScriptName;

  const isCFF = font.outlineType === "cff" && font.cff;
  // glyf → FontFile2 (a used-glyph subset, ids/metrics preserved); CFF → FontFile3 with the CFF table
  // (Type1C, or CIDFontType0C when CID-keyed), glyph-subsetted (both plain and CID-keyed); an
  // unexpected CFF structure falls back to embedding whole.
  const fontFileId = isCFF
    ? writer.addStreamObject(
        { Filter: "/ASCIIHexDecode", Subtype: font.cffIsCID ? "/CIDFontType0C" : "/Type1C" },
        bytesToHex(subsetCFF(font.cff!, used.keys()) ?? font.cff!) + ">",
      )
    : (() => {
        const subset = subsetFont(font.data, used.keys());
        return writer.addStreamObject({ Filter: "/ASCIIHexDecode", Length1: String(subset.length) }, bytesToHex(subset) + ">");
      })();

  const descriptorId = writer.addObject(
    pdfDict({
      Type: "/FontDescriptor",
      FontName: name,
      Flags: "32", // nonsymbolic
      FontBBox: pdfArray(font.bbox.map((v) => String(sc(v)))),
      ItalicAngle: "0",
      Ascent: String(sc(font.ascent)),
      Descent: String(sc(font.descent)),
      CapHeight: String(sc(font.ascent)),
      StemV: "80",
      // CFF outlines go in FontFile3; TrueType glyf in FontFile2.
      ...(isCFF ? { FontFile3: pdfRef(fontFileId) } : { FontFile2: pdfRef(fontFileId) }),
    }),
  );

  const sortedGids = [...used.keys()].sort((a, b) => a - b);
  const wArray = sortedGids.map((gid) => `${gid} [${sc(font.advanceWidth(gid))}]`).join(" ");
  // CFF descendant is CIDFontType0 (no CIDToGIDMap); glyf descendant is CIDFontType2 with /Identity map.
  const cidFontId = writer.addObject(
    pdfDict({
      Type: "/Font",
      Subtype: isCFF ? "/CIDFontType0" : "/CIDFontType2",
      BaseFont: name,
      CIDSystemInfo: pdfDict({ Registry: pdfString("Adobe"), Ordering: pdfString("Identity"), Supplement: "0" }),
      FontDescriptor: pdfRef(descriptorId),
      ...(isCFF ? {} : { CIDToGIDMap: "/Identity" }),
      DW: "1000",
      W: `[${wArray}]`,
    }),
  );

  const toUnicodeId = writer.addStreamObject({}, toUnicodeCMap(used));

  return writer.addObject(
    pdfDict({
      Type: "/Font",
      Subtype: "/Type0",
      BaseFont: name,
      Encoding: "/Identity-H",
      DescendantFonts: pdfArray([pdfRef(cidFontId)]),
      ToUnicode: pdfRef(toUnicodeId),
    }),
  );
}
