import { arcToBeziers } from "./svgArcToBezier.js";

function fmt(n: number): string {
  return Number(n.toFixed(4)).toString();
}

/**
 * Converts an SVG path `d` string into PDF path-construction operators (`m`/`l`/`c`/`h`) — no
 * paint operator (`S`/`f`/...) included, since that depends on the caller's fill/stroke state.
 *
 * Only understands the exact grammar `Path.toSVGPathData()` emits: `M`/`L`/`A`/`Z`, absolute
 * coordinates, space-separated, no other SVG path commands (no curves, shorthand, or relative
 * commands) — this is a converter for this library's own narrow output, not a general SVG path
 * parser. Arcs (circular or elliptical, with an optional x-axis rotation) are converted to cubic
 * Bezier curves via `arcToBeziers`, since PDF content streams have no native arc operator.
 */
export function svgPathDataToPdfOps(d: string): string[] {
  const trimmed = d.trim();
  if (trimmed === "") return [];

  const tokens = trimmed.split(/\s+/);
  const ops: string[] = [];
  let i = 0;
  let cur = { x: 0, y: 0 };
  const num = (): number => {
    const value = parseFloat(tokens[i]!);
    i++;
    return value;
  };

  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M") {
      const x = num();
      const y = num();
      cur = { x, y };
      ops.push(`${fmt(x)} ${fmt(y)} m`);
    } else if (cmd === "L") {
      const x = num();
      const y = num();
      cur = { x, y };
      ops.push(`${fmt(x)} ${fmt(y)} l`);
    } else if (cmd === "A") {
      const rx = num();
      const ry = num();
      const xAxisRotationDeg = num();
      const largeArcFlag = num() as 0 | 1;
      const sweepFlag = num() as 0 | 1;
      const x = num();
      const y = num();
      const beziers = arcToBeziers({ x1: cur.x, y1: cur.y, rx, ry, xAxisRotationDeg, largeArcFlag, sweepFlag, x2: x, y2: y });
      for (const b of beziers) {
        ops.push(`${fmt(b.c1x)} ${fmt(b.c1y)} ${fmt(b.c2x)} ${fmt(b.c2y)} ${fmt(b.x)} ${fmt(b.y)} c`);
      }
      cur = { x, y };
    } else if (cmd === "C") {
      const c1x = num();
      const c1y = num();
      const c2x = num();
      const c2y = num();
      const x = num();
      const y = num();
      ops.push(`${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(x)} ${fmt(y)} c`); // PDF has a native cubic Bézier operator
      cur = { x, y };
    } else if (cmd === "Z") {
      ops.push("h");
    } else {
      throw new Error(`svgPathDataToPdfOps: unsupported path command "${cmd}"`);
    }
  }
  return ops;
}
