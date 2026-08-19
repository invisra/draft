import { writeFileSync } from "node:fs";
import {
  ASME_INCH,
  centerMark,
  circle,
  DiameterDimension,
  DrawingElement,
  inchToleranceBlock,
  LinearDimension,
  ordinateDimensions,
  PAPER_SIZES,
  Path,
  Sheet,
  TitleBlock,
  toMM,
} from "../src/index.js";

/**
 * A US-customary (decimal-inch) drawing. Geometry is authored in inches via
 * `toMM(...)` — the library stores everything in millimeters internally — while
 * every dimension is *displayed* in inches: the `ASME_INCH` preset is set once
 * as the sheet's `dimensionDefaults`, so no dimension repeats `unit: "in"`. That
 * applies the ASME Y14.5 §2.3.2 inch conventions automatically: 3-place
 * precision and no leading zero on sub-inch values (`.750`, `.375`). Shows off
 * the US-standard pieces: a block-tolerance title block, ordinate (arrowless)
 * dimensioning from a datum, and a chamfer callout.
 */
export function buildInchSheetExample(): Sheet {
  // dimensions authored in inches
  const plateW = 3.0;
  const plateH = 2.0;
  const chamfer = 0.25; // 45° chamfer at the top-right corner
  const holeDia = 0.375;
  const holeInset = 0.5;

  // ASME_INCH set once here means every dimension below displays in inches — no per-call `unit: "in"`.
  const sheet = new Sheet({ paperSize: PAPER_SIZES.ANSI_B, orientation: "landscape", borderStyle: "zoned", dimensionDefaults: ASME_INCH });
  sheet.setTitleBlock(
    new TitleBlock({
      title: "PLATE, COVER",
      drawingNumber: "DRW-2000",
      revision: "A",
      scale: "1:1",
      sheet: "1 OF 1",
      material: "6061-T6 ALUMINUM",
      finish: "ANODIZE, CLEAR",
      // the classic US block tolerance: decimal-place count picks the default tolerance
      generalTolerance: inchToleranceBlock({ twoPlace: 0.01, threePlace: 0.005, angularDeg: 0.5 }),
      projection: "third-angle",
      drawnBy: "S. RICHS",
      drawnDate: "2026-08-07",
    }),
  );

  const area = sheet.drawingArea;
  const plateWmm = toMM(plateW, "in");
  const plateHmm = toMM(plateH, "in");
  const chamMM = toMM(chamfer, "in");
  const plateX = area.x + (area.width - plateWmm) / 2;
  const plateY = area.y + (area.height - plateHmm) / 2;

  // plate outline: a rectangle with a 45° chamfer cut into the top-right corner
  const outline = new Path()
    .moveTo(plateX, plateY)
    .lineTo(plateX + plateWmm, plateY)
    .lineTo(plateX + plateWmm, plateY + plateHmm - chamMM)
    .lineTo(plateX + plateWmm - chamMM, plateY + plateHmm)
    .lineTo(plateX, plateY + plateHmm)
    .close();
  sheet.add(new DrawingElement(outline));

  // four mounting holes, laid out in inches
  const insetMM = toMM(holeInset, "in");
  const holeRmm = toMM(holeDia / 2, "in");
  const holeCenters = [
    { x: plateX + insetMM, y: plateY + insetMM },
    { x: plateX + plateWmm - insetMM, y: plateY + insetMM },
    { x: plateX + insetMM, y: plateY + plateHmm - insetMM },
    { x: plateX + plateWmm - insetMM, y: plateY + plateHmm - insetMM },
  ];
  for (const c of holeCenters) {
    sheet.add(new DrawingElement(circle(c.x, c.y, holeRmm)));
    for (const mark of centerMark(c, holeRmm, toMM(0.1, "in"))) sheet.add(new DrawingElement(mark, { lineStyle: "centerline" }));
  }

  // overall dimensions, displayed in inches with a US block-style tolerance
  sheet.add(
    new LinearDimension({ x: plateX, y: plateY }, { x: plateX + plateWmm, y: plateY }, {
      offset: -toMM(0.5, "in"),
      orientation: "horizontal",
      tolerance: 0.01,
    }),
  );
  sheet.add(
    new LinearDimension({ x: plateX, y: plateY }, { x: plateX, y: plateY + plateHmm }, {
      offset: toMM(0.5, "in"),
      orientation: "vertical",
      tolerance: 0.01,
    }),
  );

  // ordinate (arrowless) dimensioning of the hole X-positions from the lower-left
  // datum, read out above the plate — every value measured from the same origin.
  const topEdgeY = plateY + plateHmm;
  const datum = { x: plateX, y: topEdgeY };
  const ordinateFeatures = [datum, { x: holeCenters[0]!.x, y: topEdgeY }, { x: holeCenters[1]!.x, y: topEdgeY }];
  for (const d of ordinateDimensions(datum, ordinateFeatures, { axis: "x", offset: toMM(0.4, "in") })) {
    sheet.add(d);
  }

  // hole diameter — inherits inches from the sheet default
  sheet.add(new DiameterDimension(holeCenters[3]!, holeRmm, { angleDeg: -45 }));

  return sheet;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const svg = buildInchSheetExample().toSVG();
  writeFileSync(new URL("./inch-sheet.svg", import.meta.url), svg);
  console.log("Wrote examples/inch-sheet.svg");
}
