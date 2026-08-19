import { Path } from "../geometry/path.js";
import { midpoint, normalize, perpendicular, point, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";
import type { LineStyleName } from "../svg/lineStyles.js";
import { TextElement, type TextAnchor, type TextBaseline } from "../svg/text.js";

/** A parsed DXF drawing: geometry as {@link DrawingElement}s and text as {@link TextElement}s. */
export interface ImportedDXF {
  /** Geometry entities (LINE/CIRCLE/ARC/POLYLINE/LWPOLYLINE), each with a `lineStyle` recovered from its layer. */
  elements: DrawingElement[];
  /** TEXT entities. */
  texts: TextElement[];
}

interface Pair {
  code: number;
  value: string;
}

/** DXF is a flat sequence of `groupCode` / `value` line pairs. */
function tokenize(dxf: string): Pair[] {
  const lines = dxf.split(/\r\n|\r|\n/);
  const pairs: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number.parseInt(lines[i]!.trim(), 10);
    if (Number.isNaN(code)) break; // malformed / past the meaningful content
    pairs.push({ code, value: lines[i + 1]!.trim() });
  }
  return pairs;
}

/** Reconstructs a circular arc from two endpoints and a DXF bulge (`tan(includedAngle/4)`, signed CCW), inverse of the bulge encoding in `pathToPolyline`. */
function arcFromBulge(p1: Point, p2: Point, bulge: number): { center: Point; radius: number; startAngle: number; endAngle: number; counterclockwise: boolean } {
  const theta = 4 * Math.atan(bulge); // signed included angle
  const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const radius = Math.abs(d / (2 * Math.sin(theta / 2)));
  const chord = normalize(point(p2.x - p1.x, p2.y - p1.y));
  const perp = perpendicular(chord); // 90° CCW
  const mid = midpoint(p1, p2);
  const h = d / 2 / Math.tan(theta / 2); // signed distance from chord midpoint to center
  const center = point(mid.x + perp.x * h, mid.y + perp.y * h);
  return {
    center,
    radius,
    startAngle: Math.atan2(p1.y - center.y, p1.x - center.x),
    endAngle: Math.atan2(p2.y - center.y, p2.x - center.x),
    counterclockwise: theta > 0,
  };
}

interface PolyVertex {
  x: number;
  y: number;
  bulge: number;
}

/** Builds a `Path` from polyline vertices (with per-vertex bulges) and a closed flag. */
function pathFromVertices(vertices: PolyVertex[], closed: boolean): Path | null {
  if (vertices.length < 2) return null;
  const n = vertices.length;
  const path = new Path().moveTo(vertices[0]!.x, vertices[0]!.y);
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const cur = vertices[i]!;
    const nxt = vertices[(i + 1) % n]!;
    if (cur.bulge !== 0) {
      path.arc(arcFromBulge(point(cur.x, cur.y), point(nxt.x, nxt.y), cur.bulge));
    } else {
      path.lineTo(nxt.x, nxt.y);
    }
  }
  if (closed) path.close();
  return path;
}

/** Maps a DXF layer name back to a `lineStyle` (the inverse of `exportDXF`'s layer mapping); unrecognized layers default to "visible". */
function lineStyleForLayer(layer: string | undefined): LineStyleName {
  switch (layer) {
    case "HIDDEN":
      return "hidden";
    case "CENTER":
      return "centerline";
    case "PHANTOM":
      return "phantom";
    default:
      return "visible";
  }
}

/** An entity's own group-code pairs (excludes the leading `0`), preserving order for multi-valued codes. */
type Attrs = Pair[];

function first(attrs: Attrs, code: number): string | undefined {
  return attrs.find((p) => p.code === code)?.value;
}
function num(attrs: Attrs, code: number, fallback = 0): number {
  const v = first(attrs, code);
  return v === undefined ? fallback : Number.parseFloat(v);
}

function textElementFrom(attrs: Attrs): TextElement {
  const height = num(attrs, 40, 3);
  const hJust = num(attrs, 72, 0);
  const vJust = num(attrs, 73, 0);
  const justified = hJust !== 0 || vJust !== 0;
  // DXF uses the second alignment point (11/21) when justified, else the insertion point (10/20)
  const x = justified && first(attrs, 11) !== undefined ? num(attrs, 11) : num(attrs, 10);
  const y = justified && first(attrs, 21) !== undefined ? num(attrs, 21) : num(attrs, 20);
  const anchor: TextAnchor = hJust === 1 ? "middle" : hJust === 2 ? "end" : "start";
  const baseline: TextBaseline = vJust === 2 ? "middle" : vJust === 3 ? "hanging" : "auto";
  return new TextElement(point(x, y), first(attrs, 1) ?? "", { size: height, anchor, baseline });
}

/**
 * Parses a DXF (R12 or later) string into geometry and text, the inverse of
 * {@link exportDXF} — so `importDXF(exportDXF(elements))` round-trips the
 * geometry and text. (Native `DIMENSION` entities are export-only: `exportDXF`
 * writes them, but they are skipped on import — see below — so a re-exported
 * drawing keeps its geometry/text but not its dimensions.) Reads the
 * entity types this library writes plus the common ones other CAD tools emit:
 * `LINE`, `CIRCLE`, `ARC`, `LWPOLYLINE`, `POLYLINE`/`VERTEX` (arcs recovered
 * exactly from per-vertex bulges), and `TEXT`. Each geometry entity's
 * `lineStyle` is recovered from its layer name (`HIDDEN`/`CENTER`/`PHANTOM`,
 * else `visible`); text height and horizontal/vertical justification are
 * recovered too.
 *
 * Only the `ENTITIES` section is read. Entity types this library never emits
 * (SPLINE, ELLIPSE, INSERT/blocks, HATCH, DIMENSION, MTEXT, 3D entities, …) are
 * skipped rather than erroring, so a foreign DXF imports its supported subset.
 * Colors and non-geometry metadata are dropped.
 */
export function importDXF(dxf: string): ImportedDXF {
  const pairs = tokenize(dxf);
  const elements: DrawingElement[] = [];
  const texts: TextElement[] = [];

  // locate the ENTITIES section
  let i = pairs.findIndex((p) => p.code === 2 && p.value === "ENTITIES");
  if (i < 0) return { elements, texts };
  i += 1;

  const addGeometry = (path: Path | null, layer: string | undefined): void => {
    if (path) elements.push(new DrawingElement(path, { lineStyle: lineStyleForLayer(layer) }));
  };

  while (i < pairs.length) {
    const p = pairs[i]!;
    if (p.code !== 0) {
      i += 1;
      continue;
    }
    const type = p.value;
    if (type === "ENDSEC" || type === "EOF") break;
    i += 1;

    // collect this entity's attributes up to the next code-0
    const attrs: Attrs = [];
    while (i < pairs.length && pairs[i]!.code !== 0) {
      attrs.push(pairs[i]!);
      i += 1;
    }
    const layer = first(attrs, 8);

    if (type === "LINE") {
      addGeometry(new Path().moveTo(num(attrs, 10), num(attrs, 20)).lineTo(num(attrs, 11), num(attrs, 21)), layer);
    } else if (type === "CIRCLE") {
      const [cx, cy, r] = [num(attrs, 10), num(attrs, 20), num(attrs, 40)];
      const path = new Path()
        .moveTo(cx + r, cy)
        .arc({ center: point(cx, cy), radius: r, startAngle: 0, endAngle: Math.PI, counterclockwise: true })
        .arc({ center: point(cx, cy), radius: r, startAngle: Math.PI, endAngle: 2 * Math.PI, counterclockwise: true })
        .close();
      addGeometry(path, layer);
    } else if (type === "ARC") {
      const [cx, cy, r] = [num(attrs, 10), num(attrs, 20), num(attrs, 40)];
      const start = (num(attrs, 50) * Math.PI) / 180;
      const end = (num(attrs, 51) * Math.PI) / 180;
      addGeometry(new Path().arc({ center: point(cx, cy), radius: r, startAngle: start, endAngle: end, counterclockwise: true }), layer);
    } else if (type === "LWPOLYLINE") {
      const closed = (num(attrs, 70) & 1) === 1;
      const vertices: PolyVertex[] = [];
      for (const a of attrs) {
        if (a.code === 10) vertices.push({ x: Number.parseFloat(a.value), y: 0, bulge: 0 });
        else if (a.code === 20 && vertices.length) vertices[vertices.length - 1]!.y = Number.parseFloat(a.value);
        else if (a.code === 42 && vertices.length) vertices[vertices.length - 1]!.bulge = Number.parseFloat(a.value);
      }
      addGeometry(pathFromVertices(vertices, closed), layer);
    } else if (type === "POLYLINE") {
      const closed = (num(attrs, 70) & 1) === 1;
      const vertices: PolyVertex[] = [];
      // consume the following VERTEX entities up to SEQEND
      while (i < pairs.length && pairs[i]!.code === 0 && pairs[i]!.value === "VERTEX") {
        i += 1;
        const vAttrs: Attrs = [];
        while (i < pairs.length && pairs[i]!.code !== 0) {
          vAttrs.push(pairs[i]!);
          i += 1;
        }
        vertices.push({ x: num(vAttrs, 10), y: num(vAttrs, 20), bulge: num(vAttrs, 42) });
      }
      if (i < pairs.length && pairs[i]!.code === 0 && pairs[i]!.value === "SEQEND") {
        i += 1;
        while (i < pairs.length && pairs[i]!.code !== 0) i += 1; // skip SEQEND attrs
      }
      addGeometry(pathFromVertices(vertices, closed), layer);
    } else if (type === "TEXT") {
      texts.push(textElementFrom(attrs));
    }
    // any other entity type: skip (attrs already consumed)
  }

  return { elements, texts };
}
