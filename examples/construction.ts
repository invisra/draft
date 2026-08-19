import { writeFileSync } from "node:fs";
import {
  boltCircle,
  centerMark,
  circle,
  DiameterDimension,
  DrawingElement,
  ellipse,
  offsetPolyline,
  polyline,
  roundedPolyline,
  Sheet,
  TitleBlock,
  type Point,
} from "../src/index.js";

/**
 * Demonstrates the geometry-construction toolkit: a bracket outline whose
 * corners are rounded with `roundedPolyline`, a phantom clearance boundary from
 * `offsetPolyline`, a `boltCircle` hole pattern, and an `ellipse` slot — all
 * computed from a handful of key points rather than placed by hand.
 */
export function buildConstructionExample(): Sheet {
  const sheet = new Sheet({ orientation: "landscape", borderStyle: "plain" });
  sheet.setTitleBlock(
    new TitleBlock({
      title: "BRACKET, GEOMETRY DEMO",
      drawingNumber: "DRW-3000",
      revision: "A",
      scale: "1:1",
      sheet: "1 OF 1",
      drawnBy: "S. RICHS",
      drawnDate: "2026-08-07",
    }),
  );

  const area = sheet.drawingArea;
  const ox = area.x + 40;
  const oy = area.y + 30;

  // an L-shaped bracket profile from its corner points, corners rounded to 6mm
  const profile: Point[] = [
    { x: ox, y: oy },
    { x: ox + 90, y: oy },
    { x: ox + 90, y: oy + 30 },
    { x: ox + 40, y: oy + 30 },
    { x: ox + 40, y: oy + 60 },
    { x: ox, y: oy + 60 },
  ];
  sheet.add(new DrawingElement(roundedPolyline(profile, 6, true)));

  // a phantom clearance boundary, offset 5mm outward from the same profile
  sheet.add(new DrawingElement(polyline(offsetPolyline(profile, -5, true), true), { lineStyle: "phantom" }));

  // a 4-hole bolt circle centered in the lower-left square lobe
  const bcCenter = { x: ox + 20, y: oy + 20 };
  for (const hole of boltCircle(bcCenter, 4, 12, { startAngleDeg: 45 })) {
    sheet.add(new DrawingElement(circle(hole.x, hole.y, 3)));
    for (const mark of centerMark(hole, 3, 2)) sheet.add(new DrawingElement(mark, { lineStyle: "centerline" }));
  }
  sheet.add(new DiameterDimension({ x: bcCenter.x, y: bcCenter.y }, 12, { angleDeg: 90, text: "4X ⌀6.00 ON ⌀24.00 B.C." }));

  // an elliptical slot in the upper arm
  const slot = { x: ox + 20, y: oy + 45 };
  sheet.add(new DrawingElement(ellipse(slot.x, slot.y, 12, 5)));
  for (const mark of centerMark(slot, 12, 3)) sheet.add(new DrawingElement(mark, { lineStyle: "centerline" }));

  return sheet;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL("./construction.svg", import.meta.url), buildConstructionExample().toSVG());
  console.log("Wrote examples/construction.svg");
}
