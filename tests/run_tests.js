import { generateCrosswordLayouts } from '../src/generator.js';
import { renderSVG } from '../src/svg-renderer.js';
import fs from 'fs';
import path from 'path';

console.log("=== Running Crossword Generator Tests ===");

const namesList = ["Jonathan", "Julie", "Steve", "Samuel"];
console.log("Input Names:", namesList);

const start = Date.now();
const layouts = generateCrosswordLayouts(namesList);
const end = Date.now();

console.log(`Generated ${layouts.length} unique layouts in ${end - start}ms`);

if (layouts.length === 0) {
  console.error("FAIL: No layouts generated!");
  process.exit(1);
}

console.log("PASS: Layout generation successful.");

// Print details of the first layout
const first = layouts[0];
console.log(`Layout 1 Size: ${first.width}x${first.height}, Score: ${first.score.toFixed(2)}`);
console.log("Placed words:");
first.layout.forEach(p => {
  console.log(`  - ${p.word} starting at (${p.row}, ${p.col}) dir ${p.dir}`);
});

// Render test SVG
try {
  const fontPath = './public/font_tiles/Scrabble_english.ttf';
  let fontBase64 = "";
  if (fs.existsSync(fontPath)) {
    fontBase64 = fs.readFileSync(fontPath).toString('base64');
  }

  const testSvg = renderSVG({
    layout: first.layout,
    width: first.width,
    height: first.height,
    title: "Our Family",
    titleFont: "Alex Brush",
    titleSize: 18,
    titleX: 0,
    titleY: 0,
    size: "medium_portrait",
    background: "brown",
    tileStyle: "maple",
    tileFont: "english",
    woodTextures: {
      Scrabble_english: fontBase64
    },
    dividerType: "hearts"
  });

  const testDir = './tests/output';
  if (!fs.existsSync(testDir)){
    fs.mkdirSync(testDir, { recursive: true });
  }
  const outputPath = path.join(testDir, 'test_output.svg');
  fs.writeFileSync(outputPath, testSvg);
  console.log(`PASS: Rendered SVG successfully written to ${outputPath}`);
} catch (err) {
  console.error("FAIL: SVG Rendering crashed!", err);
  process.exit(1);
}

console.log("=== All Tests Passed! ===");
process.exit(0);
