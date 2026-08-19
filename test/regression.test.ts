import { describe, expect, it } from "vitest";
import { buildBasicSheetExample } from "../examples/basic-sheet.js";
import {
  ANSI_HATCH_PATTERNS,
  BOMTable,
  cylindricalBreakLine,
  CuttingPlaneLine,
  DatumTargetSymbol,
  datumTargetArea,
  datumTargetLine,
  datumTargetPoint,
  DetailViewCallout,
  DiameterDimension,
  DrawingElement,
  exportDXF,
  exportPDF,
  hatchPattern,
  ISO7200TitleBlock,
  ItemBalloon,
  LinearDimension,
  RadialDimension,
  rectangle,
  revisionCloud,
  RevisionSymbol,
  Sheet,
  TextElement,
  TitleBlock,
  zigzagBreakLine,
} from "../src/index.js";

// Snapshot testing rather than pixel-diffing: this is a plain TypeScript library with no system
// rendering dependency, and different SVG renderers (verified earlier — librsvg vs. ImageMagick)
// draw the same markup slightly differently, which makes pixel baselines an unreliable regression
// signal across machines/CI. A text snapshot of the generated SVG/DXF catches any unintended
// geometric or structural change with a readable diff, with zero added dependencies or flakiness.

describe("visual regression: basic-sheet example", () => {
  const { set, geometryElements } = buildBasicSheetExample();
  const sheets = set.build();
  const [overviewSvg, detailSvg] = sheets.map((s) => s.toSVG());

  it("sheet 1 (overview) SVG output matches its snapshot", () => {
    expect(overviewSvg).toMatchSnapshot();
  });

  it("sheet 2 (pocket detail) SVG output matches its snapshot", () => {
    expect(detailSvg).toMatchSnapshot();
  });

  it("DXF export of sheet 1's geometry layer matches its snapshot", () => {
    expect(exportDXF(geometryElements)).toMatchSnapshot();
  });

  it("PDF export of sheet 1 (whole sheet, not just geometry) matches its snapshot", () => {
    expect(exportPDF(sheets[0]!)).toMatchSnapshot();
  });
});

// Scenarios the basic-sheet example doesn't exercise, so the full library surface stays covered.
describe("visual regression: additional scenarios", () => {
  it("ISO7200TitleBlock on a plain-border sheet matches its snapshot", () => {
    const sheet = new Sheet({ orientation: "landscape" });
    sheet.setTitleBlock(
      new ISO7200TitleBlock({
        title: "SAMPLE PART",
        legalOwner: "INVISRA",
        identificationNumber: "DRW-2000",
        documentType: "DRAWING",
        dateOfIssue: "2026-07-08",
        creator: "S. RICHS",
        approvalPerson: "J. DOE",
        revisionIndex: "A",
        sheet: "1/1",
      }),
    );
    expect(sheet.toSVG()).toMatchSnapshot();
  });

  it("a labeled cutting-plane line matches its snapshot", () => {
    const parts = [
      new CuttingPlaneLine([{ x: 0, y: 20 }, { x: 80, y: 20 }], { viewDirectionDeg: -90, label: "A" }).toSVG(),
      new TextElement({ x: 40, y: -8 }, "SECTION A-A", { size: 4, anchor: "middle", weight: "bold" }).toSVG(),
    ];
    expect(parts.join("\n")).toMatchSnapshot();
  });

  it("the full ANSI31-38 material hatch pattern gallery matches its snapshot", () => {
    const parts: string[] = [];
    for (const pattern of Object.values(ANSI_HATCH_PATTERNS)) {
      const boundary = rectangle(0, 0, 20, 15);
      for (const line of hatchPattern(boundary, pattern)) parts.push(line.toSVG());
      parts.push(new DrawingElement(boundary).toSVG());
    }
    expect(parts.join("\n")).toMatchSnapshot();
  });

  it("a BOM table plus dot/arrow-terminus item balloons matches its snapshot", () => {
    const parts = [
      new BOMTable({ x: 0, y: 30 }, [
        { item: 1, quantity: 1, partNumber: "HSG-100", description: "Housing, main" },
        { item: 2, quantity: 4, partNumber: "MS90725-10", description: "Bolt, hex socket" },
      ]).toSVG(),
      new ItemBalloon({ x: 0, y: 0 }, 1, { angleDeg: 135 }).toSVG(),
      new ItemBalloon({ x: 20, y: 0 }, 2, { angleDeg: 45, terminus: "arrow" }).toSVG(),
    ];
    expect(parts.join("\n")).toMatchSnapshot();
  });

  it("basic (boxed) and reference (parenthesized) dimensions, linear and radial, match their snapshot", () => {
    const parts = [
      new LinearDimension({ x: 0, y: 0 }, { x: 40, y: 0 }, { offset: -10, orientation: "horizontal", basic: true }).toSVG(),
      new LinearDimension({ x: 0, y: 20 }, { x: 40, y: 20 }, { offset: -10, orientation: "horizontal", reference: true }).toSVG(),
      new RadialDimension({ x: 60, y: 0 }, 8, { angleDeg: 30, basic: true }).toSVG(),
      new DiameterDimension({ x: 100, y: 0 }, 8, { angleDeg: 45, reference: true }).toSVG(),
    ];
    expect(parts.join("\n")).toMatchSnapshot();
  });

  it("a detail-view callout and both break-line conventions match their snapshot", () => {
    const parts = [
      new DetailViewCallout({ x: 0, y: 0 }, 8, { angleDeg: 45, label: "A" }).toSVG(),
      zigzagBreakLine({ x: 0, y: 30 }, { x: 40, y: 30 }).toSVG(),
      cylindricalBreakLine({ x: 60, y: 10 }, { x: 60, y: 50 }).toSVG(),
    ];
    expect(parts.join("\n")).toMatchSnapshot();
  });

  it("datum target symbols (point/line/area) match their snapshot", () => {
    const parts = [
      ...datumTargetPoint({ x: 0, y: 0 }).map((e) => e.toSVG()),
      new DatumTargetSymbol({ x: 0, y: 0 }, "A", 1, { angleDeg: -135 }).toSVG(),
      ...datumTargetLine({ x: 30, y: 0 }, { x: 50, y: 0 }).map((e) => e.toSVG()),
      new DatumTargetSymbol({ x: 40, y: 0 }, "A", 2, { angleDeg: -90 }).toSVG(),
      ...datumTargetArea({ x: 90, y: 20 }, 6).map((e) => e.toSVG()),
      new DatumTargetSymbol({ x: 90, y: 20 }, "B", 1, { angleDeg: 45, areaSize: 12, leaderLengthMM: 20 }).toSVG(),
    ];
    expect(parts.join("\n")).toMatchSnapshot();
  });

  it("a revision cloud (rectangular boundary) with a circle and a triangle revision symbol matches its snapshot", () => {
    const parts = [
      revisionCloud(rectangle(0, 0, 40, 30), { arcLengthMM: 8 }).toSVG(),
      new RevisionSymbol({ x: 46, y: 30 }, "A", { shape: "circle" }).toSVG(),
      new RevisionSymbol({ x: 58, y: 30 }, "B", { shape: "triangle" }).toSVG(),
    ];
    expect(parts.join("\n")).toMatchSnapshot();
  });

  it("a title block citing an ISO 2768 general-tolerance note matches its snapshot", () => {
    const sheet = new Sheet({ orientation: "landscape" });
    sheet.setTitleBlock(
      new TitleBlock({
        title: "BRACKET, MOUNTING",
        drawingNumber: "DRW-1000",
        revision: "A",
        scale: "1:1",
        sheet: "1 OF 1",
        material: "AL 6061-T6",
        generalTolerance: ["ISO 2768-mK"],
        projection: "third-angle",
      }),
    );
    expect(sheet.toSVG()).toMatchSnapshot();
  });
});
