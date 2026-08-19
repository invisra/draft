import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseFont, subsetCFF } from "../src/pdf/ttf.js";
import { exportPDF } from "../src/pdf/exportPDF.js";
import { Sheet } from "../src/sheet/sheet.js";
import { TextElement } from "../src/svg/text.js";
import { DiameterDimension } from "../src/dimension/radialDimension.js";

// ---- a minimal, synthetic TrueType font (no glyf outlines — enough to exercise the parser and
// the PDF embedding path deterministically, without depending on a system font). Maps A→gid1,
// B→gid2, é(U+00E9)→gid4, ⌀(U+2300)→gid3, with per-glyph advance widths. ----
function buildTestFont(): Uint8Array {
  const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
  const i16 = (n: number) => u16(n & 0xffff);
  const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const utf16be = (s: string) => [...s].flatMap((c) => u16(c.charCodeAt(0)));

  const head = [
    ...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0x5f0f3cf5),
    ...u16(0), ...u16(1000), // flags, unitsPerEm @18
    ...u32(0), ...u32(0), ...u32(0), ...u32(0), // created/modified
    ...i16(0), ...i16(-200), ...i16(1000), ...i16(800), // bbox @36..
    ...u16(0), ...u16(8), ...i16(2), ...i16(0), ...i16(0), // ... indexToLocFormat @50
  ];
  const hhea = [
    ...u32(0x00010000), ...i16(800), ...i16(-200), ...i16(0), ...u16(1000),
    ...i16(0), ...i16(0), ...i16(1000), ...i16(1), ...i16(0), ...i16(0),
    ...i16(0), ...i16(0), ...i16(0), ...i16(0), ...i16(0), ...u16(5), // numberOfHMetrics @34
  ];
  const maxp = [...u32(0x00005000), ...u16(5)];
  const widths = [500, 600, 650, 700, 620];
  const hmtx = widths.flatMap((w) => [...u16(w), ...i16(0)]);
  const cmap = [
    ...u16(0), ...u16(1), // version, numTables
    ...u16(3), ...u16(1), ...u32(12), // record: (3,1) at offset 12
    // format 4 subtable:
    ...u16(4), ...u16(56), ...u16(0), ...u16(10), ...u16(0), ...u16(0), ...u16(0),
    ...u16(0x41), ...u16(0x42), ...u16(0xe9), ...u16(0x2300), ...u16(0xffff), // endCode
    ...u16(0), // reservedPad
    ...u16(0x41), ...u16(0x42), ...u16(0xe9), ...u16(0x2300), ...u16(0xffff), // startCode
    ...i16(1 - 0x41), ...i16(2 - 0x42), ...i16(4 - 0xe9), ...i16(3 - 0x2300), ...i16(1), // idDelta
    ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), // idRangeOffset
  ];
  const name = [
    ...u16(0), ...u16(1), ...u16(18), // format, count, stringOffset
    ...u16(3), ...u16(1), ...u16(0x409), ...u16(6), ...u16(16), ...u16(0), // record: nameID 6, len 16
    ...utf16be("TestFont"),
  ];

  const tables: [string, number[]][] = [
    ["cmap", cmap], ["head", head], ["hhea", hhea], ["hmtx", hmtx], ["maxp", maxp], ["name", name],
  ];
  const pad4 = (n: number) => (n + 3) & ~3;
  let offset = 12 + tables.length * 16;
  const dir: number[] = [];
  const body: number[] = [];
  for (const [tagStr, data] of tables) {
    const padded = [...data];
    while (padded.length % 4 !== 0) padded.push(0);
    dir.push(...[...tagStr].map((c) => c.charCodeAt(0)), ...u32(0), ...u32(offset), ...u32(data.length));
    body.push(...padded);
    offset = pad4(offset + data.length);
  }
  const header = [...u32(0x00010000), ...u16(tables.length), ...u16(0), ...u16(0), ...u16(0)];
  return new Uint8Array([...header, ...dir, ...body]);
}

const TEST_FONT = buildTestFont();

describe("parseFont (TrueType reader)", () => {
  it("reads global metrics and the PostScript name", () => {
    const f = parseFont(TEST_FONT);
    expect(f.unitsPerEm).toBe(1000);
    expect(f.numGlyphs).toBe(5);
    expect(f.ascent).toBe(800);
    expect(f.descent).toBe(-200);
    expect(f.bbox).toEqual([0, -200, 1000, 800]);
    expect(f.postScriptName).toBe("TestFont");
  });

  it("maps codepoints to glyph ids via cmap (0 for absent)", () => {
    const f = parseFont(TEST_FONT);
    expect(f.gidForCodepoint(0x41)).toBe(1); // 'A'
    expect(f.gidForCodepoint(0x2300)).toBe(3); // '⌀'
    expect(f.gidForCodepoint(0xe9)).toBe(4); // 'é'
    expect(f.gidForCodepoint(0x2764)).toBe(0); // '❤' not in font
  });

  it("reads advance widths from hmtx", () => {
    const f = parseFont(TEST_FONT);
    expect(f.advanceWidth(1)).toBe(600);
    expect(f.advanceWidth(3)).toBe(700);
  });

  it("rejects an unknown sfnt flavor (e.g. a WOFF/collection wrapper)", () => {
    const woff = new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]); // 'wOFF'
    expect(() => parseFont(woff)).toThrow(/Unsupported font/);
  });
});

// A real OpenType/CFF (OTTO) font, used skip-if-absent so a bare CI still passes.
const OTF_CANDIDATES = ["/usr/share/fonts/opentype/tlwg/Loma.otf"];
const OTF_PATH = OTF_CANDIDATES.find((p) => existsSync(p));
const CID_OTF_CANDIDATES = ["/usr/share/fonts/opentype/unifont/unifont.otf"];
const CID_OTF_PATH = CID_OTF_CANDIDATES.find((p) => existsSync(p));

describe("parseFont / exportPDF with an OpenType/CFF (OTTO) font", () => {
  it.skipIf(!OTF_PATH)("parses an OTTO font as a non-CID CFF, sharing the TrueType table reads", () => {
    const f = parseFont(new Uint8Array(readFileSync(OTF_PATH!)));
    expect(f.outlineType).toBe("cff");
    expect(f.cff).toBeInstanceOf(Uint8Array);
    expect(f.cff!.length).toBeGreaterThan(0);
    expect(f.cffIsCID).toBe(false);
    expect(f.numGlyphs).toBeGreaterThan(0);
    expect(f.unitsPerEm).toBeGreaterThan(0);
  });

  it.skipIf(!CID_OTF_PATH)("detects a CID-keyed CFF via the ROS operator", () => {
    const f = parseFont(new Uint8Array(readFileSync(CID_OTF_PATH!)));
    expect(f.outlineType).toBe("cff");
    expect(f.cffIsCID).toBe(true);
  });

  it.skipIf(!OTF_PATH)("embeds an OTTO font as FontFile3/Type1C in a CIDFontType0 (no CIDToGIDMap), deterministically", () => {
    const font = { data: new Uint8Array(readFileSync(OTF_PATH!)) };
    const sheet = new Sheet({ orientation: "landscape" });
    sheet.add(new TextElement({ x: 20, y: 20 }, "CFF 42", { size: 4 }));
    const pdf = exportPDF(sheet, { font });
    expect(pdf).toContain("/FontFile3");
    expect(pdf).toContain("/Type1C");
    expect(pdf).toContain("/CIDFontType0");
    expect(pdf).not.toContain("/CIDFontType2");
    expect(pdf).not.toContain("/CIDToGIDMap");
    expect(pdf).not.toContain("/FontFile2");
    expect(exportPDF(sheet, { font })).toBe(pdf); // byte-stable
  });

  it.skipIf(!OTF_PATH)("subsets a non-CID CFF to the used glyphs, keeping ids stable and shrinking it", () => {
    const f = parseFont(new Uint8Array(readFileSync(OTF_PATH!)));
    const gids = new Set<number>();
    for (const ch of "AB 12") gids.add(f.gidForCodepoint(ch.codePointAt(0)!));
    const sub = subsetCFF(f.cff!, gids);
    expect(sub).not.toBeNull();
    expect(sub!.length).toBeLessThan(f.cff!.length); // CharStrings shrank
    expect(sub!.length).toBeGreaterThan(0);
    // a subsetted OTTO still embeds smaller than the whole CFF would
    const sheet = new Sheet({ orientation: "landscape" });
    sheet.add(new TextElement({ x: 20, y: 20 }, "AB 12", { size: 4 }));
    const pdf = exportPDF(sheet, { font: { data: new Uint8Array(readFileSync(OTF_PATH!)) } });
    expect(pdf.length).toBeLessThan(f.cff!.length * 2); // hex of the whole CFF alone would exceed this
  });

  it.skipIf(!CID_OTF_PATH)("subsets a CID-keyed CFF (FDArray/FDSelect), keeping it CID-keyed and much smaller", () => {
    const f = parseFont(new Uint8Array(readFileSync(CID_OTF_PATH!)));
    expect(f.cffIsCID).toBe(true);
    const gids = new Set<number>();
    for (const ch of "AB 12") gids.add(f.gidForCodepoint(ch.codePointAt(0)!));
    const sub = subsetCFF(f.cff!, gids);
    expect(sub).not.toBeNull();
    expect(sub!.length).toBeLessThan(f.cff!.length); // CharStrings blanked
    // the subset is still a CID-keyed CFF → embeds as /CIDFontType0C
    const pdf = exportPDF(
      new Sheet({ orientation: "landscape" }).add(new TextElement({ x: 20, y: 20 }, "AB 12", { size: 4 })),
      { font: { data: new Uint8Array(readFileSync(CID_OTF_PATH!)) } },
    );
    expect(pdf).toContain("/CIDFontType0C");
  });
});

function sheetWithText(content: string): Sheet {
  const sheet = new Sheet({ orientation: "landscape" });
  sheet.add(new TextElement({ x: 20, y: 20 }, content, { size: 3 }));
  return sheet;
}

describe("exportPDF with an embedded font", () => {
  it("builds a Type0/Identity-H composite font with a hex-encoded FontFile2", () => {
    const pdf = exportPDF(sheetWithText("AB"), { font: { data: TEST_FONT } });
    expect(pdf).toContain("/Subtype /Type0");
    expect(pdf).toContain("/Encoding /Identity-H");
    expect(pdf).toContain("/Subtype /CIDFontType2");
    expect(pdf).toContain("/CIDToGIDMap /Identity");
    expect(pdf).toContain("/FontFile2");
    expect(pdf).toContain("/Filter /ASCIIHexDecode");
    expect(pdf).toContain("/BaseFont /TestFont");
    expect(pdf).toContain("/ToUnicode");
  });

  it("emits text as Identity-H hex glyph ids (A→0001, B→0002)", () => {
    const pdf = exportPDF(sheetWithText("AB"), { font: { data: TEST_FONT } });
    expect(pdf).toContain("<00010002> Tj");
  });

  it("renders the diameter symbol as its real glyph and maps it back in ToUnicode", () => {
    const sheet = new Sheet({ orientation: "landscape" });
    sheet.add(new DiameterDimension({ x: 40, y: 40 }, 5, { angleDeg: 45 })); // label starts with ⌀ (U+2300 → gid 3)
    const pdf = exportPDF(sheet, { font: { data: TEST_FONT } });
    expect(pdf).toMatch(/<0003[0-9a-f]*> Tj/); // a run beginning with the diameter glyph
    expect(pdf).toContain("<0003> <2300>"); // ToUnicode: gid 3 → U+2300
    expect(pdf).not.toContain("(Ø"); // not the ASCII substitution used by the standard-font path
  });

  it("keeps the whole PDF plain-ASCII and deterministic", () => {
    const pdf = exportPDF(sheetWithText("café ⌀"), { font: { data: TEST_FONT } });
    expect([...pdf].every((c) => c.charCodeAt(0) < 128)).toBe(true);
    expect(exportPDF(sheetWithText("café ⌀"), { font: { data: TEST_FONT } })).toBe(pdf); // stable
  });

  it("falls back to standard Helvetica (with substitution) when no font is given", () => {
    const pdf = exportPDF(sheetWithText("⌀8"));
    expect(pdf).toContain("/BaseFont /Helvetica");
    expect(pdf).not.toContain("/Type0");
    expect(pdf).toContain("(\\3308"); // ⌀ substituted to Ø (0xD8 = octal 330) — standard-font path
  });
});
