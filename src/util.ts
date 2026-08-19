/** For SVG coordinates/geometry: strips trailing zeros for compact path data ("10" not "10.00000"). */
export function formatNumber(value: number, precision = 5): string {
  const v = Object.is(value, -0) ? 0 : value;
  return Number(v.toFixed(precision)).toString();
}

/** For dimension/measurement display text: fixed decimal places, since "80.10" vs "80.1" communicates precision in drafting convention. */
export function formatFixed(value: number, precision: number): string {
  const s = value.toFixed(precision);
  // Drop a leading "-" when the value rounds to zero at this precision (-0, but also e.g. -0.001 at 2dp),
  // so a feature just below an axis/origin never reads as "-0.00".
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}

export function escapeXMLText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeXMLAttr(value: string): string {
  return escapeXMLText(value).replace(/"/g, "&quot;");
}
