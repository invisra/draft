import type { Point } from "../geometry/point.js";

/**
 * One primitive of a dimension's "picture" — the geometry drawn inside the anonymous DXF block that
 * a native `DIMENSION` entity references. Radial/diameter/angular/ordinate dimensions each describe
 * their picture as a list of these, which {@link exportDXF} turns into `LINE`/`ARC`/`SOLID`/`TEXT`
 * entities.
 */
export type DimensionPicture =
  | {
      /** Discriminant: a straight segment. */
      kind: "line";
      /** Segment start. */
      a: Point;
      /** Segment end. */
      b: Point;
    }
  | {
      /** Discriminant: a circular arc (the angular dimension line). */
      kind: "arc";
      /** Arc center. */
      center: Point;
      /** Arc radius. */
      radius: number;
      /** Start angle, radians (counter-clockwise). */
      startRad: number;
      /** End angle, radians (counter-clockwise). */
      endRad: number;
    }
  | {
      /** Discriminant: a filled arrowhead. */
      kind: "arrow";
      /** Arrowhead tip point. */
      tip: Point;
      /** Unit direction the arrowhead points along. */
      dir: Point;
    }
  | {
      /** Discriminant: centered value text. */
      kind: "text";
      /** Text center point. */
      center: Point;
      /** The text to draw. */
      text: string;
      /** Text height, mm. */
      sizeMM: number;
    };

/** One extra DXF definition point (group 13/14/15/16) carried by a {@link DimensionDXFData} for editability. */
export interface DimensionDefPoint {
  /** DXF group code (13, 14, 15, or 16). */
  code: 13 | 14 | 15 | 16;
  /** The point (its Y and Z pair codes are `code + 10` / `code + 20`). */
  point: Point;
}

/**
 * The data a radial/diameter/angular/ordinate dimension exposes for native DXF `DIMENSION` export
 * (via its `dimensionDXF()` method): the DXF dimension type, the semantic definition points, the
 * value text, and the block "picture" that displays it. Linear dimensions use their own
 * `LinearDimensionDXFData` shape.
 */
export interface DimensionDXFData {
  /**
   * DXF group 70 dimension type: 3 = diameter, 4 = radius, 2 = angular (two-line), 6 = ordinate
   * (with 64 OR'd in for an X-datum ordinate). Flag bits may be OR'd in.
   */
  dimType: number;
  /** DXF group 10 definition point (its meaning depends on `dimType`). */
  dimLinePoint: Point;
  /** DXF group 11 text midpoint. */
  textMidpoint: Point;
  /** The measurement text (nominal value plus any inline tolerance / dual). */
  text: string;
  /** Extra definition points (groups 13–16) for editability in the receiving CAD. */
  defPoints?: DimensionDefPoint[];
  /** The block picture primitives. */
  picture: DimensionPicture[];
  /** Text height (mm) for the block's value text. */
  textSizeMM: number;
  /** Arrowhead length (mm), for any `arrow` picture primitives. */
  arrowLengthMM: number;
  /** Arrowhead base width (mm), for any `arrow` picture primitives. */
  arrowWidthMM: number;
}
