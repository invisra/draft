import type { DimensionStyle } from "../dimension/style.js";
import { renderSVGDocument } from "../svg/document.js";
import { applyViewTransform, boundsOf, isExplodable, type Renderable, type RenderContext, type ViewTransform } from "../svg/renderable.js";
import type { BoundingBox } from "../geometry/bbox.js";
import type { TitleBlockLike } from "../titleblock/titleBlock.js";
import { plainBorderElements, renderPlainBorder, renderZonedBorder, zonedBorderElements, type BorderStyle, type ZonedBorderOptions } from "./border.js";
import { ANSI_A, type PaperSize } from "./paperSizes.js";
import { exportDXF, type DXFExportInput, type TransformableDimension } from "../dxf/exportDXF.js";
import { DrawingElement } from "../svg/element.js";
import { TextElement } from "../svg/text.js";
import { BlockInstance } from "../svg/block.js";
import { Layer } from "../svg/layer.js";
import { View } from "../svg/view.js";
import { LinearDimension } from "../dimension/linearDimension.js";
import { RadialDimension, DiameterDimension } from "../dimension/radialDimension.js";
import { AngularDimension } from "../dimension/angularDimension.js";
import { OrdinateDimension } from "../dimension/ordinateDimension.js";

/** Layer that a sheet's border (and zone grid) is placed on in {@link Sheet.toDXF}. */
const BORDER_LAYER = "BORDER";

/** Native-DIMENSION dimension classes — exported as editable DXF `DIMENSION` entities (view transform baked into their definition points). */
function isNativeDimension(el: Renderable): el is TransformableDimension {
  return (
    el instanceof LinearDimension ||
    el instanceof RadialDimension ||
    el instanceof DiameterDimension ||
    el instanceof AngularDimension ||
    el instanceof OrdinateDimension
  );
}

/** True for a view transform that leaves geometry unchanged (so native dimensions inside it are still correct). */
function isIdentityTransform(t: ViewTransform): boolean {
  return t.scale === 1 && !t.rotation && t.translate.x === 0 && t.translate.y === 0;
}

/** Options for {@link Sheet.toDXF}. */
export interface SheetDXFExportOptions {
  /** Decimal places for coordinate/bulge values. Defaults to 6. */
  precision?: number;
  /**
   * Called for any content `toDXF` can't represent, with a short description — so nothing is dropped
   * silently. Native dimensions inside a scaled/rotated `View` now export as `DIMENSION` entities with
   * the view transform baked into their definition points (the displayed value stays the true model
   * measurement), so they no longer report here; this fires only for content types `toDXF` has no
   * representation for at all. Omit to skip silently.
   */
  onUnsupported?: (message: string) => void;
}

/** Sheet orientation: landscape (wide) or portrait (tall). */
export type Orientation = "portrait" | "landscape";

/** Options for a {@link Sheet}. */
export interface SheetOptions {
  /** Defaults to `ANSI_A` (US Letter). */
  paperSize?: PaperSize;
  /** Defaults to "landscape". */
  orientation?: Orientation;
  /** Distance in mm from the paper edge to the border. */
  marginMM?: number;
  /** Defaults to 0.5mm. */
  borderStrokeWidthMM?: number;
  /** "plain" (default): a single frame. "zoned": adds a numbered/lettered zone reference grid. */
  borderStyle?: BorderStyle;
  /** Extra options for a `"zoned"` border (target zone size, starting corner, etc.). */
  zonedBorderOptions?: Omit<ZonedBorderOptions, "strokeWidthMM">;
  /**
   * Document-wide default {@link DimensionStyle}, merged *under* every
   * dimension/leader element's own options at render time — so a whole sheet can
   * be set to inches (or any shared text/arrow/color style) in one place instead
   * of repeating it on each dimension. Pass a preset (`ASME_INCH`,
   * `ASME_METRIC`, `ISO_METRIC`) or any partial style. Per-element options always
   * win. See {@link RenderContext} for exactly which classes honor it.
   */
  dimensionDefaults?: DimensionStyle;
}

/** The usable rectangle inside a sheet's border (and above its title block, if any). */
export interface DrawingArea {
  /** Left edge, in mm. */
  x: number;
  /** Bottom edge, in mm. */
  y: number;
  /** Width, in mm. */
  width: number;
  /** Height, in mm. */
  height: number;
}

/** Anything a {@link Sheet} can hold: any {@link Renderable} (a `DrawingElement`, `Layer`, dimension, symbol, etc.). */
export type SheetContent = Renderable;

/** A paper sheet: border, optional title block, and drawing content, rendered to a physical-unit SVG document. */
export class Sheet {
  /** The sheet's base paper size (before orientation is applied). */
  readonly paperSize: PaperSize;
  /** Landscape or portrait. */
  readonly orientation: Orientation;
  /** Distance in mm from the paper edge to the border. */
  readonly marginMM: number;
  /** Full sheet width in mm, accounting for `orientation`. */
  readonly widthMM: number;
  /** Full sheet height in mm, accounting for `orientation`. */
  readonly heightMM: number;

  private readonly borderStrokeWidthMM: number;
  private readonly borderStyle: BorderStyle;
  private readonly zonedBorderOptions: Omit<ZonedBorderOptions, "strokeWidthMM">;
  private readonly dimensionDefaults: DimensionStyle | undefined;
  private readonly elements: SheetContent[] = [];
  private titleBlock: TitleBlockLike | undefined;

  constructor(options: SheetOptions = {}) {
    this.paperSize = options.paperSize ?? ANSI_A;
    this.orientation = options.orientation ?? "landscape";
    this.marginMM = options.marginMM ?? 10;
    this.borderStrokeWidthMM = options.borderStrokeWidthMM ?? 0.5;
    this.borderStyle = options.borderStyle ?? "plain";
    this.zonedBorderOptions = options.zonedBorderOptions ?? {};
    this.dimensionDefaults = options.dimensionDefaults;

    const long = Math.max(this.paperSize.widthMM, this.paperSize.heightMM);
    const short = Math.min(this.paperSize.widthMM, this.paperSize.heightMM);
    if (this.orientation === "landscape") {
      this.widthMM = long;
      this.heightMM = short;
    } else {
      this.widthMM = short;
      this.heightMM = long;
    }
  }

  /** The usable area inside the border, above the title block (if any). */
  get drawingArea(): DrawingArea {
    const m = this.marginMM;
    const tbHeight = this.titleBlock?.heightMM ?? 0;
    return {
      x: m,
      y: m + tbHeight,
      width: this.widthMM - 2 * m,
      height: this.heightMM - 2 * m - tbHeight,
    };
  }

  /** Adds drawing content to the sheet. Returns `this` for chaining. */
  add(element: SheetContent): this {
    this.elements.push(element);
    return this;
  }

  /** Attaches a title block, rendered at the bottom-right of the sheet. Returns `this` for chaining. */
  setTitleBlock(titleBlock: TitleBlockLike): this {
    this.titleBlock = titleBlock;
    return this;
  }

  /** The combined bounding box (mm, paper space) of all added content that exposes a `bounds()`, or `null` if nothing measurable was added. Excludes the border and title block. Useful for fit-to-view and auto-sizing. */
  contentBounds(): BoundingBox | null {
    const context: RenderContext | undefined = this.dimensionDefaults ? { dimensionDefaults: this.dimensionDefaults } : undefined;
    return boundsOf(this.elements, context);
  }

  private renderBorder(): string {
    const strokeWidthMM = this.borderStrokeWidthMM;
    return this.borderStyle === "zoned"
      ? renderZonedBorder(this.widthMM, this.heightMM, this.marginMM, { ...this.zonedBorderOptions, strokeWidthMM })
      : renderPlainBorder(this.widthMM, this.heightMM, this.marginMM, { strokeWidthMM });
  }

  /** Renders the complete sheet — border, content, and title block — as a standalone, physical-unit SVG document. */
  toSVG(): string {
    const context: RenderContext | undefined = this.dimensionDefaults ? { dimensionDefaults: this.dimensionDefaults } : undefined;
    const body: string[] = [this.renderBorder()];
    for (const el of this.elements) body.push(el.toSVG(context));
    if (this.titleBlock) {
      body.push(
        this.titleBlock.render({ sheetWidthMM: this.widthMM, marginMM: this.marginMM, paperSizeLabel: this.paperSize.sizeLabel }),
      );
    }
    return renderSVGDocument({ widthMM: this.widthMM, heightMM: this.heightMM, body: body.join("\n") });
  }

  /**
   * Exports the complete sheet — border, content, and title block — as a single R12 DXF string, the
   * DXF counterpart to {@link toSVG}. Walks the content tree, recursing into `Layer`s and `View`s:
   *
   * - The **border** (plain or zoned) is emitted on a `"BORDER"` layer.
   * - Content at the sheet or `Layer` level is exported at full fidelity — geometry as `POLYLINE`,
   *   text as `TEXT`, dimensions as native `DIMENSION` entities, GD&T/tables/callouts exploded onto
   *   their layers (see {@link exportDXF}).
   * - Content inside a **`View`** has the view's scale/rotation/translation baked into its geometry
   *   (so a scaled detail view lands correctly): `DrawingElement` paths are transformed, text and
   *   annotations are re-anchored. A **native dimension inside a scaled/rotated view** can't be
   *   carried by a DXF `DIMENSION` entity, so it's skipped and reported via `options.onUnsupported`
   *   (nothing is dropped silently).
   * - The **title block** is exploded onto a `"TITLEBLOCK"` layer.
   *
   * `Layer` names are not mapped to DXF layers — entities are organized by type (`VISIBLE`, `HIDDEN`,
   * `DIMENSIONS`, `ANNOTATIONS`, `GDT`, `TITLEBLOCK`, `BORDER`), a consistent scheme regardless of how
   * content was grouped for SVG.
   */
  toDXF(options: SheetDXFExportOptions = {}): string {
    const inputs: DXFExportInput[] = [];

    const strokeWidthMM = this.borderStrokeWidthMM;
    const borderElements =
      this.borderStyle === "zoned"
        ? zonedBorderElements(this.widthMM, this.heightMM, this.marginMM, { ...this.zonedBorderOptions, strokeWidthMM })
        : plainBorderElements(this.widthMM, this.heightMM, this.marginMM, { strokeWidthMM });
    for (const el of borderElements) {
      inputs.push(el instanceof DrawingElement ? { element: el, layer: BORDER_LAYER } : { text: el, layer: BORDER_LAYER });
    }

    const walk = (elements: readonly Renderable[], transform: ViewTransform | undefined): void => {
      for (const el of elements) {
        if (el instanceof Layer) {
          walk(el.getElements(), transform);
        } else if (el instanceof View) {
          // Nested views replace (not compose) the transform, matching Sheet/View SVG rendering.
          walk(el.getElements(), el.viewTransform);
        } else if (!transform || isIdentityTransform(transform)) {
          // Sheet/Layer level (or an untransformed view): full fidelity straight through exportDXF.
          if (isExportable(el)) inputs.push(el as DXFExportInput);
          else options.onUnsupported?.(`${el.constructor.name} isn't a DXF-exportable content type; it was skipped.`);
        } else if (el instanceof DrawingElement) {
          inputs.push({ element: new DrawingElement(el.path.transformed(transform.scale, transform.translate, transform.rotation ?? 0), el.options) });
        } else if (el instanceof TextElement) {
          inputs.push(new TextElement(applyViewTransform(el.position, transform), el.content, el.options));
        } else if (isNativeDimension(el)) {
          // Bake the view transform into the DIMENSION's definition points; the value text stays the true measurement.
          inputs.push({ dimension: el, transform });
        } else if (isExplodable(el)) {
          for (const prim of el.toElements({ transform })) inputs.push(prim);
        } else {
          options.onUnsupported?.(`${el.constructor.name} inside a view isn't supported by Sheet.toDXF; it was skipped.`);
        }
      }
    };
    walk(this.elements, undefined);

    if (this.titleBlock) {
      inputs.push({
        titleBlock: this.titleBlock,
        context: { sheetWidthMM: this.widthMM, marginMM: this.marginMM, paperSizeLabel: this.paperSize.sizeLabel },
      });
    }

    return exportDXF(inputs, options.precision !== undefined ? { precision: options.precision } : {});
  }
}

/** Whether a sheet-level renderable is a content type {@link exportDXF} accepts directly. */
function isExportable(el: Renderable): boolean {
  return (
    el instanceof DrawingElement ||
    el instanceof TextElement ||
    el instanceof BlockInstance ||
    isNativeDimension(el) ||
    isExplodable(el)
  );
}
