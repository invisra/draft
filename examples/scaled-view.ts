import { writeFileSync } from "node:fs";
import {
  centerMark,
  circle,
  DiameterDimension,
  DrawingElement,
  formatScaleRatio,
  LinearDimension,
  rectangle,
  Sheet,
  TextElement,
  TitleBlock,
  View,
} from "../src/index.js";

/**
 * Demonstrates model-space/paper-space separation with `View`: a plate is drawn
 * at 1:1, and one mounting hole is shown again in a 2:1 detail view. Both are
 * authored in **true model coordinates** — the detail's geometry is the same
 * hole, just placed at scale 2 — and every dimension reports the real size, with
 * no manual coordinate scaling or dimension-text overrides.
 */
export function buildScaledViewExample(): Sheet {
  const detailScale = 2;
  const sheet = new Sheet({ orientation: "landscape", borderStyle: "plain" });
  sheet.setTitleBlock(
    new TitleBlock({
      title: "PLATE — SCALED DETAIL",
      drawingNumber: "DRW-4000",
      revision: "A",
      scale: "1:1",
      sheet: "1 OF 1",
      drawnBy: "S. RICHS",
      drawnDate: "2026-08-07",
    }),
  );

  const area = sheet.drawingArea;

  // --- main view, 1:1 ---
  const plateX = area.x + 30;
  const plateY = area.y + 40;
  const plateW = 80;
  const plateH = 50;
  const holeR = 4;
  const hole = { x: plateX + 20, y: plateY + 25 };

  const main = new View({ scale: 1, paperOrigin: { x: plateX, y: plateY } });
  // authored relative to the plate's bottom-left (model coords)
  const mx = (p: { x: number; y: number }) => ({ x: p.x - plateX, y: p.y - plateY });
  main.add(new DrawingElement(rectangle(0, 0, plateW, plateH)));
  main.add(new DrawingElement(circle(mx(hole).x, mx(hole).y, holeR)));
  for (const m of centerMark(mx(hole), holeR, 3)) main.add(new DrawingElement(m, { lineStyle: "centerline" }));
  main.add(new LinearDimension({ x: 0, y: 0 }, { x: plateW, y: 0 }, { offset: -12, orientation: "horizontal" }));
  main.add(new LinearDimension({ x: 0, y: 0 }, { x: 0, y: plateH }, { offset: -12, orientation: "vertical" }));
  sheet.add(main);

  // --- detail view of the hole, 2:1 (same geometry, authored once, drawn scaled) ---
  const detailAt = { x: plateX + plateW + 55, y: plateY + 20 };
  const detail = new View({ scale: detailScale, modelOrigin: mx(hole), paperOrigin: detailAt });
  detail.add(new DrawingElement(circle(mx(hole).x, mx(hole).y, holeR)));
  for (const m of centerMark(mx(hole), holeR, 3)) detail.add(new DrawingElement(m, { lineStyle: "centerline" }));
  // dimensions read the TRUE ⌀8.00, even though the circle is drawn at 2x
  detail.add(new DiameterDimension(mx(hole), holeR, { angleDeg: 60 }));
  sheet.add(detail);

  // paper-space label under the detail (positioned via the view, but not scaled)
  const labelAt = detail.toPaper({ x: mx(hole).x, y: mx(hole).y - 14 });
  sheet.add(new TextElement(labelAt, `DETAIL A  —  SCALE ${formatScaleRatio(detailScale)}`, { size: 3.5, weight: "bold", anchor: "middle" }));

  return sheet;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL("./scaled-view.svg", import.meta.url), buildScaledViewExample().toSVG());
  console.log("Wrote examples/scaled-view.svg");
}
