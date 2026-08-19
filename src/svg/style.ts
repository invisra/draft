/** Stroke styling for a drawn path. */
export interface Stroke {
  /** Any valid SVG color string. */
  color?: string;
  /** Millimeters. */
  width?: number;
  /** SVG `stroke-dasharray` values, in mm. Omit for a solid line. */
  dasharray?: readonly number[];
  /** SVG `stroke-linecap`. */
  linecap?: "butt" | "round" | "square";
  /** SVG `stroke-linejoin`. */
  linejoin?: "miter" | "round" | "bevel";
}
