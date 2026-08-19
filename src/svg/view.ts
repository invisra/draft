import { point, rotatePoint, type Point } from "../geometry/point.js";
import { bboxHeight, bboxWidth, type BoundingBox } from "../geometry/bbox.js";
import { formatNumber, escapeXMLAttr } from "../util.js";
import { applyViewTransform, boundsOf, type Renderable, type RenderContext, type ViewTransform } from "./renderable.js";

/** Options for a {@link View}. */
export interface ViewOptions {
  /**
   * Paper-per-model scale: how much larger (or smaller) the view is drawn than
   * the true model size. `2` is a 2:1 (enlarged detail), `0.5` a 1:2 (reduced)
   * view. Must be positive.
   */
  scale: number;
  /** The model-space point that is placed at `paperOrigin`. Defaults to the model origin `{ 0, 0 }`. */
  modelOrigin?: Point;
  /** The paper-space (mm) point where `modelOrigin` lands. Defaults to `{ 0, 0 }`. */
  paperOrigin?: Point;
  /**
   * Counterclockwise rotation of the view's geometry about `modelOrigin`, in
   * degrees — for auxiliary and rotated detail/section views. Defaults to 0.
   * Geometry rotates; annotation stays paper-upright (text is never turned),
   * so labels remain readable.
   */
  rotationDeg?: number;
  /** Optional name, emitted as the group's `id`. */
  name?: string;
}

/**
 * A scaled (and optionally rotated) viewport: a container whose children are
 * authored in **true model coordinates** and drawn onto the sheet at `scale`,
 * turned by `rotationDeg` about `modelOrigin`. Geometry scales and rotates, but
 * annotation stays paper-size, upright, and reads true — text height,
 * arrowheads, and line weights are unaffected, text is never turned, and a
 * `LinearDimension` (or `RadialDimension`, hole callout, …) inside the view
 * reports the real model value, not the scaled one. This is the
 * model-space/paper-space separation real drawings need for detail, section, and
 * auxiliary views: you draw the feature once at its true size and place it at,
 * say, 2:1 rotated 30°, without rescaling or re-rotating every coordinate or
 * overriding every dimension's text.
 *
 * `View` is itself a `Renderable`, so it adds to a `Sheet` (or nests in a
 * `Layer`) like anything else. Use {@link View.toPaper} to position paper-space
 * annotations (a `"SCALE 2:1"` label, a section title) relative to the view.
 *
 * Honored by geometry (`DrawingElement`), `TextElement`, the dimension classes,
 * and the elbow-leader callouts (`Callout`/`MultiLeader`/`DetailViewCallout`).
 * Other annotation classes render at paper scale regardless — position those
 * with `toPaper()`. Views don't compose: a nested `View` replaces the outer
 * transform rather than multiplying it.
 */
export class View implements Renderable {
  /** The view's paper-per-model scale. */
  readonly scale: number;
  private readonly transform: ViewTransform;
  private readonly name: string | undefined;
  private readonly elements: Renderable[] = [];

  constructor(options: ViewOptions) {
    if (options.scale <= 0) throw new Error(`View scale must be positive, got ${options.scale}`);
    this.scale = options.scale;
    const modelOrigin = options.modelOrigin ?? point(0, 0);
    const paperOrigin = options.paperOrigin ?? point(0, 0);
    const rotation = ((options.rotationDeg ?? 0) * Math.PI) / 180;
    // paper = rotate(scale·model, θ) + translate, chosen so modelOrigin lands on paperOrigin.
    const scaledOrigin = rotatePoint(point(modelOrigin.x * this.scale, modelOrigin.y * this.scale), rotation);
    this.transform = {
      scale: this.scale,
      translate: point(paperOrigin.x - scaledOrigin.x, paperOrigin.y - scaledOrigin.y),
      rotation,
    };
    this.name = options.name;
  }

  /** Adds model-space content to the view. Returns `this` for chaining. */
  add(element: Renderable): this {
    this.elements.push(element);
    return this;
  }

  /** This view's child renderables (authored in model space), in insertion order — lets a `Sheet` walk the view tree (e.g. for `Sheet.toDXF`). */
  getElements(): readonly Renderable[] {
    return this.elements;
  }

  /** This view's model→paper {@link ViewTransform} — the scale/rotation/translation applied to its children. */
  get viewTransform(): ViewTransform {
    return this.transform;
  }

  /** Maps a model-space point to its paper-space position — for placing paper-space annotations relative to the view. */
  toPaper(modelPoint: Point): Point {
    return applyViewTransform(modelPoint, this.transform);
  }

  /** The inverse of {@link toPaper}: maps a paper-space point back to model space. */
  toModel(paperPoint: Point): Point {
    const { translate, rotation } = this.transform;
    const shifted = point(paperPoint.x - translate.x, paperPoint.y - translate.y);
    const unrotated = rotation ? rotatePoint(shifted, -rotation) : shifted;
    return point(unrotated.x / this.scale, unrotated.y / this.scale);
  }

  toSVG(context?: RenderContext): string {
    const childContext: RenderContext = { ...context, transform: this.transform };
    const body = this.elements.map((e) => e.toSVG(childContext)).join("\n");
    const id = this.name ? ` id="${escapeXMLAttr(this.name)}"` : "";
    return `<g class="view"${id}>\n${body}\n</g>`;
  }

  /** The paper-space bounds of the view's children (each measured through the view transform, so the box is where they actually land on the sheet), or `null` if none is measurable. Like `toSVG`, the view replaces rather than composes an enclosing transform. */
  bounds(): BoundingBox | null {
    return boundsOf(this.elements, { transform: this.transform });
  }

  /** The model-space bounds of the view's children (their true, unscaled extent), or `null` if none is measurable — the box `fitView` scales to fit. */
  contentBounds(): BoundingBox | null {
    return boundsOf(this.elements);
  }
}

/**
 * Formats a paper-per-model `scale` as the conventional drawing ratio string —
 * `2` → `"2:1"`, `0.5` → `"1:2"`, `1` → `"1:1"` — for a title block's `scale`
 * field or a view's `"SCALE …"` label.
 */
export function formatScaleRatio(scale: number): string {
  if (scale >= 1) return `${formatNumber(scale)}:1`;
  return `1:${formatNumber(1 / scale)}`;
}

/** A target rectangle for {@link fitView} — e.g. a `Sheet`'s `drawingArea`. */
export interface FitArea {
  /** Left edge (mm). */
  x: number;
  /** Bottom edge (mm). */
  y: number;
  /** Width (mm). */
  width: number;
  /** Height (mm). */
  height: number;
}

/** Options for {@link fitView}. */
export interface FitViewOptions {
  /** Blank margin kept inside `area` on every side, in mm. Defaults to 0. */
  marginMM?: number;
  /** Cap on the computed scale (e.g. `1` to never enlarge past 1:1). Defaults to unlimited. */
  maxScale?: number;
  /** Name passed through to the returned `View`. */
  name?: string;
}

/**
 * Builds a {@link View} that scales and centers model-space content (given its
 * model bounds, e.g. from `View.contentBounds()` or `boundsOf(...)`) to fit
 * inside `area` (e.g. a `Sheet`'s `drawingArea`) with an optional margin — the
 * fit-to-view convenience that geometry introspection enables. The returned view
 * is empty; `.add(...)` the same content to it. Uniform scale (aspect preserved),
 * capped by `maxScale`; content is centered in the area.
 */
export function fitView(contentBoundsMM: BoundingBox, area: FitArea, options: FitViewOptions = {}): View {
  const margin = options.marginMM ?? 0;
  const availW = Math.max(area.width - 2 * margin, 0);
  const availH = Math.max(area.height - 2 * margin, 0);
  const w = bboxWidth(contentBoundsMM) || 1e-9;
  const h = bboxHeight(contentBoundsMM) || 1e-9;
  let scale = Math.min(availW / w, availH / h);
  if (options.maxScale !== undefined) scale = Math.min(scale, options.maxScale);

  const modelOrigin = point((contentBoundsMM.minX + contentBoundsMM.maxX) / 2, (contentBoundsMM.minY + contentBoundsMM.maxY) / 2);
  const paperOrigin = point(area.x + area.width / 2, area.y + area.height / 2);
  return new View(options.name !== undefined ? { scale, modelOrigin, paperOrigin, name: options.name } : { scale, modelOrigin, paperOrigin });
}
