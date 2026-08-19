import type { Stroke } from "./style.js";

/** A named line-type preset key into {@link LINE_STYLES}. */
export type LineStyleName = "visible" | "hidden" | "centerline" | "phantom" | "break" | "section" | "cutting";

/**
 * Named line-type presets per ASME Y14.2 / ISO 128 convention:
 * - **visible** — thick continuous object line.
 * - **hidden** — thin short dashes.
 * - **centerline** — thin long-dash / short-dash.
 * - **phantom** — thin long-dash / short-dash / short-dash (alternate/moving-part positions).
 * - **break** — thin continuous line (pair with a `breakLine` zig-zag/freehand marker for a long break).
 * - **section** — thin continuous line, for the section (cutting-plane) *viewing* lines and hatching boundary.
 * - **cutting** — thick long-dash / short-dash, the cutting-plane line itself (ASME Y14.2), with heavier ends.
 */
export const LINE_STYLES: Record<LineStyleName, Stroke> = {
  visible: { color: "black", width: 0.5 },
  hidden: { color: "black", width: 0.25, dasharray: [3, 1.5] },
  centerline: { color: "black", width: 0.25, dasharray: [24, 1.5, 3, 1.5] },
  phantom: { color: "black", width: 0.25, dasharray: [24, 1.5, 3, 1.5, 3, 1.5] },
  break: { color: "black", width: 0.25 },
  section: { color: "black", width: 0.25 },
  cutting: { color: "black", width: 0.5, dasharray: [24, 1.5, 3, 1.5] },
};
