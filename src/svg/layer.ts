import type { BoundingBox } from "../geometry/bbox.js";
import { escapeXMLAttr } from "../util.js";
import { boundsOf, type Renderable, type RenderContext } from "./renderable.js";

/** Options for a {@link Layer}. */
export interface LayerOptions {
  /** Layer name, used as both the SVG `id` and `data-layer` attribute. */
  name: string;
  /** Defaults to true. When false, the content is still present in the SVG output (wrapped in a hidden group), just not displayed — so downstream tools (Illustrator, Inkscape, a custom viewer) can toggle it back on. */
  visible?: boolean;
}

/**
 * A named group of drawing content, rendered as a single SVG `<g>`. Hiding a
 * layer doesn't remove its content from the output, just hides it (inline
 * `display:none`) — content stays toggleable downstream. Layers are
 * themselves `Renderable`, so they nest freely (`Layer.add()` accepts another
 * `Layer`) and add to a `Sheet` like any other content.
 */
export class Layer implements Renderable {
  private readonly elements: Renderable[] = [];

  constructor(private readonly options: LayerOptions) {}

  /** Adds a renderable element (or nested `Layer`) to this layer. Returns `this` for chaining. */
  add(element: Renderable): this {
    this.elements.push(element);
    return this;
  }

  /** This layer's child renderables, in insertion order — lets a `Sheet` walk the layer tree (e.g. for `Sheet.toDXF`). */
  getElements(): readonly Renderable[] {
    return this.elements;
  }

  /** This layer's name (its SVG `id`/`data-layer`). */
  get name(): string {
    return this.options.name;
  }

  toSVG(context?: RenderContext): string {
    const id = escapeXMLAttr(this.options.name);
    const hidden = this.options.visible === false ? ' style="display:none"' : "";
    const body = this.elements.map((e) => e.toSVG(context)).join("\n");
    return `<g id="${id}" class="layer" data-layer="${id}"${hidden}>\n${body}\n</g>`;
  }

  /** Union of the layer's children's bounds (skipping any that don't expose one), or `null` if empty. */
  bounds(context?: RenderContext): BoundingBox | null {
    return boundsOf(this.elements, context);
  }
}
