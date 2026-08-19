/**
 * A minimal, generic PDF file assembler: object allocation, dictionary/array/string
 * serialization, and the xref table + trailer. Deliberately produces plain-ASCII, uncompressed
 * content streams (no zlib dependency, and no `/ID`, timestamps, or other non-deterministic
 * trailer entries) — the same byte sequence for the same input every time, so generated PDFs can
 * be snapshot-tested like this library's SVG/DXF output.
 */

export function pdfRef(id: number): string {
  return `${id} 0 R`;
}

export function pdfDict(entries: Record<string, string>): string {
  const body = Object.entries(entries)
    .map(([k, v]) => `/${k} ${v}`)
    .join(" ");
  return `<< ${body} >>`;
}

export function pdfArray(items: readonly string[]): string {
  return `[${items.join(" ")}]`;
}

export function pdfNumber(n: number): string {
  const v = Object.is(n, -0) ? 0 : n;
  return Number(v.toFixed(4)).toString();
}

/**
 * A PDF literal string `(...)`, escaping backslash/parens and octal-escaping any byte outside
 * printable ASCII (PDF literal strings are single-byte PDFDocEncoding/Latin-1, not UTF-8).
 * Codepoints beyond Latin-1 (U+0100+) have no representation in a plain literal string and are
 * substituted with "?" rather than corrupting the file — callers needing those characters (this
 * library's Unicode drafting symbols) must substitute an ASCII-safe equivalent before this point.
 */
export function pdfString(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === "(") out += "\\(";
    else if (ch === ")") out += "\\)";
    else if (code >= 32 && code <= 126) out += ch;
    else if (code <= 255) out += "\\" + code.toString(8).padStart(3, "0");
    else out += "?";
  }
  return `(${out})`;
}

function xrefEntry(offset: number, generation: number, inUse: boolean): string {
  // exactly 20 bytes per the PDF spec (7.5.4): 10-digit offset, space, 5-digit generation, space,
  // f/n, then a 2-byte eol — here " \n" (space + line feed), one of the two sequences it permits
  return `${String(offset).padStart(10, "0")} ${String(generation).padStart(5, "0")} ${inUse ? "n" : "f"} \n`;
}

export class PdfWriter {
  private readonly objects = new Map<number, string>();
  private nextId = 1;

  allocateId(): number {
    return this.nextId++;
  }

  setObject(id: number, body: string): void {
    this.objects.set(id, body);
  }

  addObject(body: string): number {
    const id = this.allocateId();
    this.setObject(id, body);
    return id;
  }

  /** `content` must be plain ASCII (see module doc) — its .length is used verbatim as the stream's byte /Length. */
  addStreamObject(dictEntries: Record<string, string>, content: string): number {
    const dict = pdfDict({ ...dictEntries, Length: String(content.length) });
    return this.addObject(`${dict}\nstream\n${content}\nendstream`);
  }

  /** Assembles the complete PDF file. `rootId` must be an already-set object (the /Catalog). */
  build(rootId: number): string {
    const maxId = this.nextId - 1;
    let out = "%PDF-1.4\n";
    const offsets: number[] = new Array(maxId + 1).fill(0);

    for (let id = 1; id <= maxId; id++) {
      const body = this.objects.get(id);
      if (body === undefined) throw new Error(`PdfWriter: object ${id} was allocated but never set`);
      offsets[id] = out.length;
      out += `${id} 0 obj\n${body}\nendobj\n`;
    }

    const xrefOffset = out.length;
    out += `xref\n0 ${maxId + 1}\n`;
    out += xrefEntry(0, 65535, false);
    for (let id = 1; id <= maxId; id++) out += xrefEntry(offsets[id]!, 0, true);

    out += `trailer\n${pdfDict({ Size: String(maxId + 1), Root: pdfRef(rootId) })}\n`;
    out += `startxref\n${xrefOffset}\n%%EOF`;
    return out;
  }
}
