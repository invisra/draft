import { addPoints, point, type Point } from "./point.js";
import { Path } from "./path.js";
import { ellipse } from "./shapes.js";

/** A point in 3D model space, for {@link isometricProjection}. */
export interface Point3D {
  /** Model X (projects right and down). */
  x: number;
  /** Model Y (projects left and down). */
  y: number;
  /** Model Z (projects straight up). */
  z: number;
}

// Standard 30° isometric: the three model axes project 120° apart. cos 30° for the
// horizontal spread, sin 30° (= 0.5) for the vertical foreshortening.
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

/**
 * Projects a 3D model point onto the 2D drawing plane in **standard 30°
 * isometric**. In the library's Y-up drawing coordinates: `+X` runs right and
 * down, `+Y` runs left and down, `+Z` runs straight up — the classic view with
 * the top and two side faces of a box visible. A unit model-axis vector projects
 * to a unit-length 2D vector (isometric is equal-foreshortening on all three
 * axes), so lengths along any one axis stay mutually consistent. Translate the
 * result to place the drawing on the sheet.
 */
export function isometricProjection(p: Point3D): Point {
  return point((p.x - p.y) * COS30, p.z - (p.x + p.y) * SIN30);
}

/** The three isometric faces a flat 2D shape can be laid onto: the horizontal `top`, or the `left`/`right` vertical walls. */
export type IsometricPlane = "top" | "left" | "right";

/**
 * Maps a flat 2D point `(x, y)` — as you'd draw it on a face — onto that
 * isometric face in the projected drawing plane, so ordinary 2D geometry can be
 * placed on a pictorial face. `"top"` treats `(x, y)` as model `(X, Y)` at
 * `Z = 0`; `"right"` as `(X, Z)` at `Y = 0`; `"left"` as `(Y, Z)` at `X = 0` —
 * in each case the face's second coordinate runs up the drawing.
 */
export function projectIsoPlane(plane: IsometricPlane, p: Point): Point {
  switch (plane) {
    case "top":
      return isometricProjection({ x: p.x, y: p.y, z: 0 });
    case "right":
      return isometricProjection({ x: p.x, y: 0, z: p.y });
    case "left":
      return isometricProjection({ x: 0, y: p.x, z: p.y });
  }
}

/** Projects a polyline of 3D model points to 2D isometric drawing points (feed the result to `polyline`/`Path`). */
export function isoPolyline(points: readonly Point3D[]): Point[] {
  return points.map(isometricProjection);
}

/** The three isometric axis directions as unit vectors in the drawing plane, from {@link isometricAxisDirections}. */
export interface IsometricAxisDirections {
  /** Model +X projected: a unit vector running right and down. */
  x: Point;
  /** Model +Y projected: a unit vector running left and down. */
  y: Point;
  /** Model +Z projected: a unit vector running straight up. */
  z: Point;
}

/** The three isometric axis directions as **unit** vectors in the drawing plane: `x` right-down, `y` left-down, `z` straight up. */
export function isometricAxisDirections(): IsometricAxisDirections {
  return {
    x: isometricProjection({ x: 1, y: 0, z: 0 }),
    y: isometricProjection({ x: 0, y: 1, z: 0 }),
    z: isometricProjection({ x: 0, y: 0, z: 1 }),
  };
}

/** The projected 2D basis vectors of an isometric face (the images of its two in-plane unit axes). */
function planeBasis(plane: IsometricPlane): { a: Point; b: Point } {
  switch (plane) {
    case "top":
      return { a: isometricProjection({ x: 1, y: 0, z: 0 }), b: isometricProjection({ x: 0, y: 1, z: 0 }) };
    case "right":
      return { a: isometricProjection({ x: 1, y: 0, z: 0 }), b: isometricProjection({ x: 0, y: 0, z: 1 }) };
    case "left":
      return { a: isometricProjection({ x: 0, y: 1, z: 0 }), b: isometricProjection({ x: 0, y: 0, z: 1 }) };
  }
}

/** The ellipse a circle projects to on an isometric face: `rx`/`ry` semi-axes and the CCW `rotationDeg` of the major axis. */
export interface IsometricEllipseAxes {
  /** Semi-major axis (≈ 1.2247 × radius for standard isometric). */
  rx: number;
  /** Semi-minor axis (≈ 0.7071 × radius; the major:minor ratio is √3). */
  ry: number;
  /** Counterclockwise rotation of the major axis, in degrees (0 for `top`, −60 for `right`, 60 for `left`). */
  rotationDeg: number;
}

/**
 * The ellipse that a circle of `radius` on an isometric `plane` projects to —
 * its semi-axes and major-axis rotation. Derived exactly from the projection's
 * in-plane 2×2 map (the ellipse is the image of the circle under it), so it's
 * consistent with {@link isometricProjection} for every face: the major:minor
 * ratio is √3, and the major axis is horizontal on `top`, and the minor axis
 * aligns with the face's normal axis (the cylinder centerline) on the walls.
 */
export function isometricEllipseAxes(plane: IsometricPlane, radius: number): IsometricEllipseAxes {
  const { a: A, b: B } = planeBasis(plane);
  // Shape matrix M·Mᵀ = [[a, bb], [bb, c]], with M = [A B] (columns). Its eigenvalues give the
  // squared semi-axes; the larger eigenvector's angle is the major-axis rotation.
  const a = A.x * A.x + B.x * B.x;
  const c = A.y * A.y + B.y * B.y;
  const bb = A.x * A.y + B.x * B.y;
  const mean = (a + c) / 2;
  const root = Math.sqrt(((a - c) / 2) ** 2 + bb * bb);
  return {
    rx: Math.sqrt(mean + root) * radius,
    ry: Math.sqrt(mean - root) * radius,
    rotationDeg: (0.5 * Math.atan2(2 * bb, a - c) * 180) / Math.PI,
  };
}

/** Options for {@link isometricCircle}. */
export interface IsometricCircleOptions {
  /** If set, the ellipse is emitted as a tessellated polyline of this many sides instead of true elliptical arcs. */
  segments?: number;
}

/**
 * A circle of `radius` centered at `centerOnPlane` (a flat 2D `(x, y)` point *on
 * the face*, as with {@link projectIsoPlane}), drawn as its isometric ellipse on
 * `plane`. The classic hole/cylinder-end on a pictorial face. Returns a closed
 * `Path` (true elliptical arcs, or a polyline if `segments` is given).
 */
export function isometricCircle(plane: IsometricPlane, centerOnPlane: Point, radius: number, options: IsometricCircleOptions = {}): Path {
  const center = projectIsoPlane(plane, centerOnPlane);
  const { rx, ry, rotationDeg } = isometricEllipseAxes(plane, radius);
  return ellipse(center.x, center.y, rx, ry, { rotationDeg, ...(options.segments !== undefined ? { segments: options.segments } : {}) });
}

/** Options for {@link isometricBox}. */
export interface IsometricBoxOptions {
  /** Drawing-plane point where the box's `(0, 0, 0)` corner lands. Defaults to the origin. */
  origin?: Point;
}

/**
 * The visible edges of an axis-aligned rectangular prism from `(0, 0, 0)` to
 * `(size.x, size.y, size.z)`, in isometric — the "hello world" of a pictorial
 * view. Returns three `Path`s covering the 9 visible edges (the three hidden back
 * edges are omitted): the top face loop, and one open polyline per front face
 * (`Path` is single-subpath, so disjoint edge runs are separate paths). Add each
 * as a `DrawingElement`; translate with `origin`.
 */
export function isometricBox(size: Point3D, options: IsometricBoxOptions = {}): Path[] {
  const o = options.origin ?? point(0, 0);
  const { x: w, y: d, z: h } = size;
  const c = (x: number, y: number, z: number): Point => addPoints(o, isometricProjection({ x, y, z }));
  const poly = (...corners: Point[]): Path => {
    const path = new Path().moveTo(corners[0]!.x, corners[0]!.y);
    for (const p of corners.slice(1)) path.lineTo(p.x, p.y);
    return path;
  };

  const top = poly(c(0, 0, h), c(w, 0, h), c(w, d, h), c(0, d, h)).close();
  // Left front face (y = d): its two verticals + bottom edge (top edge is shared with the top face).
  const left = poly(c(0, d, h), c(0, d, 0), c(w, d, 0), c(w, d, h));
  // Right front face (x = w): the remaining vertical + bottom edge.
  const right = poly(c(w, 0, h), c(w, 0, 0), c(w, d, 0));
  return [top, left, right];
}
