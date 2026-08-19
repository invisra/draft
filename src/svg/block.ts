import { point, type Point } from "../geometry/point.js";
import type { BoundingBox } from "../geometry/bbox.js";
import { boundsOf, composeViewTransforms, type Renderable, type RenderContext, type ViewTransform } from "./renderable.js";

/** A {@link Block} plus a concrete placement (position/scale/rotation), as returned by {@link BlockInstance.placement} and consumed by `exportDXF` to emit a `BLOCK` + `INSERT`. */
export interface BlockPlacement {
  /** The source symbol whose geometry is placed. */
  block: Block;
  /** Paper- (or enclosing-view-) space point where the block's local `(0,0)` lands. */
  position: Point;
  /** Uniform scale applied to the block's geometry. */
  scale: number;
  /** Counterclockwise rotation of the block, in degrees. */
  rotationDeg: number;
}

/** Options for placing a {@link Block} — where its local origin lands, and how it's scaled/rotated. */
export interface BlockInstanceOptions {
  /** Paper- (or enclosing-view-) space point where the block's local `(0,0)` lands. Defaults to `{ 0, 0 }`. */
  position?: Point;
  /** Uniform scale applied to the block's geometry. Must be positive. Defaults to 1. */
  scale?: number;
  /** Counterclockwise rotation of the block, in degrees. Defaults to 0. */
  rotationDeg?: number;
}

/**
 * A reusable symbol: a set of `Renderable`s authored once in **local
 * coordinates**, then stamped onto a drawing any number of times at different
 * positions, scales, and rotations — the CAD "block"/symbol-library concept.
 * Define the geometry once with {@link Block.add}, then place copies with
 * {@link Block.instance} (each a `Renderable` you add to a `Sheet`/`Layer`).
 *
 * A placed block applies a view-style transform to its children, so — exactly
 * like a `View` — geometry scales and rotates while text stays upright and
 * paper-size, and any dimensions inside behave *annotatively*. Unlike `View`, a
 * block instance **composes** with an enclosing `View`'s transform (its
 * scale/rotation multiply the view's) rather than replacing it, so a symbol
 * placed at model coordinates inside a scaled view scales with the view.
 */
export class Block {
  private readonly elements: Renderable[] = [];

  constructor(
    /** Optional identifying name for the symbol (not emitted into the SVG; for the caller's own bookkeeping). */
    readonly name?: string,
  ) {}

  /** Adds a renderable to the block's definition, in local coordinates. Returns `this` for chaining. */
  add(element: Renderable): this {
    this.elements.push(element);
    return this;
  }

  /** The block's defining renderables, in order. */
  getElements(): readonly Renderable[] {
    return this.elements;
  }

  /** Creates a placeable instance of this block. Add the returned `Renderable` to a `Sheet`/`Layer`/`View`. */
  instance(options: BlockInstanceOptions = {}): BlockInstance {
    return new BlockInstance(this, options);
  }
}

/**
 * A single placement of a {@link Block} at a position/scale/rotation. Renders the
 * block's children through the composed view transform (see {@link Block}); its
 * transform multiplies any enclosing `View`'s. Created via {@link Block.instance}.
 */
export class BlockInstance implements Renderable {
  private readonly transform: ViewTransform;

  constructor(
    private readonly block: Block,
    options: BlockInstanceOptions = {},
  ) {
    const scale = options.scale ?? 1;
    if (scale <= 0) throw new Error(`BlockInstance scale must be positive, got ${scale}`);
    this.transform = {
      scale,
      translate: options.position ?? point(0, 0),
      rotation: ((options.rotationDeg ?? 0) * Math.PI) / 180,
    };
  }

  toSVG(context?: RenderContext): string {
    const transform = composeViewTransforms(context?.transform, this.transform);
    const childContext: RenderContext = { ...context, transform };
    return this.block
      .getElements()
      .map((e) => e.toSVG(childContext))
      .join("\n");
  }

  /** Paper-space bounds of the placed block's children (through the instance transform, composed with any enclosing view transform), or `null` if none is measurable. */
  bounds(context?: RenderContext): BoundingBox | null {
    const transform = composeViewTransforms(context?.transform, this.transform);
    return boundsOf(this.block.getElements(), { ...context, transform });
  }

  /** The source {@link Block} and this placement's transform — used by `exportDXF` to emit a shared `BLOCK` definition plus an `INSERT`. */
  placement(): BlockPlacement {
    return {
      block: this.block,
      position: this.transform.translate,
      scale: this.transform.scale,
      rotationDeg: ((this.transform.rotation ?? 0) * 180) / Math.PI,
    };
  }
}
