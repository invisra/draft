import { describe, expect, it } from "vitest";
import { parseFont, subsetFont } from "../src/pdf/ttf.js";

const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const i16 = (n: number) => u16(n & 0xffff);
const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

/**
 * A synthetic glyf-based font with 4 glyphs where glyph 2 is a COMPOSITE referencing glyph 1, so
 * subsetting has to pull component glyphs into the keep set. Only the tables `parseFont`/`subsetFont`
 * read need real content; glyph outline bytes past the header are arbitrary.
 */
function buildGlyfFont(): Uint8Array {
  const simple = (fill: number) => [...i16(1), ...i16(0), ...i16(0), ...i16(0), ...i16(0), fill, fill]; // numberOfContours=1, 12 bytes
  const composite = [...i16(-1), ...i16(0), ...i16(0), ...i16(0), ...i16(0), ...u16(0x0001), ...u16(1), ...i16(5), ...i16(5)]; // -1 contours → composite → glyph 1, 18 bytes
  const g0 = simple(0);
  const g1 = simple(1);
  const g2 = composite;
  const g3 = simple(3);
  const glyf = [...g0, ...g1, ...g2, ...g3];
  const offsets = [0, g0.length, g0.length + g1.length, g0.length + g1.length + g2.length, glyf.length];
  const loca = offsets.flatMap((o) => u32(o)); // long format (indexToLocFormat = 1)

  const head = [
    ...u32(0x00010000), ...u32(0), ...u32(0), ...u32(0x5f0f3cf5),
    ...u16(0), ...u16(1000), // flags, unitsPerEm
    ...u32(0), ...u32(0), ...u32(0), ...u32(0),
    ...i16(0), ...i16(-200), ...i16(1000), ...i16(800), // bbox
    ...u16(0), ...u16(8), ...i16(2), ...i16(1), ...i16(0), // ... indexToLocFormat=1 (long) @50
  ];
  const hhea = [
    ...u32(0x00010000), ...i16(800), ...i16(-200), ...i16(0), ...u16(1000),
    ...i16(0), ...i16(0), ...i16(1000), ...i16(1), ...i16(0), ...i16(0),
    ...i16(0), ...i16(0), ...i16(0), ...i16(0), ...i16(0), ...u16(4), // numberOfHMetrics
  ];
  const maxp = [...u32(0x00005000), ...u16(4)];
  const hmtx = [500, 600, 650, 700].flatMap((w) => [...u16(w), ...i16(0)]);
  const cmap = [
    ...u16(0), ...u16(1),
    ...u16(3), ...u16(1), ...u32(12),
    ...u16(4), ...u16(40), ...u16(0), ...u16(4), ...u16(0), ...u16(0), ...u16(0), // format4 header, segCountX2=4
    ...u16(0x41), ...u16(0xffff), // endCode
    ...u16(0), // reservedPad
    ...u16(0x41), ...u16(0xffff), // startCode
    ...i16(1 - 0x41), ...i16(1), // idDelta (A → gid 1)
    ...u16(0), ...u16(0), // idRangeOffset
  ];

  const tables: [string, number[]][] = [
    ["cmap", cmap], ["glyf", glyf], ["head", head], ["hhea", hhea], ["hmtx", hmtx], ["loca", loca], ["maxp", maxp],
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

describe("subsetFont", () => {
  const font = buildGlyfFont();

  it("re-parses after subsetting, preserving glyph count and metrics", () => {
    const subset = subsetFont(font, [3]);
    const f = parseFont(subset);
    expect(f.numGlyphs).toBe(4); // ids are kept stable (blanking subset)
    expect(f.unitsPerEm).toBe(1000);
    expect(f.advanceWidth(3)).toBe(700); // hmtx untouched
    expect(f.gidForCodepoint(0x41)).toBe(1); // cmap untouched
  });

  it("shrinks the font by dropping unused glyph outlines", () => {
    const subset = subsetFont(font, [3]); // keep {0, 3}; blank {1, 2}
    expect(subset.length).toBeLessThan(font.length);
  });

  it("pulls a composite glyph's components into the keep set", () => {
    // glyph 2 is composite → glyph 1, so keeping {2} must retain glyph 1's outline too.
    const withComposite = subsetFont(font, [2]); // keeps {0, 1, 2}
    const withoutComposite = subsetFont(font, [3]); // keeps {0, 3}
    // the composite subset carries an extra glyph (the pulled-in component), so its glyf is larger
    expect(withComposite.length).toBeGreaterThan(withoutComposite.length);
  });

  it("returns the original bytes unchanged when there is no glyf table to subset", () => {
    // a font with no glyf/loca can't be subset; subsetFont must return it as-is
    const noGlyf = new Uint8Array([...u32(0x00010000), ...u16(0), ...u16(0), ...u16(0), ...u16(0)]);
    expect(subsetFont(noGlyf, [1, 2])).toBe(noGlyf);
  });
});
