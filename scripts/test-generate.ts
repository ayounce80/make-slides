/**
 * Test PPTX generation from slides.json
 *
 * Usage: npx tsx scripts/test-generate.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import converter
import { convertPresentation } from './convert-slides-json.js';

// Import renderer
import { renderPptx } from '../src/renderers/pptx.js';
import { generateExportReport, formatReport } from '../src/utils/report.js';

async function main() {
  // Generate timestamp for versioned outputs
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runsDir = path.join(__dirname, '../data/z-ai-research/runs');
  const runDir = path.join(runsDir, timestamp);

  // Create runs directory structure
  if (!fs.existsSync(runsDir)) {
    fs.mkdirSync(runsDir, { recursive: true });
  }
  fs.mkdirSync(runDir, { recursive: true });

  const inputPath = path.join(__dirname, '../data/z-ai-research/slides.json');
  const outputPath = path.join(runDir, 'output.pptx');
  const reportPath = path.join(runDir, 'report.txt');
  const schemaPath = path.join(runDir, 'schema.json');

  // Also create a "latest" symlink for convenience
  const latestLink = path.join(runsDir, 'latest');
  try {
    if (fs.existsSync(latestLink)) {
      fs.unlinkSync(latestLink);
    }
    fs.symlinkSync(timestamp, latestLink);
  } catch {
    // Symlink may fail on some systems, ignore
  }

  console.log('=== Magic Slides Test Generation ===\n');
  console.log(`Run: ${timestamp}`);
  console.log(`Output: ${runDir}\n`);

  // 1. Load and convert input JSON
  console.log('1. Loading slides.json...');
  const inputJson = fs.readFileSync(inputPath, 'utf-8');
  const input = JSON.parse(inputJson);
  console.log(`   Found ${input.slides.length} slides`);

  // 2. Convert to our schema
  console.log('\n2. Converting to Magic Slides schema...');
  const deck = convertPresentation(input);
  console.log(`   Deck: ${deck.title}`);
  console.log(`   Theme: ${deck.theme.name} (primary: ${deck.theme.colors.primary})`);
  console.log(`   Fonts: ${deck.theme.fonts.heading} / ${deck.theme.fonts.body}`);

  // Save converted schema for reference
  fs.writeFileSync(schemaPath, JSON.stringify(deck, null, 2));
  console.log(`   Schema saved: ${schemaPath}`);

  // Count elements by type
  const elementCounts: Record<string, number> = {};
  for (const slide of deck.slides) {
    for (const el of slide.content.elements) {
      elementCounts[el.type] = (elementCounts[el.type] || 0) + 1;
    }
  }
  console.log('   Element counts:', elementCounts);

  // 3. Generate PPTX
  console.log('\n3. Generating PPTX...');
  const startTime = Date.now();

  try {
    const result = await renderPptx(deck, {
      outputPath,
      embedFonts: false, // Google Slides doesn't use embedded fonts
    });

    const elapsed = Date.now() - startTime;
    console.log(`   Generated in ${elapsed}ms`);
    console.log(`   File: ${outputPath}`);
    console.log(`   Size: ${(result.buffer.length / 1024).toFixed(1)} KB`);
    console.log(`   Slides: ${result.slideCount}`);
    console.log(`   Icons: ${result.iconCount}`);

    // 4. Generate export report
    console.log('\n4. Generating export report...');
    const report = generateExportReport(deck, {
      pptxBuffer: result.buffer,
      iconCacheStats: { hits: result.iconCount, misses: 0 },
    });

    const reportText = formatReport(report);
    fs.writeFileSync(reportPath, reportText);
    console.log(`   Report: ${reportPath}`);

    // Print report summary
    console.log('\n' + reportText);

    // 5. Compare with z.ai reference
    console.log('\n5. Comparison Notes:');
    console.log('   Reference PPTX: data/z-ai-research/colts-reference-pptx/');
    console.log('   - z.ai uses 132 pre-rendered PNG icons');
    console.log('   - Our output uses dynamic icon rendering');
    console.log('   - Check layout alignment in Google Slides');

    console.log('\n=== Done! ===');
    console.log(`Open ${outputPath} in Google Slides to compare with reference.`);

  } catch (error) {
    console.error('Error generating PPTX:', error);
    throw error;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
