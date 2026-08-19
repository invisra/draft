export interface CubicBezier {
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  x: number;
  y: number;
}

/** An SVG elliptical-arc segment in endpoint parameterization (`A rx ry rotation large-arc sweep x y`). A circular arc is just `rx === ry` with `xAxisRotationDeg === 0`. */
export interface ArcEndpointParams {
  x1: number;
  y1: number;
  /** Semi-axis along the ellipse's (rotated) local X. */
  rx: number;
  /** Semi-axis along the ellipse's (rotated) local Y. */
  ry: number;
  /** Rotation of the ellipse's X-axis, in degrees (SVG's x-axis-rotation term). */
  xAxisRotationDeg: number;
  largeArcFlag: 0 | 1;
  sweepFlag: 0 | 1;
  x2: number;
  y2: number;
}

/** Angle (radians) from vector u to vector v, signed. */
function angleBetween(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  const clamped = Math.max(-1, Math.min(1, len === 0 ? 0 : dot / len));
  const sign = ux * vy - uy * vx < 0 ? -1 : 1;
  return sign * Math.acos(clamped);
}

/**
 * Converts an SVG elliptical-arc path segment (endpoint parameterization) into
 * one or more cubic Bezier curves, for renderers with no native arc primitive
 * (PDF content streams). Follows the standard SVG-spec endpoint-to-center
 * recovery (full elliptical form: independent `rx`/`ry` and an x-axis rotation),
 * then the kappa = 4/3·tan(Δ/4) bezier approximation split into ≤90° pieces.
 * Reduces to the circular case when `rx === ry` and `xAxisRotationDeg === 0`.
 *
 * Returns an empty array for a degenerate arc (zero radius, or coincident start
 * and end points).
 */
export function arcToBeziers(params: ArcEndpointParams): CubicBezier[] {
  const { x1, y1, largeArcFlag, sweepFlag, x2, y2 } = params;
  let { rx, ry } = params;
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  const phi = (params.xAxisRotationDeg * Math.PI) / 180;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);

  // Step 1: midpoint-relative start, rotated into the ellipse's frame.
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;

  // Correct out-of-range radii (SVG spec F.6.6).
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  // Step 2: center in the ellipse frame.
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = (largeArcFlag !== sweepFlag ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * (rx * y1p)) / ry;
  const cyp = (co * -(ry * x1p)) / rx;

  // Step 3: center in world space.
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;

  // Step 4: start angle and sweep, in the ellipse's (unrotated, unit) frame.
  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const theta1 = angleBetween(1, 0, ux, uy);
  let dtheta = angleBetween(ux, uy, vx, vy);
  if (sweepFlag === 0 && dtheta > 0) dtheta -= 2 * Math.PI;
  if (sweepFlag === 1 && dtheta < 0) dtheta += 2 * Math.PI;

  const segmentCount = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)));
  const delta = dtheta / segmentCount;
  const kappa = (4 / 3) * Math.tan(delta / 4);

  // A point on the (rotated) ellipse and its derivative, at eccentric angle t.
  const pointAt = (t: number): [number, number] => {
    const ct = Math.cos(t);
    const st = Math.sin(t);
    return [cx + rx * ct * cosP - ry * st * sinP, cy + rx * ct * sinP + ry * st * cosP];
  };
  const derivAt = (t: number): [number, number] => {
    const ct = Math.cos(t);
    const st = Math.sin(t);
    return [-rx * st * cosP - ry * ct * sinP, -rx * st * sinP + ry * ct * cosP];
  };

  const beziers: CubicBezier[] = [];
  for (let i = 0; i < segmentCount; i++) {
    const start = theta1 + i * delta;
    const end = start + delta;
    const [p0x, p0y] = pointAt(start);
    const [p3x, p3y] = pointAt(end);
    const [d0x, d0y] = derivAt(start);
    const [d3x, d3y] = derivAt(end);
    beziers.push({
      c1x: p0x + kappa * d0x,
      c1y: p0y + kappa * d0y,
      c2x: p3x - kappa * d3x,
      c2y: p3y - kappa * d3y,
      x: p3x,
      y: p3y,
    });
  }
  return beziers;
}
