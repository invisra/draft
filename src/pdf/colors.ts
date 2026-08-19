export type RGB = readonly [number, number, number];

// A bounded set of CSS color keywords, not the full CSS Color Module list — this project's own
// output only ever uses "black" and hex codes, but callers can pass any CSS `color` string to
// DrawingElement/TextElement, so the common named colors are covered too. rgb()/hsl()/CSS4 color
// functions aren't supported; unrecognized values fall back to black (documented in the README).
const NAMED_COLORS: Record<string, RGB> = {
  black: [0, 0, 0],
  white: [1, 1, 1],
  red: [1, 0, 0],
  green: [0, 0.5, 0],
  blue: [0, 0, 1],
  yellow: [1, 1, 0],
  orange: [1, 0.647, 0],
  purple: [0.5, 0, 0.5],
  gray: [0.5, 0.5, 0.5],
  grey: [0.5, 0.5, 0.5],
  silver: [0.75, 0.75, 0.75],
  maroon: [0.5, 0, 0],
  navy: [0, 0, 0.5],
  teal: [0, 0.5, 0.5],
  olive: [0.5, 0.5, 0],
  lime: [0, 1, 0],
  aqua: [0, 1, 1],
  cyan: [0, 1, 1],
  fuchsia: [1, 0, 1],
  magenta: [1, 0, 1],
};

function hexToRgb(hex: string): RGB | null {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (short) {
    const [, r, g, b] = short;
    return [parseInt(r! + r, 16) / 255, parseInt(g! + g, 16) / 255, parseInt(b! + b, 16) / 255];
  }
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (long) {
    const [, r, g, b] = long;
    return [parseInt(r!, 16) / 255, parseInt(g!, 16) / 255, parseInt(b!, 16) / 255];
  }
  return null;
}

/** Resolves a CSS color string (hex or a common named color) to PDF-style [0,1]-range RGB. Falls back to black. */
export function parseColor(value: string): RGB {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("#")) {
    return hexToRgb(trimmed) ?? NAMED_COLORS.black!;
  }
  return NAMED_COLORS[trimmed] ?? NAMED_COLORS.black!;
}
