import { formatNumber } from "../util.js";

/** Options for {@link renderSVGDocument}. */
export interface SVGDocumentOptions {
  /** Document width, in mm. */
  widthMM: number;
  /** Document height, in mm. */
  heightMM: number;
  /** Raw SVG markup for the drawing content, in Y-up drafting coordinates. */
  body: string;
}

/**
 * Wraps drawing content in a standalone <svg> document sized in real millimeters,
 * flipping the coordinate system once so content can be authored Y-up (+Y = up),
 * matching drafting convention.
 */
export function renderSVGDocument(options: SVGDocumentOptions): string {
  const { widthMM, heightMM, body } = options;
  const w = formatNumber(widthMM);
  const h = formatNumber(heightMM);
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">
<g transform="translate(0, ${h}) scale(1, -1)">
${body}
</g>
</svg>
`;
}
