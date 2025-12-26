/**
 * Analyze PPTX - Extract structural information from a PPTX file
 *
 * Usage:
 *   npx tsx oracle/scripts/analyze_pptx.ts path/to/file.pptx
 *
 * Output:
 *   JSON structure with slides, shapes, fonts, colors, etc.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// =============================================================================
// Types
// =============================================================================

interface SlideAnalysis {
  index: number;
  shapes: number;
  pictures: number;
  textRuns: number;
  fontSizes: number[];
  fonts: string[];
  fills: string[];
  geometries: string[];
}

interface PptxAnalysis {
  file: string;
  slides: SlideAnalysis[];
  totals: {
    slides: number;
    shapes: number;
    pictures: number;
    textRuns: number;
    uniqueFontSizes: number[];
    uniqueFonts: string[];
    uniqueGeometries: string[];
  };
  mediaFiles: number;
  fileSize: number;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error('Usage: npx tsx analyze_pptx.ts <path-to-pptx>');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  // Create temp directory for extraction
  const tempDir = `/tmp/pptx-analyze-${Date.now()}`;
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Extract PPTX (it's a ZIP file)
    execSync(`unzip -q "${inputPath}" -d "${tempDir}"`, { stdio: 'pipe' });

    // Analyze
    const analysis = analyzePptx(inputPath, tempDir);

    // Output JSON
    console.log(JSON.stringify(analysis, null, 2));

  } finally {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// =============================================================================
// Analysis Functions
// =============================================================================

function analyzePptx(filePath: string, extractDir: string): PptxAnalysis {
  const slidesDir = path.join(extractDir, 'ppt', 'slides');
  const mediaDir = path.join(extractDir, 'ppt', 'media');

  // Get slide files
  const slideFiles = fs.existsSync(slidesDir)
    ? fs.readdirSync(slidesDir)
        .filter((f) => f.match(/^slide\d+\.xml$/))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.match(/\d+/)?.[0] || '0');
          return numA - numB;
        })
    : [];

  // Analyze each slide
  const slides: SlideAnalysis[] = slideFiles.map((file, index) => {
    const content = fs.readFileSync(path.join(slidesDir, file), 'utf-8');
    return analyzeSlide(content, index);
  });

  // Count media files
  const mediaFiles = fs.existsSync(mediaDir)
    ? fs.readdirSync(mediaDir).length
    : 0;

  // File size
  const fileSize = fs.statSync(filePath).size;

  // Aggregate totals
  const allFontSizes = new Set<number>();
  const allFonts = new Set<string>();
  const allGeometries = new Set<string>();
  let totalShapes = 0;
  let totalPictures = 0;
  let totalTextRuns = 0;

  for (const slide of slides) {
    totalShapes += slide.shapes;
    totalPictures += slide.pictures;
    totalTextRuns += slide.textRuns;
    slide.fontSizes.forEach((s) => allFontSizes.add(s));
    slide.fonts.forEach((f) => allFonts.add(f));
    slide.geometries.forEach((g) => allGeometries.add(g));
  }

  return {
    file: filePath,
    slides,
    totals: {
      slides: slides.length,
      shapes: totalShapes,
      pictures: totalPictures,
      textRuns: totalTextRuns,
      uniqueFontSizes: Array.from(allFontSizes).sort((a, b) => b - a),
      uniqueFonts: Array.from(allFonts).sort(),
      uniqueGeometries: Array.from(allGeometries).sort(),
    },
    mediaFiles,
    fileSize,
  };
}

function analyzeSlide(xml: string, index: number): SlideAnalysis {
  // Count shapes <p:sp>
  const shapes = (xml.match(/<p:sp>/g) || []).length;

  // Count pictures <p:pic>
  const pictures = (xml.match(/<p:pic>/g) || []).length;

  // Count text runs <a:t>
  const textRuns = (xml.match(/<a:t>/g) || []).length;

  // Extract font sizes sz="NNNN"
  const fontSizeMatches = xml.match(/sz="(\d+)"/g) || [];
  const fontSizes = [...new Set(
    fontSizeMatches.map((m) => parseInt(m.match(/\d+/)?.[0] || '0'))
  )].sort((a, b) => b - a);

  // Extract font families typeface="..."
  const fontMatches = xml.match(/typeface="([^"]+)"/g) || [];
  const fonts = [...new Set(
    fontMatches.map((m) => m.match(/typeface="([^"]+)"/)?.[1] || '')
  )].filter(Boolean);

  // Extract fills - solid colors srgbClr val="..."
  const fillMatches = xml.match(/srgbClr val="([A-Fa-f0-9]{6})"/g) || [];
  const fills = [...new Set(
    fillMatches.map((m) => '#' + (m.match(/val="([^"]+)"/)?.[1] || ''))
  )];

  // Extract geometries prst="..."
  const geomMatches = xml.match(/prst="(\w+)"/g) || [];
  const geometries = [...new Set(
    geomMatches.map((m) => m.match(/prst="(\w+)"/)?.[1] || '')
  )].filter(Boolean);

  return {
    index,
    shapes,
    pictures,
    textRuns,
    fontSizes,
    fonts,
    fills,
    geometries,
  };
}

// =============================================================================
// Run
// =============================================================================

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
