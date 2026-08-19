import { Path } from "../geometry/path.js";
import { addPoints, normalize, perpendicular, scalePoint, subtractPoints, type Point } from "../geometry/point.js";
import { DrawingElement } from "../svg/element.js";

/** Options for {@link arrowhead}. */
export interface ArrowheadOptions {
  /** Along the direction of travel. Defaults to 3mm. */
  length?: number;
  /** Across the direction of travel. Defaults to 1mm (a 3:1 length:width ratio). */
  width?: number;
  /** Fill color (any valid SVG color string). Defaults to "black". */
  color?: string;
}

/** A filled, solid triangular arrowhead: tip at `tip`, pointing along `direction` (tail to tip). */
export function arrowhead(tip: Point, direction: Point, options: ArrowheadOptions = {}): DrawingElement {
  const length = options.length ?? 3;
  const width = options.width ?? 1;
  const dir = normalize(direction);
  const n = perpendicular(dir);
  const back = subtractPoints(tip, scalePoint(dir, length));
  const corner1 = addPoints(back, scalePoint(n, width / 2));
  const corner2 = subtractPoints(back, scalePoint(n, width / 2));

  const path = new Path().moveTo(tip.x, tip.y).lineTo(corner1.x, corner1.y).lineTo(corner2.x, corner2.y).close();
  return new DrawingElement(path, { fill: options.color ?? "black", stroke: "none" });
}
