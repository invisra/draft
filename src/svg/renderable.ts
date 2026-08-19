import type { Point } from "../geometry/point.js";
import { unionBBox, type BoundingBox } from "../geometry/bbox.js";
import type { DimensionStyle } from "../dimension/style.js";
import type { DrawingElement } from "./element.js";
import type { TextElement } from "./text.js";

/**
 * A model→paper mapping applied at render time by a `View`:
 * `paper = rotate(model · scale, rotation) + translate`. It scales (and
 * optionally rotates) *geometry* — a `View`'s children are authored in true
 * model coordinates — but not annotation sizes: text height, arrowheads, and
 * line weights stay in paper millimeters, text stays upright, and dimensions
 * report the true model value, so a scaled/rotated detail or auxiliary view
 * reads correctly.
 */
export interface ViewTransform {
  /** Paper-per-model scale factor (e.g. 2 for a 2:1 view, 0.5 for 1:2). */
  readonly scale: number;
  /** Paper-space (mm) offset added after scaling/rotation. */
  readonly translate: Point;
  /** Counterclockwise rotation applied to scaled geometry, in radians. Omit (or 0) for an unrotated view. */
  readonly rotation?: number;
}

/**
 * Optional render-time context threaded from a {@link Sheet} down through
 * {@link Layer}s and `View`s to each element. Lets a drawing set document-wide
 * defaults once instead of repeating them on every dimension.
 */
export interface RenderContext {
  /**
   * A default {@link DimensionStyle} merged *under* each dimension/leader
   * element's own options — so per-element options always win. A `Sheet`'s
   * `dimensionDefaults` (e.g. one of the `ASME_INCH`/`ISO_METRIC` presets) is
   * delivered here at render time. Honored by the dimension classes
   * (`LinearDimension`, `AngularDimension`, `RadialDimension`/
   * `DiameterDimension`, `OrdinateDimension`) and the elbow-leader callouts
   * (`Callout`, `MultiLeader`, `DetailViewCallout`); other renderables ignore it.
   */
  dimensionDefaults?: DimensionStyle;
  /**
   * The active {@link ViewTransform} (set by an enclosing `View`). Geometry
   * (`DrawingElement`), text position, and dimension anchor points are mapped
   * through it; annotation sizes and reported dimension values are not scaled.
   */
  transform?: ViewTransform;
}

/** Maps a model-space point to paper space through `transform` (identity when there's no transform). */
export function applyViewTransform(p: Point, transform?: ViewTransform): Point {
  if (!transform) return p;
  const sx = p.x * transform.scale;
  const sy = p.y * transform.scale;
  const { x: tx, y: ty } = transform.translate;
  if (!transform.rotation) return { x: sx + tx, y: sy + ty };
  const c = Math.cos(transform.rotation);
  const s = Math.sin(transform.rotation);
  return { x: sx * c - sy * s + tx, y: sx * s + sy * c + ty };
}

/** The active view scale (1 when there's no transform), for converting a paper-space measurement back to a true model value. */
export function viewScale(transform?: ViewTransform): number {
  return transform?.scale ?? 1;
}

/**
 * Composes two view transforms into one that applies `inner` then `outer`
 * (`p → outer(inner(p))`) — both are similarity transforms (uniform
 * scale + rotation + translation), so their composition is another similarity
 * transform. Returns `inner` unchanged when there's no `outer`. Used to nest a
 * placed symbol inside an enclosing `View`, so its scale/rotation multiply
 * rather than replace the view's.
 */
export function composeViewTransforms(outer: ViewTransform | undefined, inner: ViewTransform): ViewTransform {
  if (!outer) return inner;
  return {
    scale: outer.scale * inner.scale,
    rotation: (outer.rotation ?? 0) + (inner.rotation ?? 0),
    translate: applyViewTransform(inner.translate, outer),
  };
}

/** The two primitives the DXF exporter emits directly — geometry (`POLYLINE`) and single-line `TEXT`. */
export type DxfPrimitive = DrawingElement | TextElement;

/**
 * A {@link Renderable} that can decompose itself into primitive
 * {@link DrawingElement}/{@link TextElement} pieces. Compound annotations that
 * would otherwise serialize straight to SVG markup (GD&T feature control frames,
 * datum feature symbols, datum target symbols) implement this so `exportDXF` can
 * emit them as real DXF `POLYLINE`/`TEXT` entities (on a `GDT` layer) rather than
 * dropping them. `toSVG()` is derived from the same element list, so the SVG and
 * DXF renderings stay in lockstep.
 */
export interface Explodable {
  /**
   * This annotation's constituent geometry/text primitives, in draw order. The optional `context`
   * carries the same document defaults and active view transform `toSVG` receives — a view-aware
   * annotation bakes the transform into the returned geometry (so a DXF export of a scaled/rotated
   * view is correct), while annotations that ignore `context` simply omit the parameter.
   */
  toElements(context?: RenderContext): DxfPrimitive[];
}

/** True when `r` implements {@link Explodable} (has a callable `toElements`). */
export function isExplodable(r: object): r is Explodable {
  return typeof (r as Partial<Explodable>).toElements === "function";
}

/** Anything that can serialize itself to an SVG markup fragment. */
export interface Renderable {
  /**
   * Renders this content as an SVG markup fragment (an element or group of
   * elements), in Y-up drafting coordinates. The optional `context` carries
   * document-wide defaults and the active view transform (see
   * {@link RenderContext}); elements that don't use it simply ignore the argument.
   */
  toSVG(context?: RenderContext): string;
  /**
   * Optional: the axis-aligned bounding box of this content in **paper space**
   * (mapped through any active view `transform` in `context`), or `null` when it
   * has no measurable geometry. Lets a `Sheet`/`View` measure its content — e.g.
   * for fit-to-view (see `fitView`) — via {@link boundsOf}. Implemented by the
   * geometry/text primitives and the containers (`Layer`, `View`, `BlockInstance`);
   * annotation classes that don't expose geometry simply omit it and are skipped.
   */
  bounds?(context?: RenderContext): BoundingBox | null;
}

/** Unions the {@link Renderable.bounds} of every renderable that implements it, skipping those that don't. Returns `null` if none is measurable. */
export function boundsOf(renderables: Iterable<Renderable>, context?: RenderContext): BoundingBox | null {
  let box: BoundingBox | null = null;
  for (const r of renderables) {
    const b = r.bounds?.(context);
    if (b) box = box ? unionBBox(box, b) : b;
  }
  return box;
}
