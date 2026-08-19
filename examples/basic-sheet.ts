import { writeFileSync } from "node:fs";
import {
  AngularDimension,
  baselineDimension,
  Callout,
  centerMark,
  chainDimension,
  circle,
  DatumFeatureSymbol,
  DrawingElement,
  DrawingSet,
  exportDXF,
  exportPDF,
  FeatureControlFrame,
  hatch,
  Layer,
  LinearDimension,
  RadialDimension,
  rectangle,
  RevisionTable,
  roundedRectangle,
  Sheet,
  TitleBlock,
} from "../src/index.js";

const DRAWING_NUMBER = "DRW-1000";
const TITLE = "BRACKET, MOUNTING";
const REVISION = "B";
const DRAWN_BY = "S. RICHS";
const DRAWN_DATE = "2026-07-08";

const plateWidth = 80;
const plateHeight = 50;
const pocketWidth = 30;
const pocketHeight = 16;
const holeRadius = 4;
const holeInset = 12;

export interface BasicSheetExample {
  set: DrawingSet;
  /** Sheet 1's geometry layer only (plate outline, pocket, holes, centerlines, hatch swatch) — what the DXF export demo below exports. */
  geometryElements: DrawingElement[];
}

/** Builds the bracket example (two sheets: overview + pocket detail), reused by both the CLI demo below and the visual-regression test suite. */
export function buildBasicSheetExample(): BasicSheetExample {
  const set = new DrawingSet();

  // captured from sheet 1's geometry layer below, for the DXF export demo at the bottom of this file
  const geometryElements: DrawingElement[] = [];

  // Sheet 1: the overview drawing (plate outline, holes, dimensions, GD&T, revision history).
  set.add(({ sheetLabel }) => {
    const sheet = new Sheet({ orientation: "landscape", borderStyle: "zoned" });
    sheet.setTitleBlock(
      new TitleBlock({
        title: TITLE,
        drawingNumber: DRAWING_NUMBER,
        revision: REVISION,
        scale: "1:1",
        sheet: sheetLabel,
        material: "AL 6061-T6",
        finish: "ANODIZE, CLEAR",
        generalTolerance: ["X.XX = ±0.01", "ANGLES = ±0.5°"],
        projection: "third-angle",
        drawnBy: DRAWN_BY,
        drawnDate: DRAWN_DATE,
      }),
    );

    const area = sheet.drawingArea;
    const plateX = area.x + (area.width - plateWidth) / 2;
    const plateY = area.y + (area.height - plateHeight) / 2;

    // organize the drawing into layers: geometry, its dimensions/annotations, and a
    // hidden construction layer (present in the output, just not displayed by default —
    // downstream tools like Inkscape can toggle it back on).
    const geometryLayer = new Layer({ name: "geometry" });
    const dimensionsLayer = new Layer({ name: "dimensions" });
    const constructionLayer = new Layer({ name: "construction", visible: false });

    const addGeometry = (el: DrawingElement): void => {
      geometryLayer.add(el);
      geometryElements.push(el);
    };

    addGeometry(new DrawingElement(roundedRectangle(plateX, plateY, plateWidth, plateHeight, 6)));

    // hidden feature: a shallow pocket milled into the back face
    addGeometry(
      new DrawingElement(
        rectangle(plateX + (plateWidth - pocketWidth) / 2, plateY + (plateHeight - pocketHeight) / 2, pocketWidth, pocketHeight),
        { lineStyle: "hidden" },
      ),
    );

    const holeCenters = [
      { x: plateX + holeInset, y: plateY + holeInset },
      { x: plateX + plateWidth - holeInset, y: plateY + holeInset },
      { x: plateX + holeInset, y: plateY + plateHeight - holeInset },
      { x: plateX + plateWidth - holeInset, y: plateY + plateHeight - holeInset },
    ];
    for (const c of holeCenters) {
      addGeometry(new DrawingElement(circle(c.x, c.y, holeRadius)));
      for (const mark of centerMark(c, holeRadius, 2.5)) {
        addGeometry(new DrawingElement(mark, { lineStyle: "centerline" }));
      }
    }

    // reference diagonal used while laying out the hole pattern — kept, but hidden by default
    constructionLayer.add(
      new DrawingElement(rectangle(plateX, plateY, plateWidth, plateHeight), { lineStyle: "phantom", stroke: { color: "#0066cc" } }),
    );

    dimensionsLayer.add(
      new LinearDimension({ x: plateX, y: plateY }, { x: plateX + plateWidth, y: plateY }, {
        offset: -12,
        orientation: "horizontal",
        tolerance: 0.1,
      }),
    );
    dimensionsLayer.add(
      new LinearDimension({ x: plateX, y: plateY }, { x: plateX, y: plateY + plateHeight }, {
        offset: 12,
        orientation: "vertical",
        tolerance: 0.1,
        toleranceDisplay: "limits",
      }),
    );

    // baseline dimensioning: hole-column X positions, stacked below the overall width dimension
    const bottomLeftCorner = { x: plateX, y: plateY };
    const holeColumnBaseline = baselineDimension(
      [bottomLeftCorner, { x: holeCenters[0]!.x, y: plateY }, { x: holeCenters[1]!.x, y: plateY }],
      { offset: -20, orientation: "horizontal", stackSpacing: 8 },
    );
    for (const d of holeColumnBaseline) dimensionsLayer.add(d);

    // chain dimensioning: vertical hole spacing along the right-hand column
    const rightColumnChain = chainDimension([holeCenters[1]!, holeCenters[3]!], { offset: -15, orientation: "vertical" });
    for (const d of rightColumnChain) dimensionsLayer.add(d);

    const dimensionedHole = holeCenters[3]!;
    dimensionsLayer.add(new RadialDimension(dimensionedHole, holeRadius, { angleDeg: 45 }));

    const calloutAngle = -135;
    const calloutRad = (calloutAngle * Math.PI) / 180;
    const calloutHole = holeCenters[0]!;
    const calloutPoint = { x: calloutHole.x + holeRadius * Math.cos(calloutRad), y: calloutHole.y + holeRadius * Math.sin(calloutRad) };
    dimensionsLayer.add(new Callout(calloutPoint, "4X ⌀8.00 THRU", { angleDeg: calloutAngle }));

    // call out the top-left corner's right angle, tucked in tight to stay clear of the mounting hole
    const topLeftCorner = { x: plateX, y: plateY + plateHeight };
    dimensionsLayer.add(
      new AngularDimension(topLeftCorner, { x: topLeftCorner.x, y: topLeftCorner.y - 5 }, { x: topLeftCorner.x + 5, y: topLeftCorner.y }, {
        radius: 9,
      }),
    );

    // GD&T: tag the plate's top edge as datum A, then call out true position on the hole pattern
    dimensionsLayer.add(new DatumFeatureSymbol({ x: plateX + plateWidth / 2, y: plateY + plateHeight }, "A", { angleDeg: 90 }));
    dimensionsLayer.add(
      new FeatureControlFrame({ x: 200, y: 112 }, "position", 0.1, { diameter: true, modifier: "MMC", datums: [{ letter: "A" }] }),
    );

    // section-lining swatch: a hatched rectangle with an unhatched hole (even-odd fill), off to the side
    const swatchOuter = rectangle(20, 60, 25, 20);
    const swatchHole = circle(32, 70, 5);
    for (const line of hatch([swatchOuter, swatchHole], { angleDeg: 45, spacingMM: 2 })) addGeometry(line);
    addGeometry(new DrawingElement(swatchOuter));
    addGeometry(new DrawingElement(swatchHole));

    sheet.add(geometryLayer);
    sheet.add(dimensionsLayer);
    sheet.add(constructionLayer);

    // revision history, tucked into the top-right corner, referencing the zoned border's grid
    sheet.add(
      new RevisionTable(
        { x: sheet.widthMM - sheet.marginMM - 90, y: sheet.heightMM - sheet.marginMM - 2 },
        [
          { rev: "B", description: "Revised hole pattern per ECO-1234", date: "2026-07-08", approved: "J. DOE", zone: "B2" },
          { rev: "A", description: "Initial release", date: "2026-05-01", approved: "J. DOE" },
        ],
        { columns: ["zone", "rev", "description", "date", "approved"] },
      ),
    );

    return sheet;
  });

  // Sheet 2: a detail view of the hidden back-face pocket, called out on sheet 1's title block scale.
  set.add(({ sheetLabel }) => {
    const sheet = new Sheet({ orientation: "landscape", borderStyle: "zoned" });
    sheet.setTitleBlock(
      new TitleBlock({
        title: `${TITLE} - POCKET DETAIL`,
        drawingNumber: DRAWING_NUMBER,
        revision: REVISION,
        scale: "2:1",
        sheet: sheetLabel,
        material: "AL 6061-T6",
        finish: "ANODIZE, CLEAR",
        drawnBy: DRAWN_BY,
        drawnDate: DRAWN_DATE,
      }),
    );

    const area = sheet.drawingArea;
    const detailScale = 2;
    const detailWidth = pocketWidth * detailScale;
    const detailHeight = pocketHeight * detailScale;
    const detailX = area.x + (area.width - detailWidth) / 2;
    const detailY = area.y + (area.height - detailHeight) / 2;
    const pocketDepth = 3;

    sheet.add(new DrawingElement(rectangle(detailX, detailY, detailWidth, detailHeight)));
    sheet.add(
      new LinearDimension({ x: detailX, y: detailY }, { x: detailX + detailWidth, y: detailY }, {
        offset: -12,
        orientation: "horizontal",
        text: `${pocketWidth.toFixed(2)}`,
      }),
    );
    sheet.add(
      new LinearDimension({ x: detailX, y: detailY }, { x: detailX, y: detailY + detailHeight }, {
        offset: -12,
        orientation: "vertical",
        text: `${pocketHeight.toFixed(2)}`,
      }),
    );
    // plain depth callout (no counterbore/countersink here, so a bare HoleCallout-style leader
    // isn't quite right for this rectangular pocket — same "X {depth} DEEP" wording HoleCallout uses)
    sheet.add(new Callout({ x: detailX + detailWidth / 2, y: detailY + detailHeight }, `X ${pocketDepth.toFixed(2)} DEEP`, { angleDeg: 60 }));

    // one of the mounting holes, at the same detail scale, showing a counterbore for a socket-head cap screw
    const holeDetailCenter = { x: detailX + detailWidth / 2, y: detailY + detailHeight + 45 };
    const holeDetailRadius = holeRadius * detailScale;
    sheet.add(new DrawingElement(circle(holeDetailCenter.x, holeDetailCenter.y, holeDetailRadius)));
    for (const mark of centerMark(holeDetailCenter, holeDetailRadius, 3)) sheet.add(new DrawingElement(mark, { lineStyle: "centerline" }));
    sheet.add(new Callout(holeDetailCenter, `⌀${(holeDetailRadius * 2).toFixed(0)} THRU, ⌴⌀14 X 5 DEEP`, { angleDeg: 40 }));

    return sheet;
  });

  return { set, geometryElements };
}

// Only write output files when this module is run directly (`npm run example`), not when
// `buildBasicSheetExample` is imported elsewhere (e.g. the visual-regression test suite).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { set, geometryElements } = buildBasicSheetExample();
  const sheets = set.build();

  const [overviewSvg, detailSvg] = sheets.map((s) => s.toSVG());
  writeFileSync(new URL("./basic-sheet.svg", import.meta.url), overviewSvg!);
  writeFileSync(new URL("./basic-sheet-detail.svg", import.meta.url), detailSvg!);
  console.log("Wrote examples/basic-sheet.svg and examples/basic-sheet-detail.svg");

  // DXF export covers geometry + layers only (no text, dimensions, or title blocks — see the
  // README), so this demo exports just sheet 1's geometry layer (plate outline, pocket, holes,
  // centerlines, hatch swatch).
  const dxf = exportDXF(geometryElements);
  writeFileSync(new URL("./basic-sheet.dxf", import.meta.url), dxf);
  console.log("Wrote examples/basic-sheet.dxf");

  // PDF export covers the whole sheet — border, title block, dimensions, GD&T, hatching,
  // everything — since it works by converting the same SVG markup rendered above, not by
  // re-deriving CAD-native entities the way DXF must.
  writeFileSync(new URL("./basic-sheet.pdf", import.meta.url), exportPDF(sheets[0]!));
  writeFileSync(new URL("./basic-sheet-detail.pdf", import.meta.url), exportPDF(sheets[1]!));
  console.log("Wrote examples/basic-sheet.pdf and examples/basic-sheet-detail.pdf");
}
