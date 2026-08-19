import { describe, expect, it } from "vitest";
import { PdfWriter, pdfArray, pdfDict, pdfNumber, pdfRef, pdfString } from "../src/pdf/pdfWriter.js";

function buildMinimalPdf(): string {
  const writer = new PdfWriter();
  const catalogId = writer.allocateId();
  const pagesId = writer.allocateId();
  const pageId = writer.allocateId();

  const contentId = writer.addStreamObject({}, "0 0 1 rg\n10 10 50 50 re f\n");

  writer.setObject(catalogId, pdfDict({ Type: "/Catalog", Pages: pdfRef(pagesId) }));
  writer.setObject(pagesId, pdfDict({ Type: "/Pages", Kids: pdfArray([pdfRef(pageId)]), Count: "1" }));
  writer.setObject(
    pageId,
    pdfDict({
      Type: "/Page",
      Parent: pdfRef(pagesId),
      MediaBox: pdfArray(["0", "0", "200", "100"].map((v) => v)),
      Contents: pdfRef(contentId),
    }),
  );

  return writer.build(catalogId);
}

describe("pdfDict/pdfArray/pdfString/pdfNumber", () => {
  it("serializes a dict as space-separated /Key value pairs", () => {
    expect(pdfDict({ Type: "/Catalog", Count: "3" })).toBe("<< /Type /Catalog /Count 3 >>");
  });

  it("serializes an array with brackets", () => {
    expect(pdfArray(["1", "2", "3"])).toBe("[1 2 3]");
  });

  it("escapes backslash and parens in literal strings", () => {
    expect(pdfString("a(b)c\\d")).toBe("(a\\(b\\)c\\\\d)");
  });

  it("octal-escapes non-ASCII Latin-1 characters and substitutes '?' beyond Latin-1", () => {
    expect(pdfString("café")).toBe("(caf\\351)"); // é = U+00E9 = octal 351
    expect(pdfString("⌀")).toBe("(?)"); // beyond Latin-1
  });

  it("trims trailing zeros from numbers", () => {
    expect(pdfNumber(10)).toBe("10");
    expect(pdfNumber(1.5)).toBe("1.5");
  });
});

describe("PdfWriter", () => {
  it("throws when build() is called with an unset allocated object", () => {
    const writer = new PdfWriter();
    const id = writer.allocateId();
    expect(() => writer.build(id)).toThrow();
  });

  it("produces a file starting with the PDF header and ending with %%EOF", () => {
    const pdf = buildMinimalPdf();
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.endsWith("%%EOF")).toBe(true);
  });

  it("records each object's xref offset pointing at its actual byte position", () => {
    const pdf = buildMinimalPdf();
    const xrefStart = parseInt(/startxref\n(\d+)\n/.exec(pdf)![1]!, 10);
    const xrefSection = pdf.slice(xrefStart);
    expect(xrefSection.startsWith("xref\n")).toBe(true);

    // every recorded in-use offset must point exactly at "<id> 0 obj"
    const entryLines = xrefSection.split("\n").slice(2); // skip "xref" and "0 N"
    let id = 1;
    for (const line of entryLines) {
      const m = /^(\d{10}) \d{5} n $/.exec(line);
      if (!m) continue;
      const offset = parseInt(m[1]!, 10);
      expect(pdf.slice(offset, offset + `${id} 0 obj`.length)).toBe(`${id} 0 obj`);
      id++;
    }
    expect(id).toBeGreaterThan(1);
  });

  it("computes the stream's /Length as the exact byte length of its content", () => {
    const writer = new PdfWriter();
    const content = "0 0 1 rg\n10 10 50 50 re f\n";
    const id = writer.addStreamObject({}, content);
    writer.build(id); // won't have a valid catalog, but that's fine — just inspecting the object body
    const pdf = writer.build(writer.addObject(pdfDict({ Type: "/Catalog" })));
    const objBody = pdf.slice(pdf.indexOf(`${id} 0 obj`));
    expect(objBody).toContain(`/Length ${content.length}`);
  });
});
