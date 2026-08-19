/**
 * A minimal parser for exactly the subset of SVG this library itself emits — not a general-purpose
 * SVG parser. The whole library only ever produces five element shapes (verified by grepping the
 * generator code): the root `<svg>`/flip-`<g>` wrapper (`renderSVGDocument`), a `<path>`
 * (`DrawingElement`), a per-text counter-flip `<g><text>...</text></g>` (`TextElement`), a named
 * `<g class="layer">` (`Layer`), and a `<g class="view">` (`View`) — a plain group whose children
 * already carry the view's scale/translate baked into their coordinates (there is no SVG
 * `transform` attribute to honor). This module recognizes exactly those shapes and throws on
 * anything else, since a new shape would mean the SVG generator changed without this parser being
 * updated to match.
 */

export interface PathNode {
  type: "path";
  d: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  dasharray?: number[];
  linecap?: string;
  linejoin?: string;
}

export interface TextNode {
  type: "text";
  x: number;
  y: number;
  content: string;
  fontSize: number;
  anchor: "start" | "middle" | "end";
  fill: string;
  weight: "normal" | "bold";
  /**
   * The linear part `[a, b, c, d]` of the SVG wrapper's transform, for sheared/rotated (isometric)
   * text. Absent means upright text (the plain `translate(...) scale(1,-1)` wrapper, equivalent to
   * `[1, 0, 0, -1]`).
   */
  matrix?: [number, number, number, number];
}

export interface LayerNode {
  type: "layer";
  name: string;
  visible: boolean;
  children: SvgNode[];
}

export interface ViewNode {
  type: "view";
  name: string;
  children: SvgNode[];
}

export type SvgNode = PathNode | TextNode | LayerNode | ViewNode;

export interface ParsedDocument {
  widthMM: number;
  heightMM: number;
  children: SvgNode[];
}

interface RawNode {
  tag: string;
  attrs: Record<string, string>;
  children: RawNode[];
  text: string;
}

function unescapeXML(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

const TOKEN_RE = /<([a-zA-Z][\w-]*)((?:\s+[\w-]+="[^"]*")*)\s*(\/)?>|<\/([a-zA-Z][\w-]*)>|([^<]+)/g;
const ATTR_RE = /([\w-]+)="([^"]*)"/g;

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of raw.matchAll(ATTR_RE)) {
    attrs[m[1]!] = unescapeXML(m[2]!);
  }
  return attrs;
}

/** Parses well-formed XML/SVG markup (this library's own narrow grammar) into a generic tag tree. */
function parseRawTree(xml: string): RawNode {
  const withoutDecl = xml.replace(/<\?xml[^?]*\?>/, "");
  const root: RawNode = { tag: "#root", attrs: {}, children: [], text: "" };
  const stack: RawNode[] = [root];

  for (const m of withoutDecl.matchAll(TOKEN_RE)) {
    const [, openTag, attrsRaw, selfClose, closeTag, text] = m;
    const top = stack[stack.length - 1]!;
    if (openTag) {
      const node: RawNode = { tag: openTag, attrs: parseAttrs(attrsRaw ?? ""), children: [], text: "" };
      top.children.push(node);
      if (!selfClose) stack.push(node);
    } else if (closeTag) {
      if (stack.length <= 1 || stack[stack.length - 1]!.tag !== closeTag) {
        throw new Error(`parseSvg: mismatched closing tag </${closeTag}>`);
      }
      stack.pop();
    } else if (text !== undefined) {
      if (text.trim() !== "") top.text += unescapeXML(text);
    }
  }
  if (stack.length !== 1) {
    throw new Error(`parseSvg: unclosed tag <${stack[stack.length - 1]!.tag}>`);
  }
  return root;
}

const TEXT_WRAPPER_TRANSFORM_RE = /^translate\(([-\d.]+) ([-\d.]+)\) scale\(1,-1\)$/;
const TEXT_MATRIX_TRANSFORM_RE = /^matrix\(([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)\)$/;

/** Reads the shared text attributes (content, size, anchor, fill, weight) off a `<text>` wrapper's single child. */
function textNodeFrom(node: RawNode, x: number, y: number, matrix?: [number, number, number, number]): TextNode {
  if (node.children.length !== 1 || node.children[0]!.tag !== "text") {
    throw new Error("parseSvg: text-wrapper <g> must contain exactly one <text>");
  }
  const t = node.children[0]!;
  const a = t.attrs;
  const base: TextNode = {
    type: "text",
    x,
    y,
    content: t.text,
    fontSize: parseFloat(a["font-size"] ?? "3"),
    anchor: (a["text-anchor"] as TextNode["anchor"] | undefined) ?? "start",
    fill: a.fill ?? "black",
    weight: (a["font-weight"] as TextNode["weight"] | undefined) ?? "normal",
  };
  return matrix ? { ...base, matrix } : base;
}

function interpretNode(node: RawNode): SvgNode {
  if (node.tag === "path") {
    const a = node.attrs;
    const path: PathNode = { type: "path", d: a.d ?? "", fill: a.fill ?? "none" };
    if (a.stroke !== undefined) path.stroke = a.stroke;
    if (a["stroke-width"] !== undefined) path.strokeWidth = parseFloat(a["stroke-width"]);
    if (a["stroke-dasharray"] !== undefined) path.dasharray = a["stroke-dasharray"].split(",").map(Number);
    if (a["stroke-linecap"] !== undefined) path.linecap = a["stroke-linecap"];
    if (a["stroke-linejoin"] !== undefined) path.linejoin = a["stroke-linejoin"];
    return path;
  }

  if (node.tag === "g" && node.attrs.class === "layer") {
    const name = node.attrs["data-layer"] ?? node.attrs.id ?? "";
    const visible = node.attrs.style !== "display:none";
    return { type: "layer", name, visible, children: node.children.map(interpretNode) };
  }

  if (node.tag === "g" && node.attrs.class === "view") {
    // A view is a plain group: its children already carry the baked-in view transform, so it just
    // renders inline (no PDF optional-content group, unlike a layer).
    return { type: "view", name: node.attrs.id ?? "", children: node.children.map(interpretNode) };
  }

  if (node.tag === "g" && node.attrs.transform && TEXT_WRAPPER_TRANSFORM_RE.test(node.attrs.transform)) {
    const [, tx, ty] = TEXT_WRAPPER_TRANSFORM_RE.exec(node.attrs.transform)!;
    return textNodeFrom(node, parseFloat(tx!), parseFloat(ty!));
  }

  if (node.tag === "g" && node.attrs.transform && TEXT_MATRIX_TRANSFORM_RE.test(node.attrs.transform)) {
    // Sheared/rotated (isometric) text: keep the linear part [a,b,c,d]; e,f are the anchor position.
    const [, a, b, c, d, e, f] = TEXT_MATRIX_TRANSFORM_RE.exec(node.attrs.transform)!;
    return textNodeFrom(node, parseFloat(e!), parseFloat(f!), [parseFloat(a!), parseFloat(b!), parseFloat(c!), parseFloat(d!)]);
  }

  throw new Error(`parseSvg: unrecognized element <${node.tag}${Object.keys(node.attrs).length ? " ..." : ""}>`);
}

/** Parses a complete SVG document string as produced by `renderSVGDocument`/`Sheet.toSVG()`. */
export function parseSvgDocument(svg: string): ParsedDocument {
  const root = parseRawTree(svg);
  const svgNode = root.children.find((n) => n.tag === "svg");
  if (!svgNode) throw new Error("parseSvg: no <svg> root element found");

  const widthMM = parseFloat((svgNode.attrs.width ?? "").replace("mm", ""));
  const heightMM = parseFloat((svgNode.attrs.height ?? "").replace("mm", ""));

  // renderSVGDocument always wraps its body in exactly one root flip-<g> (translate(0,H) scale(1,-1))
  if (svgNode.children.length !== 1 || svgNode.children[0]!.tag !== "g") {
    throw new Error("parseSvg: expected a single root <g> (the Y-flip wrapper) inside <svg>");
  }
  const flipGroup = svgNode.children[0]!;
  return { widthMM, heightMM, children: flipGroup.children.map(interpretNode) };
}
