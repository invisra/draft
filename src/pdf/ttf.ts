/**
 * A minimal TrueType (sfnt) font reader — just enough to *embed* a
 * caller-supplied font in a PDF: the metrics the font descriptor needs, the
 * `cmap` (Unicode → glyph id) for encoding text, and `hmtx` advance widths for
 * layout. Both outline flavors are supported: `glyf`-based TrueType (sfnt version
 * `0x00010000` or `true`), embedded as a used-glyph subset (`FontFile2`, see
 * {@link subsetFont}); and OpenType/`CFF ` (`OTTO`), whose CFF table is embedded
 * whole as `FontFile3`. The shared tables (`head`/`hhea`/`maxp`/`hmtx`/`cmap`/
 * `name`) parse identically for both.
 */

/** A parsed TrueType font: the metrics and lookups needed to embed it and encode text. */
export interface ParsedFont {
  /** The font's raw bytes (a `glyf` font embeds a used-glyph subset of these as `FontFile2`; a CFF font embeds {@link cff} as `FontFile3`). */
  readonly data: Uint8Array;
  /** Outline flavor: `"glyf"` (TrueType, embedded as `FontFile2`) or `"cff"` (OpenType/`CFF `, embedded as `FontFile3`). */
  readonly outlineType: "glyf" | "cff";
  /** The bare `CFF ` table bytes for an OpenType/CFF font (the `FontFile3` stream); undefined for a `glyf` font. */
  readonly cff?: Uint8Array;
  /** True when the CFF is CID-keyed (its Top DICT has a ROS operator) → embed as `/CIDFontType0C` rather than `/Type1C`. */
  readonly cffIsCID: boolean;
  /** Font design units per em (from `head`); PDF text space is 1000 units/em, so scale by 1000/unitsPerEm. */
  readonly unitsPerEm: number;
  /** Total glyph count (from `maxp`). */
  readonly numGlyphs: number;
  /** Typographic ascent, in font units (from `hhea`). */
  readonly ascent: number;
  /** Typographic descent, in font units (negative, from `hhea`). */
  readonly descent: number;
  /** Global glyph bounding box `[xMin, yMin, xMax, yMax]`, in font units (from `head`). */
  readonly bbox: readonly [number, number, number, number];
  /** PostScript name (from the `name` table), used as the PDF `BaseFont`. */
  readonly postScriptName: string;
  /** Glyph id for a Unicode codepoint, or 0 (`.notdef`) if the font has no glyph for it. */
  gidForCodepoint(codepoint: number): number;
  /** Advance width of a glyph, in font units (from `hmtx`). */
  advanceWidth(gid: number): number;
}

function tag(dv: DataView, offset: number): string {
  return String.fromCharCode(dv.getUint8(offset), dv.getUint8(offset + 1), dv.getUint8(offset + 2), dv.getUint8(offset + 3));
}

interface Cmap {
  lookup(codepoint: number): number;
}

/** cmap format 4 (segment mapping to delta values) — the BMP subtable present in essentially every font. */
function parseCmap4(dv: DataView, base: number): Cmap {
  const segCountX2 = dv.getUint16(base + 6);
  const segCount = segCountX2 / 2;
  const endCodes = base + 14;
  const startCodes = endCodes + segCountX2 + 2; // +2 reservedPad
  const idDeltas = startCodes + segCountX2;
  const idRangeOffsets = idDeltas + segCountX2;
  const map = new Map<number, number>();
  for (let s = 0; s < segCount; s++) {
    const end = dv.getUint16(endCodes + s * 2);
    const start = dv.getUint16(startCodes + s * 2);
    const idDelta = dv.getInt16(idDeltas + s * 2);
    const idRangeOffset = dv.getUint16(idRangeOffsets + s * 2);
    if (start === 0xffff) continue;
    for (let c = start; c <= end; c++) {
      let gid: number;
      if (idRangeOffset === 0) {
        gid = (c + idDelta) & 0xffff;
      } else {
        const glyphIndexAddr = idRangeOffsets + s * 2 + idRangeOffset + (c - start) * 2;
        gid = dv.getUint16(glyphIndexAddr);
        if (gid !== 0) gid = (gid + idDelta) & 0xffff;
      }
      if (gid !== 0) map.set(c, gid);
    }
  }
  return { lookup: (cp) => map.get(cp) ?? 0 };
}

/** cmap format 12 (segmented coverage) — full-Unicode subtable; searched by group so astral ranges don't blow up memory. */
function parseCmap12(dv: DataView, base: number): Cmap {
  const nGroups = dv.getUint32(base + 12);
  const groups = base + 16;
  return {
    lookup(cp) {
      // groups are sorted by start code; linear scan (font group counts are modest for our use)
      for (let g = 0; g < nGroups; g++) {
        const o = groups + g * 12;
        const start = dv.getUint32(o);
        const end = dv.getUint32(o + 4);
        if (cp >= start && cp <= end) return dv.getUint32(o + 8) + (cp - start);
      }
      return 0;
    },
  };
}

function parseCmap(dv: DataView, cmapOffset: number): Cmap {
  const numTables = dv.getUint16(cmapOffset + 2);
  let best: { score: number; subOffset: number; format: number } | null = null;
  for (let i = 0; i < numTables; i++) {
    const rec = cmapOffset + 4 + i * 8;
    const platformID = dv.getUint16(rec);
    const encodingID = dv.getUint16(rec + 2);
    const subOffset = cmapOffset + dv.getUint32(rec + 4);
    const format = dv.getUint16(subOffset);
    if (format !== 4 && format !== 12) continue;
    // prefer full-Unicode (3,10 / format 12) over BMP (3,1 / 0,3 format 4)
    let score = format === 12 ? 3 : 1;
    if (platformID === 3 && (encodingID === 1 || encodingID === 10)) score += 1;
    if (platformID === 0) score += 1;
    if (!best || score > best.score) best = { score, subOffset, format };
  }
  if (!best) throw new Error("Embedded font has no usable Unicode cmap subtable (need format 4 or 12)");
  return best.format === 12 ? parseCmap12(dv, best.subOffset) : parseCmap4(dv, best.subOffset);
}

function parsePostScriptName(dv: DataView, nameOffset: number): string {
  const count = dv.getUint16(nameOffset + 2);
  const stringOffset = nameOffset + dv.getUint16(nameOffset + 4);
  let fallback = "";
  for (let i = 0; i < count; i++) {
    const rec = nameOffset + 6 + i * 12;
    const platformID = dv.getUint16(rec);
    const nameID = dv.getUint16(rec + 6);
    if (nameID !== 6) continue; // 6 = PostScript name
    const length = dv.getUint16(rec + 8);
    const offset = stringOffset + dv.getUint16(rec + 10);
    let s = "";
    if (platformID === 3 || platformID === 0) {
      for (let j = 0; j < length; j += 2) s += String.fromCharCode(dv.getUint16(offset + j)); // UTF-16BE
    } else {
      for (let j = 0; j < length; j++) s += String.fromCharCode(dv.getUint8(offset + j)); // Mac Roman / ASCII
    }
    // a PostScript name is ASCII with no spaces; keep the Windows record if there is one
    const clean = s.replace(/[^\x21-\x7e]/g, "");
    if (platformID === 3) return clean || "EmbeddedFont";
    fallback = clean;
  }
  return fallback || "EmbeddedFont";
}

/** Parses the tables of a TrueType font needed to embed it and encode text. Throws on CFF/OpenType or missing required tables. */
export function parseFont(data: Uint8Array): ParsedFont {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const version = dv.getUint32(0);
  const isOTTO = version === 0x4f54544f; // 'OTTO' — OpenType with CFF outlines
  if (version !== 0x00010000 && version !== 0x74727565 /* 'true' */ && !isOTTO) {
    throw new Error("Unsupported font: expected a glyf-based TrueType (.ttf) or an OpenType/CFF (.otf); got an unknown sfnt (e.g. a .ttc collection or WOFF)");
  }
  const numTables = dv.getUint16(4);
  const tables = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    tables.set(tag(dv, rec), { offset: dv.getUint32(rec + 8), length: dv.getUint32(rec + 12) });
  }
  const need = (name: string): number => {
    const t = tables.get(name);
    if (!t) throw new Error(`Embedded font is missing the required "${name}" table`);
    return t.offset;
  };

  const head = need("head");
  const unitsPerEm = dv.getUint16(head + 18);
  const bbox: [number, number, number, number] = [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)];

  const hhea = need("hhea");
  const ascent = dv.getInt16(hhea + 4);
  const descent = dv.getInt16(hhea + 6);
  const numberOfHMetrics = dv.getUint16(hhea + 34);

  const numGlyphs = dv.getUint16(need("maxp") + 4);
  const hmtx = need("hmtx");
  const cmap = parseCmap(dv, need("cmap"));
  const nameTable = tables.get("name");
  const postScriptName = nameTable ? parsePostScriptName(dv, nameTable.offset) : "EmbeddedFont";

  const cffTable = tables.get("CFF ");
  const cff = cffTable ? data.subarray(cffTable.offset, cffTable.offset + cffTable.length) : undefined;
  const outlineType: "glyf" | "cff" = cff ? "cff" : "glyf";
  const cffIsCID = cff ? cffIsCIDKeyed(cff) : false;

  const advanceWidth = (gid: number): number => {
    const i = gid < numberOfHMetrics ? gid : numberOfHMetrics - 1; // monospace/last-width tail
    return dv.getUint16(hmtx + i * 4);
  };

  const parsed: ParsedFont = {
    data,
    outlineType,
    cffIsCID,
    unitsPerEm,
    numGlyphs,
    ascent,
    descent,
    bbox,
    postScriptName,
    gidForCodepoint: (cp) => cmap.lookup(cp),
    advanceWidth,
  };
  return cff ? { ...parsed, cff } : parsed;
}

/**
 * Detects whether a CFF font program is CID-keyed by scanning its Top DICT for the ROS operator
 * (`12 30`). A CID-keyed CFF embeds as `/CIDFontType0C`; a plain (non-CID) CFF as `/Type1C`.
 * Walks the CFF header → Name INDEX → Top DICT INDEX[0], then scans that DICT's operators.
 */
function cffIsCIDKeyed(cff: Uint8Array): boolean {
  const dv = new DataView(cff.buffer, cff.byteOffset, cff.byteLength);
  try {
    const hdrSize = cff[2]!; // header: major, minor, hdrSize, offSize
    // Each INDEX: count(u16), offSize(u8), offsets[(count+1)*offSize], data. Returns the end offset.
    const skipIndex = (pos: number): { end: number; first: number; second: number } => {
      const count = dv.getUint16(pos);
      if (count === 0) return { end: pos + 2, first: 0, second: 0 };
      const offSize = cff[pos + 2]!;
      const readOff = (i: number) => {
        let v = 0;
        for (let b = 0; b < offSize; b++) v = (v << 8) | cff[pos + 3 + i * offSize + b]!;
        return v;
      };
      const base = pos + 3 + (count + 1) * offSize - 1;
      const dataStart = base + readOff(0);
      return { end: base + readOff(count), first: dataStart, second: base + readOff(1) };
    };
    const nameIndex = skipIndex(hdrSize); // Name INDEX
    const topDict = skipIndex(nameIndex.end); // Top DICT INDEX
    // scan Top DICT INDEX[0] operators for ROS (12 30)
    for (let p = topDict.first; p < topDict.second; ) {
      const b = cff[p]!;
      if (b === 12) {
        if (cff[p + 1] === 30) return true; // ROS
        p += 2;
      } else if (b <= 21) {
        p += 1; // other operators
      } else if (b === 28) {
        p += 3;
      } else if (b === 29) {
        p += 5;
      } else if (b === 30) {
        // real number: bytes until a nibble 0xf
        p += 1;
        while (p < topDict.second && (cff[p]! & 0x0f) !== 0x0f && (cff[p]! >> 4) !== 0x0f) p += 1;
        p += 1;
      } else if (b >= 32 && b <= 246) {
        p += 1;
      } else if (b >= 247 && b <= 254) {
        p += 2;
      } else {
        p += 1;
      }
    }
  } catch {
    return false; // malformed DICT — treat as non-CID
  }
  return false;
}

// ---- CFF (Type2) subsetting -------------------------------------------------
// A "blanking" subset mirroring the glyf approach: keep every glyph id and all
// subrs/charset/strings, and only shrink the (dominant) CharStrings INDEX by
// replacing unused charstrings with a bare `endchar`. GIDs stay stable, so the
// Identity-H encoding, /W array, and CID==GID assumption all remain valid.

/** A CFF INDEX: the per-object byte slices and the offset just past the INDEX. */
interface CffIndex {
  objects: Uint8Array[];
  end: number;
}

/** Reads a CFF INDEX starting at `pos`. */
function readCffIndex(cff: Uint8Array, dv: DataView, pos: number): CffIndex {
  const count = dv.getUint16(pos);
  if (count === 0) return { objects: [], end: pos + 2 };
  const offSize = cff[pos + 2]!;
  const offArr = pos + 3;
  const readOff = (i: number): number => {
    let v = 0;
    for (let b = 0; b < offSize; b++) v = (v << 8) | cff[offArr + i * offSize + b]!;
    return v;
  };
  const dataBase = offArr + (count + 1) * offSize - 1;
  const objects: Uint8Array[] = [];
  for (let i = 0; i < count; i++) objects.push(cff.subarray(dataBase + readOff(i), dataBase + readOff(i + 1)));
  return { objects, end: dataBase + readOff(count) };
}

/** Serializes byte-slices into a CFF INDEX. */
function writeCffIndex(objects: Uint8Array[]): Uint8Array {
  if (objects.length === 0) return new Uint8Array([0, 0]);
  const total = objects.reduce((n, o) => n + o.length, 0);
  const offSize = total + 1 <= 0xff ? 1 : total + 1 <= 0xffff ? 2 : total + 1 <= 0xffffff ? 3 : 4;
  const count = objects.length;
  const out = new Uint8Array(3 + (count + 1) * offSize + total);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, count);
  out[2] = offSize;
  const writeOff = (i: number, v: number) => {
    for (let b = 0; b < offSize; b++) out[3 + i * offSize + b] = (v >>> (8 * (offSize - 1 - b))) & 0xff;
  };
  let off = 1;
  writeOff(0, off);
  let dataPos = 3 + (count + 1) * offSize;
  objects.forEach((o, i) => {
    out.set(o, dataPos);
    dataPos += o.length;
    off += o.length;
    writeOff(i + 1, off);
  });
  return out;
}

/** One parsed CFF DICT entry: operator id (12xx for two-byte ops), decoded operands, and the raw bytes. */
interface DictEntry {
  op: number;
  operands: number[];
  raw: Uint8Array;
}

/** Parses a CFF DICT into operator entries, preserving each entry's raw bytes for verbatim re-emission. */
function parseCffDict(data: Uint8Array): DictEntry[] {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const entries: DictEntry[] = [];
  let operands: number[] = [];
  let start = 0;
  let i = 0;
  while (i < data.length) {
    const b = data[i]!;
    if (b <= 21) {
      let op = b;
      let len = 1;
      if (b === 12) {
        op = 1200 + data[i + 1]!;
        len = 2;
      }
      entries.push({ op, operands, raw: data.slice(start, i + len) });
      operands = [];
      i += len;
      start = i;
    } else if (b === 28) {
      operands.push(dv.getInt16(i + 1));
      i += 3;
    } else if (b === 29) {
      operands.push(dv.getInt32(i + 1));
      i += 5;
    } else if (b === 30) {
      i += 1;
      while (i < data.length) {
        const nib = data[i]!;
        i += 1;
        if ((nib & 0x0f) === 0x0f || (nib >> 4) === 0x0f) break;
      }
      operands.push(NaN); // a real number; value not needed for the operators we rewrite
    } else if (b >= 32 && b <= 246) {
      operands.push(b - 139);
      i += 1;
    } else if (b >= 247 && b <= 250) {
      operands.push((b - 247) * 256 + data[i + 1]! + 108);
      i += 2;
    } else if (b >= 251 && b <= 254) {
      operands.push(-(b - 251) * 256 - data[i + 1]! - 108);
      i += 2;
    } else {
      i += 1; // 22-27, 31, 255 are reserved
    }
  }
  return entries;
}

/** Encodes an integer as a fixed 5-byte CFF DICT operand, so rewritten offsets don't change the DICT's length. */
function encCffInt5(n: number): number[] {
  return [29, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

/** Length in bytes of a CFF charset table covering `numGlyphs` glyphs (formats 0/1/2). */
function cffCharsetLength(cff: Uint8Array, dv: DataView, off: number, numGlyphs: number): number {
  const fmt = cff[off]!;
  if (fmt === 0) return 1 + (numGlyphs - 1) * 2;
  let covered = 1; // .notdef is implicit
  let p = off + 1;
  while (covered < numGlyphs) {
    p += 2; // first SID
    const nLeft = fmt === 1 ? cff[p]! : dv.getUint16(p);
    p += fmt === 1 ? 1 : 2;
    covered += nLeft + 1;
  }
  return p - off;
}

/** Length in bytes of a CFF FDSelect table for `numGlyphs` glyphs (formats 0 and 3). */
function cffFDSelectLength(cff: Uint8Array, dv: DataView, off: number, numGlyphs: number): number {
  const fmt = cff[off]!;
  if (fmt === 0) return 1 + numGlyphs;
  if (fmt === 3) return 1 + 2 + dv.getUint16(off + 1) * 3 + 2; // format, nRanges, ranges[3], sentinel
  throw new Error("unsupported FDSelect format");
}

/**
 * Subsets a CFF font program to the glyphs in `keep` (plus GID 0), by blanking unused charstrings
 * while keeping glyph ids, subrs, charset, and strings intact — so ids/metrics stay stable and the
 * Identity-H (CID==GID) encoding remains valid. Handles both plain (Type1C) and CID-keyed
 * (FDArray/FDSelect) CFFs. Returns the new `CFF ` table bytes, or `null` on an unexpected structure —
 * in which case the caller embeds the CFF whole.
 */
export function subsetCFF(cff: Uint8Array, keep: Iterable<number>): Uint8Array | null {
  try {
    const dv = new DataView(cff.buffer, cff.byteOffset, cff.byteLength);
    const hdrSize = cff[2]!;
    const header = cff.subarray(0, hdrSize);
    const nameIndex = readCffIndex(cff, dv, hdrSize);
    const nameBytes = cff.subarray(hdrSize, nameIndex.end);
    const topDictIndex = readCffIndex(cff, dv, nameIndex.end);
    if (topDictIndex.objects.length !== 1) return null;
    const stringIndex = readCffIndex(cff, dv, topDictIndex.end);
    const stringBytes = cff.subarray(topDictIndex.end, stringIndex.end);
    const globalSubr = readCffIndex(cff, dv, stringIndex.end);
    const globalSubrBytes = cff.subarray(stringIndex.end, globalSubr.end);

    const topEntries = parseCffDict(topDictIndex.objects[0]!);
    const find = (op: number) => topEntries.find((e) => e.op === op);
    const charStringsEntry = find(17);
    if (!charStringsEntry) return null;
    const charsetEntry = find(15);
    const charsetVal = charsetEntry ? charsetEntry.operands[0]! : 0;

    // Blank the CharStrings: keep used glyphs, replace the rest with a bare `endchar` (0x0e).
    const charStrings = readCffIndex(cff, dv, charStringsEntry.operands[0]!);
    const numGlyphs = charStrings.objects.length;
    const keepSet = new Set<number>([0]);
    for (const g of keep) if (g >= 0 && g < numGlyphs) keepSet.add(g);
    const endchar = new Uint8Array([14]);
    const newCharStrings = writeCffIndex(charStrings.objects.map((o, gid) => (keepSet.has(gid) ? o : endchar)));

    // A Private DICT + its Local Subrs, kept contiguous with the Subrs offset (op 19) rewritten so it
    // stays valid; fixed-width so the DICT length is stable. Returns [newPrivateDict, localSubrBytes].
    const buildPrivateBlock = (privOffset: number, privSize: number): [Uint8Array, Uint8Array] => {
      const privEntries = parseCffDict(cff.subarray(privOffset, privOffset + privSize));
      const subrsEntry = privEntries.find((e) => e.op === 19);
      let subrs = cff.subarray(0, 0);
      if (subrsEntry) {
        const ls = readCffIndex(cff, dv, privOffset + subrsEntry.operands[0]!);
        subrs = cff.subarray(privOffset + subrsEntry.operands[0]!, ls.end);
      }
      const build = (rel: number): Uint8Array => {
        const out: number[] = [];
        for (const e of privEntries) {
          if (e.op === 19) out.push(...encCffInt5(rel), 19);
          else out.push(...Array.from(e.raw));
        }
        return new Uint8Array(out);
      };
      return subrsEntry ? [build(build(0).length), subrs] : [cff.slice(privOffset, privOffset + privSize), subrs];
    };

    // charset copied verbatim only when it's a real offset (0/1/2 are predefined; CID fonts always custom).
    const keepCharset = charsetVal > 2;
    const charsetBytes = keepCharset ? cff.slice(charsetVal, charsetVal + cffCharsetLength(cff, dv, charsetVal, numGlyphs)) : new Uint8Array(0);

    // Top DICT built with fixed-width (5-byte) offset operands so its length is stable across the
    // two-pass layout. Encoding (op 16) is dropped — bypassed under Identity-H.
    const buildTop = (o: { charset: number; charStrings: number; privOffset?: number; privSize?: number; fdArray?: number; fdSelect?: number }): Uint8Array => {
      const out: number[] = [];
      for (const e of topEntries) {
        if (e.op === 16) continue; // drop Encoding
        else if (e.op === 17) out.push(...encCffInt5(o.charStrings), 17);
        else if (e.op === 15 && keepCharset) out.push(...encCffInt5(o.charset), 15);
        else if (e.op === 18) out.push(...encCffInt5(o.privSize!), ...encCffInt5(o.privOffset!), 18);
        else if (e.op === 1236) out.push(...encCffInt5(o.fdArray!), 12, 36);
        else if (e.op === 1237) out.push(...encCffInt5(o.fdSelect!), 12, 37);
        else out.push(...Array.from(e.raw));
      }
      return new Uint8Array(out);
    };

    const assemble = (parts: Uint8Array[]): Uint8Array => {
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let pos = 0;
      for (const p of parts) {
        out.set(p, pos);
        pos += p.length;
      }
      return out;
    };

    const fdArrayEntry = find(1236);
    if (fdArrayEntry) {
      // ---- CID-keyed: charset + FDSelect + CharStrings + FDArray + per-FD (Private + Local Subrs) ----
      const fdSelectEntry = find(1237);
      if (!fdSelectEntry) return null;
      const fdSelectOffset = fdSelectEntry.operands[0]!;
      const fdSelectBytes = cff.slice(fdSelectOffset, fdSelectOffset + cffFDSelectLength(cff, dv, fdSelectOffset, numGlyphs));

      const fdArray = readCffIndex(cff, dv, fdArrayEntry.operands[0]!);
      // For each Font DICT: rebuild its Private block and remember it.
      const fds = fdArray.objects.map((fd) => {
        const entries = parseCffDict(fd);
        const priv = entries.find((e) => e.op === 18);
        if (!priv) throw new Error("CID Font DICT without a Private DICT");
        const [dict, subrs] = buildPrivateBlock(priv.operands[1]!, priv.operands[0]!);
        return { entries, dict, subrs };
      });
      const buildFontDict = (entries: DictEntry[], privSize: number, privOffset: number): Uint8Array => {
        const out: number[] = [];
        for (const e of entries) {
          if (e.op === 18) out.push(...encCffInt5(privSize), ...encCffInt5(privOffset), 18);
          else out.push(...Array.from(e.raw));
        }
        return new Uint8Array(out);
      };
      const fdArrayIndexLen = writeCffIndex(fds.map((fd) => buildFontDict(fd.entries, fd.dict.length, 0))).length;
      const topLen = writeCffIndex([buildTop({ charset: 0, charStrings: 0, fdArray: 0, fdSelect: 0 })]).length;

      const prefix = header.length + nameBytes.length + topLen + stringBytes.length + globalSubrBytes.length;
      const charsetPos = prefix;
      const fdSelectPos = charsetPos + charsetBytes.length;
      const charStringsPos = fdSelectPos + fdSelectBytes.length;
      const fdArrayPos = charStringsPos + newCharStrings.length;
      let privRunning = fdArrayPos + fdArrayIndexLen;
      const privPos = fds.map((fd) => {
        const at = privRunning;
        privRunning += fd.dict.length + fd.subrs.length;
        return at;
      });
      const fdArrayIndex = writeCffIndex(fds.map((fd, i) => buildFontDict(fd.entries, fd.dict.length, privPos[i]!)));
      if (fdArrayIndex.length !== fdArrayIndexLen) return null;
      const top = writeCffIndex([buildTop({ charset: charsetPos, charStrings: charStringsPos, fdArray: fdArrayPos, fdSelect: fdSelectPos })]);
      if (top.length !== topLen) return null;

      const parts = [header, nameBytes, top, stringBytes, globalSubrBytes, charsetBytes, fdSelectBytes, newCharStrings, fdArrayIndex];
      for (const fd of fds) parts.push(fd.dict, fd.subrs);
      return assemble(parts);
    }

    // ---- Non-CID (Type1C): charset + CharStrings + Private + Local Subrs ----
    const privateEntry = find(18);
    if (!privateEntry) return null;
    const [newPrivDict, localSubrBytes] = buildPrivateBlock(privateEntry.operands[1]!, privateEntry.operands[0]!);
    const topLen = writeCffIndex([buildTop({ charset: 0, charStrings: 0, privOffset: 0, privSize: newPrivDict.length })]).length;
    const prefix = header.length + nameBytes.length + topLen + stringBytes.length + globalSubrBytes.length;
    const charsetPos = prefix;
    const charStringsPos = charsetPos + charsetBytes.length;
    const privPos = charStringsPos + newCharStrings.length;
    const top = writeCffIndex([buildTop({ charset: charsetPos, charStrings: charStringsPos, privOffset: privPos, privSize: newPrivDict.length })]);
    if (top.length !== topLen) return null;
    return assemble([header, nameBytes, top, stringBytes, globalSubrBytes, charsetBytes, newCharStrings, newPrivDict, localSubrBytes]);
  } catch {
    return null; // any parse surprise → embed the CFF whole
  }
}

/** big-endian uint32 checksum of a byte array, as required by the sfnt table directory / head. */
function checksum(bytes: Uint8Array): number {
  let sum = 0;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < bytes.length; i += 4) {
    // the array is 4-byte padded by callers, so a full uint32 is always readable
    sum = (sum + dv.getUint32(i)) >>> 0;
  }
  return sum >>> 0;
}

/** Rounds a length up to the next multiple of 4 (sfnt tables are 4-byte aligned). */
function pad4(n: number): number {
  return (n + 3) & ~3;
}

/**
 * Subsets a glyf-based TrueType font down to a set of glyph ids, keeping every glyph id and the glyph
 * count unchanged (a "blanking" subset): kept glyphs retain their bytes, unused glyphs become empty
 * `loca` entries. Because ids and `hmtx`/`cmap`/`numGlyphs` are untouched, the caller's Identity-H
 * encoding, `CIDToGIDMap /Identity`, and `/W` array all stay valid — only the (dominant) `glyf` table
 * shrinks. Composite glyphs pull their component glyphs into the keep set transitively. Returns the
 * original bytes unchanged if the font can't be subset (e.g. missing `glyf`/`loca`).
 */
export function subsetFont(data: Uint8Array, keep: Iterable<number>): Uint8Array {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const version = dv.getUint32(0);
  if (version !== 0x00010000 && version !== 0x74727565) return data;
  const numTables = dv.getUint16(4);
  const dir = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    dir.set(tag(dv, rec), { offset: dv.getUint32(rec + 8), length: dv.getUint32(rec + 12) });
  }
  const glyfT = dir.get("glyf");
  const locaT = dir.get("loca");
  const headT = dir.get("head");
  const maxpT = dir.get("maxp");
  if (!glyfT || !locaT || !headT || !maxpT) return data; // no outlines to subset; embed whole
  const numGlyphs = dv.getUint16(maxpT.offset + 4);
  const longLoca = dv.getInt16(headT.offset + 50) === 1;

  const loca: number[] = [];
  for (let i = 0; i <= numGlyphs; i++) {
    loca.push(longLoca ? dv.getUint32(locaT.offset + i * 4) : dv.getUint16(locaT.offset + i * 2) * 2);
  }

  // Keep set: glyph 0 (.notdef) is always kept; composite glyphs pull in their components transitively.
  const kept = new Set<number>([0]);
  const stack: number[] = [0];
  for (const g of keep) if (g >= 0 && g < numGlyphs) kept.add(g);
  stack.push(...kept);
  while (stack.length) {
    const g = stack.pop()!;
    const start = loca[g]!;
    const end = loca[g + 1]!;
    if (end <= start) continue;
    if (dv.getInt16(glyfT.offset + start) >= 0) continue; // simple glyph → no components
    let p = glyfT.offset + start + 10;
    for (;;) {
      const flags = dv.getUint16(p);
      const compGid = dv.getUint16(p + 2);
      p += 4;
      if (!kept.has(compGid)) {
        kept.add(compGid);
        stack.push(compGid);
      }
      p += flags & 0x0001 ? 4 : 2; // ARG_1_AND_2_ARE_WORDS
      if (flags & 0x0008) p += 2; // WE_HAVE_A_SCALE
      else if (flags & 0x0040) p += 4; // WE_HAVE_AN_X_AND_Y_SCALE
      else if (flags & 0x0080) p += 8; // WE_HAVE_A_TWO_BY_TWO
      if (!(flags & 0x0020)) break; // MORE_COMPONENTS
    }
  }

  // New glyf (kept glyph bytes verbatim, others empty) + long-format loca.
  const glyfParts: Uint8Array[] = [];
  const newLoca = new Uint8Array((numGlyphs + 1) * 4);
  const nlv = new DataView(newLoca.buffer);
  let glyfLen = 0;
  for (let g = 0; g < numGlyphs; g++) {
    nlv.setUint32(g * 4, glyfLen);
    const start = loca[g]!;
    const end = loca[g + 1]!;
    if (kept.has(g) && end > start) {
      const bytes = data.subarray(glyfT.offset + start, glyfT.offset + end);
      glyfParts.push(bytes);
      glyfLen += bytes.length;
      if (bytes.length % 2 !== 0) {
        glyfParts.push(new Uint8Array(1)); // pad each glyph to an even boundary
        glyfLen += 1;
      }
    }
  }
  nlv.setUint32(numGlyphs * 4, glyfLen);
  const newGlyf = new Uint8Array(glyfLen);
  {
    let o = 0;
    for (const part of glyfParts) {
      newGlyf.set(part, o);
      o += part.length;
    }
  }

  // head with long loca format and a zeroed checkSumAdjustment (recomputed once the font is assembled).
  const newHead = data.slice(headT.offset, headT.offset + headT.length);
  new DataView(newHead.buffer).setUint32(8, 0); // checkSumAdjustment
  new DataView(newHead.buffer).setInt16(50, 1); // indexToLocFormat = long

  const newTables = new Map<string, Uint8Array>();
  for (const [name, t] of dir) newTables.set(name, data.slice(t.offset, t.offset + t.length));
  newTables.set("glyf", newGlyf);
  newTables.set("loca", newLoca);
  newTables.set("head", newHead);

  // Reassemble the sfnt: header, directory (sorted by tag), then 4-byte-aligned table data.
  const names = [...newTables.keys()].sort();
  const count = names.length;
  const headerLen = 12 + count * 16;
  let total = headerLen;
  for (const name of names) total += pad4(newTables.get(name)!.length);
  const out = new Uint8Array(total);
  const odv = new DataView(out.buffer);

  const maxPow2 = 1 << Math.floor(Math.log2(count));
  odv.setUint32(0, version);
  odv.setUint16(4, count);
  odv.setUint16(6, maxPow2 * 16); // searchRange
  odv.setUint16(8, Math.floor(Math.log2(count))); // entrySelector
  odv.setUint16(10, count * 16 - maxPow2 * 16); // rangeShift

  let dataOffset = headerLen;
  let headRecordOffset = 0;
  names.forEach((name, i) => {
    const bytes = newTables.get(name)!;
    const padded = new Uint8Array(pad4(bytes.length));
    padded.set(bytes);
    out.set(padded, dataOffset);
    const rec = 12 + i * 16;
    out[rec] = name.charCodeAt(0);
    out[rec + 1] = name.charCodeAt(1);
    out[rec + 2] = name.charCodeAt(2);
    out[rec + 3] = name.charCodeAt(3);
    odv.setUint32(rec + 4, checksum(padded));
    odv.setUint32(rec + 8, dataOffset);
    odv.setUint32(rec + 12, bytes.length);
    if (name === "head") headRecordOffset = dataOffset;
    dataOffset += padded.length;
  });

  // head.checkSumAdjustment = 0xB1B0AFBA - checksum(entire font)
  odv.setUint32(headRecordOffset + 8, (0xb1b0afba - checksum(out)) >>> 0);
  return out;
}
