#!/usr/bin/env npx ts-node
/**
 * Visual PPTX Comparison Tool
 *
 * Converts PPTX slides to images using LibreOffice and compares them
 * pixel-by-pixel using pixelmatch.
 *
 * Usage: npx ts-node scripts/visual-compare.ts <ours.pptx> <reference.pptx> [output-dir]
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

interface SlideComparison {
  slide: number;
  diffPixels: number;
  diffPercent: number;
  totalPixels: number;
  status: 'identical' | 'minor' | 'moderate' | 'major';
}

interface ComparisonReport {
  timestamp: string;
  ourFile: string;
  refFile: string;
  totalSlides: number;
  identicalSlides: number;
  minorDiffSlides: number;
  moderateDiffSlides: number;
  majorDiffSlides: number;
  averageDiffPercent: number;
  slides: SlideComparison[];
}

async function convertPptxToImages(pptxPath: string, outputDir: string): Promise<string[]> {
  const absPath = path.resolve(pptxPath);
  const absOutDir = path.resolve(outputDir);

  // Create output directory
  fs.mkdirSync(absOutDir, { recursive: true });

  console.log(`Converting ${path.basename(pptxPath)} to images...`);

  // Use LibreOffice to convert PPTX to PNG
  // First convert to PDF, then to PNG for better quality
  const pdfPath = path.join(absOutDir, 'slides.pdf');

  try {
    // Convert PPTX to PDF
    execSync(`soffice --headless --convert-to pdf --outdir "${absOutDir}" "${absPath}"`, {
      timeout: 120000,
      stdio: 'pipe'
    });

    // Find the generated PDF (LibreOffice names it after the input file)
    const baseName = path.basename(absPath, '.pptx');
    const generatedPdf = path.join(absOutDir, `${baseName}.pdf`);

    if (!fs.existsSync(generatedPdf)) {
      throw new Error(`PDF not generated at ${generatedPdf}`);
    }

    // Convert PDF pages to PNG using pdftoppm (from poppler-utils)
    execSync(`pdftoppm -png -r 150 "${generatedPdf}" "${path.join(absOutDir, 'slide')}"`, {
      timeout: 120000,
      stdio: 'pipe'
    });

    // Find all generated PNG files
    const pngFiles = fs.readdirSync(absOutDir)
      .filter(f => f.startsWith('slide-') && f.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide-(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/slide-(\d+)/)?.[1] || '0');
        return numA - numB;
      })
      .map(f => path.join(absOutDir, f));

    console.log(`  Generated ${pngFiles.length} slide images`);
    return pngFiles;

  } catch (error: any) {
    console.error(`Error converting PPTX: ${error.message}`);
    throw error;
  }
}

function compareImages(img1Path: string, img2Path: string, diffPath: string): { diffPixels: number; totalPixels: number } {
  const img1 = PNG.sync.read(fs.readFileSync(img1Path));
  const img2 = PNG.sync.read(fs.readFileSync(img2Path));

  // Ensure same dimensions
  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);

  // Create canvases with the larger dimensions
  const canvas1 = new PNG({ width, height });
  const canvas2 = new PNG({ width, height });
  const diff = new PNG({ width, height });

  // Copy images to canvases (centered if smaller)
  img1.data.copy(canvas1.data);
  img2.data.copy(canvas2.data);

  // Compare
  const diffPixels = pixelmatch(
    canvas1.data,
    canvas2.data,
    diff.data,
    width,
    height,
    {
      threshold: 0.1,  // Sensitivity (0 = exact match required, 1 = very lenient)
      includeAA: false, // Don't count anti-aliasing differences
      alpha: 0.1,       // Blend original image into diff
      diffColor: [255, 0, 0],      // Red for different pixels
      diffColorAlt: [0, 255, 0]    // Green for anti-aliased pixels
    }
  );

  // Save diff image
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    diffPixels,
    totalPixels: width * height
  };
}

function getStatus(diffPercent: number): SlideComparison['status'] {
  if (diffPercent === 0) return 'identical';
  if (diffPercent < 1) return 'minor';
  if (diffPercent < 5) return 'moderate';
  return 'major';
}

async function generateHtmlReport(report: ComparisonReport, outputDir: string): Promise<void> {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PPTX Visual Comparison</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 20px; background: #1a1a1a; color: #fff; }
    h1 { color: #fff; }
    .summary { background: #2a2a2a; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20px; text-align: center; }
    .stat { background: #333; padding: 15px; border-radius: 8px; }
    .stat-value { font-size: 2em; font-weight: bold; }
    .stat-label { color: #888; font-size: 0.9em; }
    .identical { color: #4caf50; }
    .minor { color: #ffeb3b; }
    .moderate { color: #ff9800; }
    .major { color: #f44336; }
    .slide-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .slide-card { background: #2a2a2a; border-radius: 8px; overflow: hidden; }
    .slide-header { padding: 10px; display: flex; justify-content: space-between; align-items: center; }
    .slide-images { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 2px; background: #444; }
    .slide-images img { width: 100%; height: auto; display: block; }
    .slide-images .label { text-align: center; font-size: 0.8em; color: #888; padding: 4px; background: #333; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
    .badge.identical { background: #1b5e20; }
    .badge.minor { background: #f9a825; color: #000; }
    .badge.moderate { background: #e65100; }
    .badge.major { background: #b71c1c; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #444; }
  </style>
</head>
<body>
  <h1>PPTX Visual Comparison Report</h1>

  <div class="summary">
    <h2>Summary</h2>
    <div class="summary-grid">
      <div class="stat">
        <div class="stat-value">${report.totalSlides}</div>
        <div class="stat-label">Total Slides</div>
      </div>
      <div class="stat">
        <div class="stat-value identical">${report.identicalSlides}</div>
        <div class="stat-label">Identical</div>
      </div>
      <div class="stat">
        <div class="stat-value minor">${report.minorDiffSlides}</div>
        <div class="stat-label">Minor Diff (&lt;1%)</div>
      </div>
      <div class="stat">
        <div class="stat-value moderate">${report.moderateDiffSlides}</div>
        <div class="stat-label">Moderate (1-5%)</div>
      </div>
      <div class="stat">
        <div class="stat-value major">${report.majorDiffSlides}</div>
        <div class="stat-label">Major (&gt;5%)</div>
      </div>
    </div>
    <p style="margin-top: 15px;">Average difference: <strong>${report.averageDiffPercent.toFixed(2)}%</strong></p>
    <p>Our file: <code>${report.ourFile}</code></p>
    <p>Reference: <code>${report.refFile}</code></p>
  </div>

  <h2>Slide-by-Slide Comparison</h2>

  <table>
    <tr>
      <th>Slide</th>
      <th>Status</th>
      <th>Diff Pixels</th>
      <th>Diff %</th>
    </tr>
    ${report.slides.map(s => `
    <tr>
      <td>Slide ${s.slide}</td>
      <td><span class="badge ${s.status}">${s.status.toUpperCase()}</span></td>
      <td>${s.diffPixels.toLocaleString()}</td>
      <td class="${s.status}">${s.diffPercent.toFixed(2)}%</td>
    </tr>
    `).join('')}
  </table>

  <h2 style="margin-top: 40px;">Visual Diffs</h2>
  <p style="color: #888;">Left: Ours | Center: Diff (red=different) | Right: Z.AI Reference</p>

  <div class="slide-grid">
    ${report.slides.map(s => `
    <div class="slide-card">
      <div class="slide-header">
        <span>Slide ${s.slide}</span>
        <span class="badge ${s.status}">${s.diffPercent.toFixed(1)}%</span>
      </div>
      <div class="slide-images">
        <div>
          <div class="label">Ours</div>
          <img src="ours/slide-${String(s.slide).padStart(2, '0')}.png" loading="lazy" />
        </div>
        <div>
          <div class="label">Diff</div>
          <img src="diff/slide-${String(s.slide).padStart(2, '0')}-diff.png" loading="lazy" />
        </div>
        <div>
          <div class="label">Z.AI</div>
          <img src="ref/slide-${String(s.slide).padStart(2, '0')}.png" loading="lazy" />
        </div>
      </div>
    </div>
    `).join('')}
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, 'report.html'), html);
  console.log(`\nHTML report saved to: ${path.join(outputDir, 'report.html')}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: npx ts-node scripts/visual-compare.ts <ours.pptx> <reference.pptx> [output-dir]');
    process.exit(1);
  }

  const [ourPptx, refPptx, outputDir = 'data/z-ai-research/visual-comparison'] = args;

  // Verify inputs exist
  if (!fs.existsSync(ourPptx)) {
    console.error(`File not found: ${ourPptx}`);
    process.exit(1);
  }
  if (!fs.existsSync(refPptx)) {
    console.error(`File not found: ${refPptx}`);
    process.exit(1);
  }

  // Create output directories
  const oursDir = path.join(outputDir, 'ours');
  const refDir = path.join(outputDir, 'ref');
  const diffDir = path.join(outputDir, 'diff');

  fs.mkdirSync(diffDir, { recursive: true });

  // Convert both PPTX files to images
  const ourImages = await convertPptxToImages(ourPptx, oursDir);
  const refImages = await convertPptxToImages(refPptx, refDir);

  if (ourImages.length !== refImages.length) {
    console.warn(`Warning: Slide count mismatch! Ours: ${ourImages.length}, Reference: ${refImages.length}`);
  }

  // Compare each slide
  const slideCount = Math.min(ourImages.length, refImages.length);
  const comparisons: SlideComparison[] = [];

  console.log('\nComparing slides...');

  for (let i = 0; i < slideCount; i++) {
    const slideNum = i + 1;
    const diffPath = path.join(diffDir, `slide-${String(slideNum).padStart(2, '0')}-diff.png`);

    const result = compareImages(ourImages[i], refImages[i], diffPath);
    const diffPercent = (result.diffPixels / result.totalPixels) * 100;

    comparisons.push({
      slide: slideNum,
      diffPixels: result.diffPixels,
      diffPercent,
      totalPixels: result.totalPixels,
      status: getStatus(diffPercent)
    });

    const statusIcon = diffPercent === 0 ? '✓' : diffPercent < 1 ? '~' : diffPercent < 5 ? '!' : '✗';
    console.log(`  Slide ${slideNum}: ${diffPercent.toFixed(2)}% diff ${statusIcon}`);
  }

  // Generate report
  const report: ComparisonReport = {
    timestamp: new Date().toISOString(),
    ourFile: ourPptx,
    refFile: refPptx,
    totalSlides: slideCount,
    identicalSlides: comparisons.filter(c => c.status === 'identical').length,
    minorDiffSlides: comparisons.filter(c => c.status === 'minor').length,
    moderateDiffSlides: comparisons.filter(c => c.status === 'moderate').length,
    majorDiffSlides: comparisons.filter(c => c.status === 'major').length,
    averageDiffPercent: comparisons.reduce((sum, c) => sum + c.diffPercent, 0) / comparisons.length,
    slides: comparisons
  };

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('VISUAL COMPARISON SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Slides: ${report.totalSlides}`);
  console.log(`Identical (0%):     ${report.identicalSlides} slides`);
  console.log(`Minor (<1%):        ${report.minorDiffSlides} slides`);
  console.log(`Moderate (1-5%):    ${report.moderateDiffSlides} slides`);
  console.log(`Major (>5%):        ${report.majorDiffSlides} slides`);
  console.log(`Average Diff:       ${report.averageDiffPercent.toFixed(2)}%`);

  // Save JSON report
  fs.writeFileSync(
    path.join(outputDir, 'comparison-report.json'),
    JSON.stringify(report, null, 2)
  );

  // Generate HTML report
  await generateHtmlReport(report, outputDir);

  // Print worst slides
  const worstSlides = [...comparisons]
    .sort((a, b) => b.diffPercent - a.diffPercent)
    .slice(0, 5);

  if (worstSlides.some(s => s.diffPercent > 0)) {
    console.log('\nWorst performing slides:');
    worstSlides.forEach(s => {
      console.log(`  Slide ${s.slide}: ${s.diffPercent.toFixed(2)}% diff`);
    });
  }
}

main().catch(console.error);
