import { bboxFromPoints, unionBBox, type BoundingBox } from "./bbox.js";
import { point, type Point } from "./point.js";
import {
  arcExtremaPoints,
  arcPointAt,
  arcSegment,
  arcSpan,
  bezierExtremaPoints,
  bezierPointAt,
  cubicBezierSegment,
  ellipticalArcExtremaPoints,
  ellipticalArcPointAt,
  ellipticalArcSegment,
  ellipticalArcSpan,
  lineSegment,
  segmentEnd,
  segmentStart,
  type Segment,
} from "./segments.js";
import { formatNumber } from "../util.js";

/** Parameters for {@link Path.arc}, in CAD-style center/radius/angle form. */
export interface ArcOptions {
  /** Arc center. */
  center: Point;
  /** Arc radius, in mm. */
  radius: number;
  /** Radians, from the +X axis. */
  startAngle: number;
  /** Radians, from the +X axis. */
  endAngle: number;
  /** Sweep direction in standard math convention (increasing angle = CCW). Defaults to false (clockwise). */
  counterclockwise?: boolean;
}

/** Parameters for {@link Path.ellipticalArc}, in center parameterization. */
export interface EllipticalArcOptions {
  /** Ellipse center. */
  center: Point;
  /** Semi-axis along the ellipse's local X, in mm. */
  rx: number;
  /** Semi-axis along the ellipse's local Y, in mm. */
  ry: number;
  /** Rotation of the ellipse's local X-axis, radians CCW from world +X. Defaults to 0. */
  rotation?: number;
  /** Start parametric (eccentric) angle, radians. */
  startAngle: number;
  /** End parametric (eccentric) angle, radians. */
  endAngle: number;
  /** Sweep direction: increasing parametric angle = CCW. Defaults to false (clockwise). */
  counterclockwise?: boolean;
}

/**
 * A chain of line and arc segments, built imperatively like the Canvas2D
 * path API. Coordinates are in millimeters, Y-up (drafting convention:
 * +X right, +Y up).
 */
export class Path {
  private segments: Segment[] = [];
  private startPoint: Point | null = null;
  private currentPoint: Point | null = null;
  private closed = false;

  /** Starts (or restarts) the path at `(x, y)`. Note: this single-subpath `Path` only ever has one start point — calling `moveTo` again overwrites it rather than beginning a new subpath. */
  moveTo(x: number, y: number): this {
    this.startPoint = point(x, y);
    this.currentPoint = this.startPoint;
    return this;
  }

  /** Appends a straight line segment from the current point to `(x, y)`. Throws if called before `moveTo`. */
  lineTo(x: number, y: number): this {
    if (!this.currentPoint) {
      throw new Error("Path.lineTo() called before moveTo()");
    }
    const end = point(x, y);
    this.segments.push(lineSegment(this.currentPoint, end));
    this.currentPoint = end;
    return this;
  }

  /** Appends a circular arc segment. If the path is empty, the arc's start point becomes the path's start. */
  arc(options: ArcOptions): this {
    const seg = arcSegment(
      options.center,
      options.radius,
      options.startAngle,
      options.endAngle,
      options.counterclockwise ?? false,
    );
    if (!this.currentPoint) {
      this.startPoint = segmentStart(seg);
      this.currentPoint = this.startPoint;
    }
    this.segments.push(seg);
    this.currentPoint = segmentEnd(seg);
    return this;
  }

  /** Appends an elliptical arc segment (possibly rotated). If the path is empty, the arc's start point becomes the path's start. */
  ellipticalArc(options: EllipticalArcOptions): this {
    const seg = ellipticalArcSegment(
      options.center,
      options.rx,
      options.ry,
      options.rotation ?? 0,
      options.startAngle,
      options.endAngle,
      options.counterclockwise ?? false,
    );
    if (!this.currentPoint) {
      this.startPoint = segmentStart(seg);
      this.currentPoint = this.startPoint;
    }
    this.segments.push(seg);
    this.currentPoint = segmentEnd(seg);
    return this;
  }

  /** Appends a cubic Bézier curve from the current point through control points `(c1x,c1y)`/`(c2x,c2y)` to `(x,y)`. Throws if called before `moveTo`. */
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
    if (!this.currentPoint) {
      throw new Error("Path.bezierCurveTo() called before moveTo()");
    }
    const end = point(x, y);
    this.segments.push(cubicBezierSegment(this.currentPoint, point(c1x, c1y), point(c2x, c2y), end));
    this.currentPoint = end;
    return this;
  }

  /** Closes the path with a straight line back to the start point, if not already there. */
  close(): this {
    if (!this.startPoint || !this.currentPoint) {
      throw new Error("Path.close() called on an empty path");
    }
    if (this.currentPoint.x !== this.startPoint.x || this.currentPoint.y !== this.startPoint.y) {
      this.segments.push(lineSegment(this.currentPoint, this.startPoint));
    }
    this.currentPoint = this.startPoint;
    this.closed = true;
    return this;
  }

  /**
   * A copy of this path with every coordinate mapped by
   * `p → rotate(p·scale, rotationRad) + translate` (a uniform scale, an optional
   * counterclockwise rotation, then a translation). Arc radii and elliptical
   * semi-axes scale by `scale`; a circular arc's angles and an elliptical arc's
   * axis rotation shift by `rotationRad` (valid because the scale is uniform).
   * Used by a `View` to place true-size model geometry onto the sheet.
   */
  transformed(scale: number, translate: Point, rotationRad = 0): Path {
    const out = new Path();
    if (!this.startPoint) return out;
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);
    const m = (p: Point): Point => {
      const sx = p.x * scale;
      const sy = p.y * scale;
      return rotationRad ? point(sx * cos - sy * sin + translate.x, sx * sin + sy * cos + translate.y) : point(sx + translate.x, sy + translate.y);
    };
    if (this.segments.length === 0) {
      const s = m(this.startPoint);
      return out.moveTo(s.x, s.y);
    }
    const s0 = m(segmentStart(this.segments[0]!));
    out.moveTo(s0.x, s0.y);
    for (const seg of this.segments) {
      if (seg.type === "line") {
        const e = m(seg.end);
        out.lineTo(e.x, e.y);
      } else if (seg.type === "arc") {
        out.arc({ center: m(seg.center), radius: seg.radius * scale, startAngle: seg.startAngle + rotationRad, endAngle: seg.endAngle + rotationRad, counterclockwise: seg.counterclockwise });
      } else if (seg.type === "ellipticalArc") {
        out.ellipticalArc({ center: m(seg.center), rx: seg.rx * scale, ry: seg.ry * scale, rotation: seg.rotation + rotationRad, startAngle: seg.startAngle, endAngle: seg.endAngle, counterclockwise: seg.counterclockwise });
      } else {
        const c1 = m(seg.control1);
        const c2 = m(seg.control2);
        const e = m(seg.end);
        out.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y);
      }
    }
    if (this.closed) out.close();
    return out;
  }

  /** Whether `close()` has been called on this path. */
  isClosed(): boolean {
    return this.closed;
  }

  /** The path's line/arc segments, in order. */
  getSegments(): readonly Segment[] {
    return this.segments;
  }

  /** The smallest axis-aligned box containing the whole path. Throws if the path is empty. */
  boundingBox(): BoundingBox {
    if (this.segments.length === 0) {
      if (!this.startPoint) {
        throw new Error("Cannot compute bounding box of an empty path");
      }
      return bboxFromPoints([this.startPoint]);
    }
    let box: BoundingBox | null = null;
    for (const seg of this.segments) {
      const pts =
        seg.type === "line"
          ? [seg.start, seg.end]
          : seg.type === "arc"
            ? arcExtremaPoints(seg)
            : seg.type === "ellipticalArc"
              ? ellipticalArcExtremaPoints(seg)
              : bezierExtremaPoints(seg);
      const segBox = bboxFromPoints(pts);
      box = box ? unionBBox(box, segBox) : segBox;
    }
    return box as BoundingBox;
  }

  /**
   * Tessellates the path into a flat list of vertices, sampling arcs into short line
   * segments (at most `angleStepDeg` of arc per sample). Useful for algorithms that
   * only understand straight-edged polygons, e.g. hatch fill.
   */
  flatten(angleStepDeg = 10): Point[] {
    if (!this.startPoint) return [];
    const points: Point[] = [this.startPoint];
    for (const seg of this.segments) {
      if (seg.type === "line") {
        points.push(seg.end);
      } else if (seg.type === "bezier") {
        // no natural angle step for a Bézier; subdivide into a fixed number of chords
        const steps = 24;
        for (let i = 1; i <= steps; i++) points.push(bezierPointAt(seg, i / steps));
      } else {
        const span = seg.type === "arc" ? arcSpan(seg) : ellipticalArcSpan(seg);
        const steps = Math.max(1, Math.ceil((span * 180) / Math.PI / angleStepDeg));
        for (let i = 1; i <= steps; i++) {
          const delta = (span * i) / steps;
          const angle = seg.counterclockwise ? seg.startAngle + delta : seg.startAngle - delta;
          points.push(seg.type === "arc" ? arcPointAt(seg, angle) : ellipticalArcPointAt(seg, angle));
        }
      }
    }
    return points;
  }

  /** Renders this path as an SVG path `d` attribute value (without the surrounding `<path d="...">`). */
  toSVGPathData(precision = 5): string {
    if (!this.startPoint) return "";
    const fmt = (n: number) => formatNumber(n, precision);
    const parts = [`M ${fmt(this.startPoint.x)} ${fmt(this.startPoint.y)}`];
    for (const seg of this.segments) {
      if (seg.type === "line") {
        parts.push(`L ${fmt(seg.end.x)} ${fmt(seg.end.y)}`);
      } else if (seg.type === "arc") {
        const end = arcPointAt(seg, seg.endAngle);
        const largeArcFlag = arcSpan(seg) > Math.PI ? 1 : 0;
        const sweepFlag = seg.counterclockwise ? 1 : 0;
        parts.push(`A ${fmt(seg.radius)} ${fmt(seg.radius)} 0 ${largeArcFlag} ${sweepFlag} ${fmt(end.x)} ${fmt(end.y)}`);
      } else if (seg.type === "ellipticalArc") {
        const end = ellipticalArcPointAt(seg, seg.endAngle);
        const largeArcFlag = ellipticalArcSpan(seg) > Math.PI ? 1 : 0;
        const sweepFlag = seg.counterclockwise ? 1 : 0;
        const rotDeg = (seg.rotation * 180) / Math.PI;
        parts.push(`A ${fmt(seg.rx)} ${fmt(seg.ry)} ${fmt(rotDeg)} ${largeArcFlag} ${sweepFlag} ${fmt(end.x)} ${fmt(end.y)}`);
      } else {
        parts.push(`C ${fmt(seg.control1.x)} ${fmt(seg.control1.y)} ${fmt(seg.control2.x)} ${fmt(seg.control2.y)} ${fmt(seg.end.x)} ${fmt(seg.end.y)}`);
      }
    }
    if (this.closed) parts.push("Z");
    return parts.join(" ");
  }
}
