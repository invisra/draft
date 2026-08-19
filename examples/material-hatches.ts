import { writeFileSync } from "node:fs";
import { ANSI_HATCH_PATTERNS, DrawingElement, hatchPattern, rectangle, Sheet, TextElement } from "../src/index.js";

// A reference gallery of the 8 ANSI31-ANSI38 section-lining material patterns (converted from
// AutoCAD's acad.pat) — swatches labeled with the material each pattern conventionally represents.
const sheet = new Sheet({ orientation: "landscape" });
const patterns = Object.values(ANSI_HATCH_PATTERNS);

const columns = 4;
const rows = Math.ceil(patterns.length / columns);
const swatchWidthMM = 50;
const swatchHeightMM = 30;
const gapMM = 15;
const labelClearanceMM = 12; // vertical room below each swatch for its two-line label

const gridWidth = columns * swatchWidthMM + (columns - 1) * gapMM;
const gridHeight = rows * swatchHeightMM + (rows - 1) * gapMM + rows * labelClearanceMM;

const area = sheet.drawingArea;
const startX = area.x + (area.width - gridWidth) / 2;
const topY = area.y + area.height - (area.height - gridHeight) / 2;

patterns.forEach((pattern, i) => {
  const col = i % columns;
  const row = Math.floor(i / columns);
  const x = startX + col * (swatchWidthMM + gapMM);
  const y = topY - swatchHeightMM - row * (swatchHeightMM + labelClearanceMM + gapMM);
  const boundary = rectangle(x, y, swatchWidthMM, swatchHeightMM);

  for (const line of hatchPattern(boundary, pattern)) sheet.add(line);
  sheet.add(new DrawingElement(boundary));
  sheet.add(new TextElement({ x, y: y - 4 }, pattern.name, { size: 3, weight: "bold" }));
  sheet.add(new TextElement({ x, y: y - 7.5 }, pattern.description, { size: 2.4, color: "#555555" }));
});

writeFileSync(new URL("./material-hatches.svg", import.meta.url), sheet.toSVG());
console.log("Wrote examples/material-hatches.svg");
