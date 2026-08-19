import { describe, expect, it } from "vitest";
import { exportDXF } from "../src/dxf/exportDXF.js";
import { DrawingElement } from "../src/svg/element.js";
import { TextElement } from "../src/svg/text.js";
import { LinearDimension } from "../src/dimension/linearDimension.js";
import { RadialDimension, DiameterDimension } from "../src/dimension/radialDimension.js";
import { AngularDimension } from "../src/dimension/angularDimension.js";
import { OrdinateDimension } from "../src/dimension/ordinateDimension.js";
import { Path } from "../src/geometry/path.js";
import { rectangle, circle } from "../src/geometry/shapes.js";
import { Block } from "../src/svg/block.js";
import { FeatureControlFrame, CompositeFeatureControlFrame } from "../src/gdt/featureControlFrame.js";
import { DatumFeatureSymbol } from "../src/gdt/datumFeatureSymbol.js";
import { DatumTargetSymbol } from "../src/gdt/datumTarget.js";
import { TitleBlock } from "../src/titleblock/titleBlock.js";
import { BOMTable } from "../src/titleblock/bomTable.js";
import { RevisionTable } from "../src/titleblock/revisionTable.js";
import { Callout } from "../src/dimension/callout.js";
import { MultiLeader } from "../src/dimension/multiLeader.js";
import { DetailViewCallout } from "../src/annotation/detailViewCallout.js";
import { ItemBalloon } from "../src/annotation/itemBalloon.js";
import { RevisionSymbol } from "../src/annotation/revisionCloud.js";

function section(dxf: string, name: string): string {
  const start = dxf.indexOf(`2\n${name}\n`);
  expect(start, `expected a ${name} section`).toBeGreaterThanOrEqual(0);
  const end = dxf.indexOf("0\nENDSEC\n", start);
  return dxf.slice(start, end);
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("exportDXF", () => {
  it("produces a minimal valid empty file with no entities", () => {
    const dxf = exportDXF([]);
    expect(dxf).toContain("0\nSECTION\n2\nHEADER\n");
    expect(dxf).toContain("9\n$INSUNITS\n70\n4\n");
    expect(dxf.trim().endsWith("0\nEOF")).toBe(true);
    expect(countOccurrences(dxf, "0\nPOLYLINE\n")).toBe(0);
  });

  it("puts a default (visible) element on the VISIBLE layer as a closed POLYLINE", () => {
    const dxf = exportDXF([new DrawingElement(rectangle(0, 0, 10, 5))]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("0\nPOLYLINE\n8\nVISIBLE\n");
    expect(entities).toContain("70\n1\n"); // closed
    expect(countOccurrences(entities, "0\nVERTEX\n")).toBe(4);
    expect(entities).toContain("0\nSEQEND\n");
  });

  it("maps hidden/centerline/phantom lineStyles to their DXF layer and linetype", () => {
    const dxf = exportDXF([
      { element: new DrawingElement(rectangle(0, 0, 10, 5), { lineStyle: "hidden" }) },
      new DrawingElement(rectangle(0, 0, 10, 5), { lineStyle: "centerline" }),
      new DrawingElement(rectangle(0, 0, 10, 5), { lineStyle: "phantom" }),
    ]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("0\nPOLYLINE\n8\nHIDDEN\n");
    expect(entities).toContain("0\nPOLYLINE\n8\nCENTER\n");
    expect(entities).toContain("0\nPOLYLINE\n8\nPHANTOM\n");

    const layers = section(dxf, "TABLES");
    expect(layers).toContain("0\nLAYER\n2\nHIDDEN\n");
    expect(layers).toContain("6\nHIDDEN\n");
    expect(layers).toContain("0\nLAYER\n2\nCENTER\n");
    expect(layers).toContain("6\nCENTER\n");
    expect(layers).toContain("0\nLAYER\n2\nPHANTOM\n");
    expect(layers).toContain("6\nPHANTOM\n");
  });

  it("only defines LTYPE entries for linetypes actually used", () => {
    const dxf = exportDXF([new DrawingElement(rectangle(0, 0, 10, 5), { lineStyle: "hidden" })]);
    const tables = section(dxf, "TABLES");
    expect(tables).toContain("0\nLTYPE\n2\nHIDDEN\n");
    expect(tables).not.toContain("2\nCENTER\n");
    expect(tables).not.toContain("2\nPHANTOM\n");
  });

  it("builds the HIDDEN linetype pattern from LINE_STYLES' dasharray: total length 4.5, 2 segments", () => {
    const dxf = exportDXF([new DrawingElement(rectangle(0, 0, 10, 5), { lineStyle: "hidden" })]);
    const tables = section(dxf, "TABLES");
    expect(tables).toContain("73\n2\n"); // segment count
    expect(tables).toContain("40\n4.500000\n"); // total pattern length (3 + 1.5)
  });

  it("honors an explicit layer/linetype/colorIndex override, independent of lineStyle", () => {
    const dxf = exportDXF([{ element: new DrawingElement(rectangle(0, 0, 5, 5)), layer: "HATCH", linetype: "CONTINUOUS", colorIndex: 4 }]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("0\nPOLYLINE\n8\nHATCH\n62\n4\n");
    const tables = section(dxf, "TABLES");
    expect(tables).toContain("0\nLAYER\n2\nHATCH\n70\n0\n62\n4\n6\nCONTINUOUS\n");
  });

  it("emits bulge 1.0 per vertex for a circle, and no bulge tag for straight segments", () => {
    const dxf = exportDXF([new DrawingElement(circle(0, 0, 5))]);
    const entities = section(dxf, "ENTITIES");
    expect(countOccurrences(entities, "42\n1.000000\n")).toBe(2);

    const straight = section(exportDXF([new DrawingElement(rectangle(0, 0, 10, 5))]), "ENTITIES");
    expect(straight).not.toContain("42\n");
  });

  it("marks an open path's POLYLINE as not closed", () => {
    const path = new Path().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10);
    const dxf = exportDXF([new DrawingElement(path)]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("70\n0\n");
  });

  it("skips a degenerate (empty) path without emitting an entity", () => {
    const dxf = exportDXF([new DrawingElement(new Path())]);
    expect(countOccurrences(dxf, "0\nPOLYLINE\n")).toBe(0);
  });

  it("exports a TextElement as a TEXT entity on the TEXT layer, with a STANDARD style table", () => {
    const dxf = exportDXF([new TextElement({ x: 5, y: 10 }, "PART A", { size: 2.5 })]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("0\nTEXT\n8\nTEXT\n");
    expect(entities).toContain("10\n5.000000\n");
    expect(entities).toContain("20\n10.000000\n");
    expect(entities).toContain("40\n2.500000\n");
    expect(entities).toContain("1\nPART A\n");
    const tables = section(dxf, "TABLES");
    expect(tables).toContain("0\nSTYLE\n2\nSTANDARD\n");
    expect(tables).toContain("0\nLAYER\n2\nTEXT\n");
  });

  it("maps text anchor/baseline to DXF justification codes with an alignment point", () => {
    const centered = section(exportDXF([new TextElement({ x: 0, y: 0 }, "C", { anchor: "middle" })]), "ENTITIES");
    expect(centered).toContain("72\n1\n");
    expect(centered).toContain("11\n0.000000\n"); // second alignment point required when justified

    const right = section(exportDXF([new TextElement({ x: 0, y: 0 }, "R", { anchor: "end" })]), "ENTITIES");
    expect(right).toContain("72\n2\n");

    const middleV = section(exportDXF([new TextElement({ x: 0, y: 0 }, "M", { baseline: "middle" })]), "ENTITIES");
    expect(middleV).toContain("73\n2\n");
  });

  it("left/baseline text omits justification codes (plain insertion at 10/20)", () => {
    const entities = section(exportDXF([new TextElement({ x: 1, y: 2 }, "L")]), "ENTITIES");
    expect(entities).not.toContain("72\n");
    expect(entities).not.toContain("11\n");
  });

  it("honors a DXFTextInput layer/color override", () => {
    const dxf = exportDXF([{ text: new TextElement({ x: 0, y: 0 }, "N1"), layer: "NOTES", colorIndex: 2 }]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("0\nTEXT\n8\nNOTES\n62\n2\n");
    expect(section(dxf, "TABLES")).toContain("0\nLAYER\n2\nNOTES\n");
  });

  it("splits hard newlines into separate TEXT entities without injecting a raw entity", () => {
    const entities = section(exportDXF([new TextElement({ x: 0, y: 0 }, "A\n0\nLINE")]), "ENTITIES");
    expect(countOccurrences(entities, "0\nTEXT\n")).toBe(3); // one TEXT per line
    expect(entities).toContain("1\nA\n");
    expect(entities).toContain("1\n0\n"); // "0" is line content, not an injected group-code
    expect(entities).toContain("1\nLINE\n"); // "LINE" is line content, not an injected LINE entity
    expect(countOccurrences(entities, "0\nLINE\n")).toBe(0); // no bare LINE entity injected
  });

  it("still strips control characters (e.g. a tab) within a line", () => {
    const entities = section(exportDXF([new TextElement({ x: 0, y: 0 }, "A\tB")]), "ENTITIES");
    expect(entities).toContain("1\nAB\n"); // tab removed, no line split
    expect(countOccurrences(entities, "0\nTEXT\n")).toBe(1);
  });

  it("omits the STYLE table when there is no text", () => {
    const dxf = exportDXF([new DrawingElement(rectangle(0, 0, 5, 5))]);
    expect(dxf).not.toContain("2\nSTYLE\n");
  });

  it("exports geometry and text together", () => {
    const dxf = exportDXF([new DrawingElement(rectangle(0, 0, 10, 5)), new TextElement({ x: 5, y: 2 }, "LBL")]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("0\nPOLYLINE\n");
    expect(entities).toContain("0\nTEXT\n");
  });
});

describe("exportDXF — native DIMENSION entities", () => {
  const horiz = new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -12, orientation: "horizontal", tolerance: 0.1 });

  it("emits a DIMENSION entity (on a DIMENSIONS layer) referencing an anonymous block, with the value text", () => {
    const dxf = exportDXF([horiz]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("0\nDIMENSION\n8\nDIMENSIONS\n2\n*D1\n");
    expect(entities).toContain("1\n80.00 ±0.10\n"); // value + tolerance in the DIMENSION text
    expect(entities).toContain("3\nSTANDARD\n"); // references the STANDARD dimstyle
    expect(entities).toContain("70\n0\n"); // dimtype 0 (rotated/horizontal)
  });

  it("emits a BLOCKS section whose block holds the dimension picture (lines, SOLID arrows, TEXT)", () => {
    const dxf = exportDXF([horiz]);
    const blocks = section(dxf, "BLOCKS");
    expect(blocks).toContain("0\nBLOCK\n8\nDIMENSIONS\n2\n*D1\n");
    expect(blocks).toContain("0\nLINE\n"); // extension + dimension lines
    expect(blocks).toContain("0\nSOLID\n"); // arrowheads
    expect(blocks).toContain("0\nTEXT\n"); // value text
    expect(blocks).toContain("0\nENDBLK\n");
  });

  it("emits a STANDARD DIMSTYLE table and the DIMENSIONS layer", () => {
    const dxf = exportDXF([horiz]);
    const tables = section(dxf, "TABLES");
    expect(tables).toContain("0\nDIMSTYLE\n2\nSTANDARD\n");
    expect(tables).toContain("0\nLAYER\n2\nDIMENSIONS\n");
  });

  it("marks an aligned dimension as dimtype 1", () => {
    const aligned = new LinearDimension({ x: 0, y: 0 }, { x: 30, y: 20 }, { offset: 10 }); // default orientation = aligned
    const entities = section(exportDXF([aligned]), "ENTITIES");
    expect(entities).toContain("0\nDIMENSION\n");
    expect(entities).toContain("70\n1\n");
  });

  it("numbers multiple dimension blocks *D1, *D2 and matches each entity to its block", () => {
    const dxf = exportDXF([
      horiz,
      new LinearDimension({ x: 0, y: 0 }, { x: 0, y: 50 }, { offset: -12, orientation: "vertical" }),
    ]);
    const blocks = section(dxf, "BLOCKS");
    expect(blocks).toContain("2\n*D1\n");
    expect(blocks).toContain("2\n*D2\n");
    const entities = section(dxf, "ENTITIES");
    expect(countOccurrences(entities, "0\nDIMENSION\n")).toBe(2);
    expect(entities).toContain("2\n*D2\n");
  });

  it("omits BLOCKS and DIMSTYLE when there are no dimensions", () => {
    const dxf = exportDXF([new DrawingElement(rectangle(0, 0, 5, 5))]);
    expect(dxf).not.toContain("2\nBLOCKS\n");
    expect(dxf).not.toContain("2\nDIMSTYLE\n");
  });
});

describe("exportDXF — radial/diameter/angular/ordinate DIMENSION entities", () => {
  it("radius → dimtype 4 with an R value and an arrowhead SOLID in its block", () => {
    const dxf = exportDXF([new RadialDimension({ x: 0, y: 0 }, 4, { angleDeg: 45 })]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("0\nDIMENSION\n8\nDIMENSIONS\n2\n*D1\n");
    expect(entities).toContain("70\n4\n");
    expect(entities).toContain("1\nR4.00\n");
    expect(section(dxf, "BLOCKS")).toContain("0\nSOLID\n"); // the leader arrowhead
    expect(dxf).toContain("2\nDIMSTYLE\n"); // a lone radial dim still emits the style table
  });

  it("diameter → dimtype 3 with a ⌀ value", () => {
    const dxf = exportDXF([new DiameterDimension({ x: 0, y: 0 }, 5, { angleDeg: 30 })]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("70\n3\n");
    expect(entities).toContain("1\n⌀10.00\n");
  });

  it("angular → dimtype 2 with a degree value and ARC entities in its block", () => {
    const dxf = exportDXF([new AngularDimension({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }, { radius: 8 })]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("70\n2\n");
    expect(entities).toContain("1\n90.00°\n");
    expect(countOccurrences(section(dxf, "BLOCKS"), "0\nARC\n")).toBe(2); // the text-broken dimension arc
  });

  it("ordinate → dimtype 6 (X-datum sets bit 64), value text, no arrowhead", () => {
    const x = exportDXF([new OrdinateDimension({ x: 0, y: 0 }, { x: 25, y: 10 }, { axis: "x", offset: 12 })]);
    expect(section(x, "ENTITIES")).toContain("70\n70\n"); // 6 | 64 (X-datum)
    expect(section(x, "ENTITIES")).toContain("1\n25.00\n");
    expect(section(x, "BLOCKS")).not.toContain("0\nSOLID\n"); // ordinate dimensions are arrowless

    const y = exportDXF([new OrdinateDimension({ x: 0, y: 0 }, { x: 10, y: 40 }, { axis: "y", offset: 12 })]);
    expect(section(y, "ENTITIES")).toContain("70\n6\n"); // Y-datum, no bit 64
  });

  it("numbers mixed dimension kinds *D1../*D2.. in order, one block each", () => {
    const dxf = exportDXF([
      new LinearDimension({ x: 0, y: 0 }, { x: 80, y: 0 }, { offset: -12, orientation: "horizontal" }),
      new RadialDimension({ x: 0, y: 0 }, 4, { angleDeg: 45 }),
    ]);
    const blocks = section(dxf, "BLOCKS");
    expect(blocks).toContain("2\n*D1\n");
    expect(blocks).toContain("2\n*D2\n");
    expect(countOccurrences(section(dxf, "ENTITIES"), "0\nDIMENSION\n")).toBe(2);
  });
});

describe("exportDXF — Block/INSERT", () => {
  const bolt = new Block("BOLT").add(new DrawingElement(circle(0, 0, 5))).add(new TextElement({ x: 0, y: 0 }, "M6", { size: 2 }));

  it("writes a named BLOCK definition (children on layer 0) and an INSERT for a placement", () => {
    const dxf = exportDXF([bolt.instance({ position: { x: 10, y: 20 } })]);
    const blocks = section(dxf, "BLOCKS");
    expect(blocks).toContain("0\nBLOCK\n8\n0\n2\nBOLT\n");
    expect(blocks).toContain("0\nPOLYLINE\n"); // the circle
    expect(blocks).toContain("0\nTEXT\n"); // the label
    expect(blocks).toContain("1\nM6\n");
    expect(blocks).toContain("0\nENDBLK\n");

    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("0\nINSERT\n8\n0\n2\nBOLT\n10\n10.000000\n20\n20.000000\n");
  });

  it("emits scale (41/42/43) and rotation (50) only when non-default", () => {
    const scaledRot = section(exportDXF([bolt.instance({ position: { x: 0, y: 0 }, scale: 2, rotationDeg: 90 })]), "ENTITIES");
    expect(scaledRot).toContain("41\n2.000000\n");
    expect(scaledRot).toContain("42\n2.000000\n");
    expect(scaledRot).toContain("43\n2.000000\n");
    expect(scaledRot).toContain("50\n90.000000\n");

    const plain = section(exportDXF([bolt.instance({ position: { x: 0, y: 0 } })]), "ENTITIES");
    expect(plain).not.toContain("41\n");
    expect(plain).not.toContain("50\n");
  });

  it("defines a shared block once even when placed several times", () => {
    const dxf = exportDXF([bolt.instance({ position: { x: 0, y: 0 } }), bolt.instance({ position: { x: 30, y: 0 } }), bolt.instance({ position: { x: 60, y: 0 } })]);
    const blocks = section(dxf, "BLOCKS");
    expect(countOccurrences(blocks, "0\nBLOCK\n")).toBe(1);
    const entities = section(dxf, "ENTITIES");
    expect(countOccurrences(entities, "0\nINSERT\n")).toBe(3);
  });

  it("disambiguates distinct blocks that share a name", () => {
    const a = new Block("SYM").add(new DrawingElement(circle(0, 0, 1)));
    const b = new Block("SYM").add(new DrawingElement(rectangle(0, 0, 2, 2)));
    const blocks = section(exportDXF([a.instance(), b.instance()]), "BLOCKS");
    expect(blocks).toContain("2\nSYM\n");
    expect(blocks).toContain("2\nSYM_2\n");
  });

  it("names an unnamed block BLOCK1", () => {
    const anon = new Block().add(new DrawingElement(circle(0, 0, 1)));
    const blocks = section(exportDXF([anon.instance()]), "BLOCKS");
    expect(blocks).toContain("2\nBLOCK1\n");
  });

  it("registers layer 0 for block content, and keeps geometry-inside-a-block layers in the table", () => {
    const withHidden = new Block("HB").add(new DrawingElement(rectangle(0, 0, 4, 4), { lineStyle: "hidden" }));
    const tables = section(exportDXF([withHidden.instance()]), "TABLES");
    expect(tables).toContain("0\nLAYER\n2\n0\n"); // INSERT/BLOCK sit on layer 0
    expect(tables).toContain("0\nLAYER\n2\nHIDDEN\n"); // the block's own geometry layer
  });

  it("puts a top-level element and a block placement in the same file", () => {
    const dxf = exportDXF([bolt.instance({ position: { x: 10, y: 10 } }), new DrawingElement(rectangle(0, 0, 100, 60))]);
    const entities = section(dxf, "ENTITIES");
    expect(entities).toContain("0\nINSERT\n");
    expect(entities).toContain("0\nPOLYLINE\n8\nVISIBLE\n");
  });

  describe("GD&T annotations", () => {
    it("explodes a feature control frame into POLYLINE/TEXT on the GDT layer", () => {
      const fcf = new FeatureControlFrame({ x: 5, y: 5 }, "position", 0.5, { diameter: true, datums: [{ letter: "A" }, { letter: "B" }] });
      const dxf = exportDXF([fcf]);
      const entities = section(dxf, "ENTITIES");
      // box + two column dividers (symbol|tol, tol|A, A|B) + the position symbol's circle & crosshairs
      expect(countOccurrences(entities, "0\nPOLYLINE\n8\nGDT\n")).toBeGreaterThan(0);
      // the tolerance value and the two datum letters land as TEXT on GDT
      expect(entities).toContain("0\nTEXT\n8\nGDT\n");
      expect(entities).toContain("1\n⌀0.50\n");
      expect(entities).toContain("1\nA\n");
      expect(entities).toContain("1\nB\n");
      // and GDT is a registered layer
      expect(section(dxf, "TABLES")).toContain("0\nLAYER\n2\nGDT\n");
    });

    it("emits no native DIMENSION entity for a frame (it's exploded, not a DIMENSION)", () => {
      const fcf = new FeatureControlFrame({ x: 0, y: 0 }, "flatness", 0.1);
      const dxf = exportDXF([fcf]);
      expect(countOccurrences(dxf, "0\nDIMENSION\n")).toBe(0);
    });

    it("carries a material-condition modifier through as its circled letter's TEXT", () => {
      const fcf = new FeatureControlFrame({ x: 0, y: 0 }, "position", 0.25, { modifier: "MMC" });
      const entities = section(exportDXF([fcf]), "ENTITIES");
      expect(entities).toContain("1\nM\n"); // the circled Ⓜ becomes an "M" TEXT inside a circle POLYLINE
    });

    it("honors a layer and color override via DXFGdtInput", () => {
      const dfs = new DatumFeatureSymbol({ x: 0, y: 0 }, "A", { angleDeg: 90 });
      const dxf = exportDXF([{ gdt: dfs, layer: "MY GDT", colorIndex: 3 }]);
      const entities = section(dxf, "ENTITIES");
      expect(entities).toContain("0\nTEXT\n8\nMY GDT\n"); // newline-sanitized layer name is used verbatim otherwise
      expect(entities).toContain("62\n3\n"); // overridden color on the exploded pieces
      expect(section(dxf, "TABLES")).toContain("0\nLAYER\n2\nMY GDT\n");
    });

    it("explodes composite frames and datum target symbols too", () => {
      const comp = new CompositeFeatureControlFrame({ x: 0, y: 0 }, "position", [
        { toleranceValue: 0.5, diameter: true, datums: [{ letter: "A" }, { letter: "B" }, { letter: "C" }] },
        { toleranceValue: 0.1, diameter: true, datums: [{ letter: "A" }] },
      ]);
      const target = new DatumTargetSymbol({ x: 0, y: 0 }, "A", 1, { angleDeg: 45, areaSize: 6 });
      const entities = section(exportDXF([comp, target]), "ENTITIES");
      expect(entities).toContain("0\nPOLYLINE\n8\nGDT\n");
      expect(entities).toContain("1\nA1\n"); // datum target lower label (letter + number)
      expect(entities).toContain("1\n⌀6.00\n"); // datum target area size
    });
  });

  describe("title blocks and tables", () => {
    const sheetCtx = { sheetWidthMM: 297, marginMM: 10, paperSizeLabel: "A3" };

    it("explodes a title block into POLYLINE/TEXT on the TITLEBLOCK layer", () => {
      const tb = new TitleBlock({ title: "WIDGET", drawingNumber: "D-100", revision: "B", scale: "1:1", sheet: "1 OF 1" });
      const dxf = exportDXF([{ titleBlock: tb, context: sheetCtx }]);
      const entities = section(dxf, "ENTITIES");
      expect(entities).toContain("0\nPOLYLINE\n8\nTITLEBLOCK\n");
      expect(entities).toContain("0\nTEXT\n8\nTITLEBLOCK\n");
      expect(entities).toContain("1\nWIDGET\n"); // the title value
      expect(entities).toContain("1\nD-100\n"); // the drawing number
      expect(section(dxf, "TABLES")).toContain("0\nLAYER\n2\nTITLEBLOCK\n");
    });

    it("fills the SIZE field from the sheet context's paperSizeLabel when unset", () => {
      const tb = new TitleBlock({ title: "X", drawingNumber: "Y" });
      const entities = section(exportDXF([{ titleBlock: tb, context: sheetCtx }]), "ENTITIES");
      expect(entities).toContain("1\nA3\n"); // paperSizeLabel fell through to the SIZE cell
    });

    it("honors a layer and color override for a title block", () => {
      const tb = new TitleBlock({ title: "X", drawingNumber: "Y" });
      const dxf = exportDXF([{ titleBlock: tb, context: sheetCtx, layer: "FRAME", colorIndex: 5 }]);
      const entities = section(dxf, "ENTITIES");
      expect(entities).toContain("0\nPOLYLINE\n8\nFRAME\n");
      expect(entities).toContain("62\n5\n");
    });

    it("throws a clear error for a title block that only implements render()", () => {
      const renderOnly = { heightMM: 20, render: () => "<g/>" };
      expect(() => exportDXF([{ titleBlock: renderOnly, context: sheetCtx }])).toThrow(/does not support DXF export/);
    });

    it("explodes a bare BOM table onto the TITLEBLOCK layer", () => {
      const bom = new BOMTable({ x: 20, y: 120 }, [{ item: "1", quantity: "2", partNumber: "P-1", description: "Bracket" }], {
        columns: ["item", "quantity", "partNumber", "description"],
      });
      const entities = section(exportDXF([bom]), "ENTITIES");
      expect(entities).toContain("0\nPOLYLINE\n8\nTITLEBLOCK\n");
      expect(entities).toContain("1\nP-1\n");
      expect(entities).toContain("1\nBracket\n");
    });

    it("explodes a bare revision table onto the TITLEBLOCK layer", () => {
      const rev = new RevisionTable({ x: 20, y: 200 }, [{ rev: "A", description: "Initial release", date: "2026-01-01", approved: "AB" }]);
      const entities = section(exportDXF([rev]), "ENTITIES");
      expect(entities).toContain("0\nPOLYLINE\n8\nTITLEBLOCK\n");
      expect(entities).toContain("1\nInitial release\n");
    });
  });

  describe("callouts and leaders", () => {
    it("explodes a generic callout onto the ANNOTATIONS layer (leader lines + arrow + text)", () => {
      const dxf = exportDXF([new Callout({ x: 0, y: 0 }, "TYP 4X", { angleDeg: 45 })]);
      const entities = section(dxf, "ENTITIES");
      expect(entities).toContain("0\nPOLYLINE\n8\nANNOTATIONS\n"); // leader/arrow geometry
      expect(entities).toContain("0\nTEXT\n8\nANNOTATIONS\n");
      expect(entities).toContain("1\nTYP 4X\n");
      expect(section(dxf, "TABLES")).toContain("0\nLAYER\n2\nANNOTATIONS\n");
    });

    it("explodes a multileader (one leader per target) and a detail-view callout", () => {
      const ml = new MultiLeader([{ x: 0, y: 0 }, { x: 5, y: 2 }], "4X", { landing: { x: 20, y: 20 } });
      const detail = new DetailViewCallout({ x: 0, y: 0 }, 10, { angleDeg: 45, label: "A" });
      const entities = section(exportDXF([ml, detail]), "ENTITIES");
      expect(entities).toContain("1\n4X\n");
      expect(entities).toContain("1\nDETAIL A\n");
      // two multileader targets → at least two leader polylines on ANNOTATIONS
      expect(countOccurrences(entities, "0\nPOLYLINE\n8\nANNOTATIONS\n")).toBeGreaterThanOrEqual(2);
    });
  });

  describe("symbols and tags", () => {
    it("explodes item balloons and revision symbols onto ANNOTATIONS", () => {
      const balloon = new ItemBalloon({ x: 0, y: 0 }, 7, { angleDeg: 45 });
      const rev = new RevisionSymbol({ x: 40, y: 0 }, "B", { shape: "triangle" });
      const entities = section(exportDXF([balloon, rev]), "ENTITIES");
      expect(entities).toContain("1\n7\n"); // balloon item number
      expect(entities).toContain("1\nB\n"); // revision letter
      expect(countOccurrences(entities, "0\nPOLYLINE\n8\nANNOTATIONS\n")).toBeGreaterThanOrEqual(2);
    });
  });
});
