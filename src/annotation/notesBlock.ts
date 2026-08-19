import { Path } from "../geometry/path.js";
import { point, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { DxfPrimitive, Explodable, Renderable } from "../svg/renderable.js";
import { TextElement } from "../svg/text.js";

/** Rough width estimate (mm) for `text` at font `size`, matching the dimension label estimator. */
function estimateWidth(text: string, size: number): number {
  return text.length * size * 0.65;
}

/** Greedily word-wraps `text` to lines no wider than `maxWidthMM` (best-effort, using the same width estimate as dimensions). A single word longer than the limit is kept whole on its own line. */
function wrapText(text: string, maxWidthMM: number | undefined, size: number): string[] {
  if (!maxWidthMM || maxWidthMM <= 0) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (current && estimateWidth(trial, size) > maxWidthMM) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Options for a {@link NotesBlock}. */
export interface NotesBlockOptions {
  /** Heading rendered (bold) above the list. Defaults to `"NOTES:"`; pass `""` to omit it. */
  heading?: string;
  /** Number the notes (`1.`, `2.`, …). Defaults to true; false renders a plain list with no prefixes. */
  numbered?: boolean;
  /** First note's number. Defaults to 1. */
  startNumber?: number;
  /** Text height in mm. Defaults to 2.5. */
  textSizeMM?: number;
  /** Baseline-to-baseline line spacing in mm. Defaults to `textSizeMM * 1.6`. */
  lineSpacingMM?: number;
  /** Hanging indent (mm) for the note text, leaving room for the number prefix. Defaults to `textSizeMM * 2`. */
  indentMM?: number;
  /** Wrap width (mm) for the note text column. Omit for no wrapping (each note stays one line). */
  maxWidthMM?: number;
  /** Text color. Defaults to "black". */
  color?: string;
}

interface LaidOutNote {
  /** The number prefix (e.g. "1."), or "" when unnumbered. */
  prefix: string;
  /** The note's wrapped text lines. */
  lines: string[];
}

/**
 * A general-notes block: a bold heading (default `"NOTES:"`) followed by a
 * numbered list of notes — the block every drawing carries for material,
 * finish, and interpretation callouts. `anchor` is the block's top-left corner;
 * it grows downward. Long notes wrap to `maxWidthMM` with a hanging indent so
 * continuation lines align under the note text, not its number. Exposes
 * `heightMM` (computed from the wrapped layout) so callers can stack or position
 * it, the same contract as `RevisionTable`/`BOMTable`.
 */
export class NotesBlock implements Renderable, Explodable {
  /** Total block height in mm (heading + all wrapped note lines). */
  readonly heightMM: number;

  private readonly heading: string;
  private readonly textSizeMM: number;
  private readonly lineSpacingMM: number;
  private readonly indentMM: number;
  private readonly color: string;
  private readonly laidOut: LaidOutNote[];

  constructor(
    private readonly anchor: Point,
    notes: readonly string[],
    options: NotesBlockOptions = {},
  ) {
    this.heading = options.heading ?? "NOTES:";
    this.textSizeMM = options.textSizeMM ?? 2.5;
    this.lineSpacingMM = options.lineSpacingMM ?? this.textSizeMM * 1.6;
    this.indentMM = options.indentMM ?? this.textSizeMM * 2;
    this.color = options.color ?? "black";
    const numbered = options.numbered ?? true;
    const startNumber = options.startNumber ?? 1;

    this.laidOut = notes.map((note, i) => ({
      prefix: numbered ? `${startNumber + i}.` : "",
      lines: wrapText(note, options.maxWidthMM, this.textSizeMM),
    }));

    const headingLines = this.heading ? 1 : 0;
    const noteLines = this.laidOut.reduce((sum, n) => sum + n.lines.length, 0);
    this.heightMM = (headingLines + noteLines) * this.lineSpacingMM;
  }

  /** The block's constituent text primitives, in draw order (heading, then each note's prefix + wrapped lines). */
  toElements(): DxfPrimitive[] {
    const parts: DxfPrimitive[] = [];
    // baseline of the first line sits one line-height below the anchor (top-left)
    let y = this.anchor.y - this.textSizeMM;
    const size = this.textSizeMM;

    if (this.heading) {
      parts.push(new TextElement(point(this.anchor.x, y), this.heading, { size, color: this.color, weight: "bold" }));
      y -= this.lineSpacingMM;
    }

    const textX = this.anchor.x + this.indentMM;
    for (const note of this.laidOut) {
      note.lines.forEach((line, i) => {
        if (i === 0 && note.prefix) {
          parts.push(new TextElement(point(this.anchor.x, y), note.prefix, { size, color: this.color }));
        }
        parts.push(new TextElement(point(note.prefix ? textX : this.anchor.x, y), line, { size, color: this.color }));
        y -= this.lineSpacingMM;
      });
    }

    return parts;
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}

/** The flag shape enclosing a {@link FlagNote}'s number. */
export type FlagNoteShape = "triangle" | "pentagon" | "hexagon";

const FLAG_SIDES: Record<FlagNoteShape, number> = { triangle: 3, pentagon: 5, hexagon: 6 };

/** Options for a {@link FlagNote}. */
export interface FlagNoteOptions {
  /** Enclosing shape. Defaults to `"triangle"` (the common "delta note" flag). */
  shape?: FlagNoteShape;
  /** Circumscribed size (point-to-point) in mm. Defaults to 8. */
  sizeMM?: number;
  /** Number text height in mm. Defaults to `sizeMM * 0.5`. */
  textSizeMM?: number;
  /** Outline stroke width in mm. Defaults to 0.35. */
  strokeWidthMM?: number;
  /** Color. Defaults to "black". */
  color?: string;
}

/**
 * A flag (or "delta") note symbol: a numbered polygon placed in the drawing
 * field that ties a feature to a numbered entry in a {@link NotesBlock}. The
 * shape isn't rigidly fixed by ASME — a triangle ("delta note") is the most
 * common, with pentagon/hexagon also used in practice — so it's selectable.
 * Distinct from `RevisionSymbol`, which references a revision rather than a
 * general note.
 */
export class FlagNote implements Renderable, Explodable {
  constructor(
    private readonly center: Point,
    private readonly noteNumber: number | string,
    private readonly options: FlagNoteOptions = {},
  ) {}

  /** The flag's constituent primitives, in draw order (polygon outline, then the note number). */
  toElements(): DxfPrimitive[] {
    const shape = this.options.shape ?? "triangle";
    const size = this.options.sizeMM ?? 8;
    const textSize = this.options.textSizeMM ?? size * 0.5;
    const strokeWidthMM = this.options.strokeWidthMM ?? 0.35;
    const color = this.options.color ?? "black";
    const sides = FLAG_SIDES[shape];
    const radius = size / 2;

    // regular polygon, first vertex pointing straight up
    const path = new Path();
    for (let i = 0; i < sides; i++) {
      const angle = Math.PI / 2 + (i * 2 * Math.PI) / sides;
      const px = this.center.x + radius * Math.cos(angle);
      const py = this.center.y + radius * Math.sin(angle);
      if (i === 0) path.moveTo(px, py);
      else path.lineTo(px, py);
    }
    path.close();

    // a triangle's centroid sits below its circumcenter — nudge the number down a touch so it looks centered
    const textY = (shape === "triangle" ? this.center.y - radius * 0.15 : this.center.y) - textSize * 0.35;
    return [
      new DrawingElement(path, { stroke: { color, width: strokeWidthMM } }),
      new TextElement(point(this.center.x, textY), String(this.noteNumber), { size: textSize, anchor: "middle", color }),
    ];
  }

  toSVG(): string {
    return this.toElements()
      .map((el) => el.toSVG())
      .join("\n");
  }
}
