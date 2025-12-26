/**
 * Export Report Generator
 *
 * Generates JSON report after PPTX export for Claude Code workflow
 * Enables iterative refinement without manual inspection
 *
 * @see Google Slides Compatibility Constraints in plan
 */

import type { Deck, Theme, SlideElement, TextBlock } from '../schema/slide.js';

// =============================================================================
// Types
// =============================================================================

export interface FontReport {
  safe: string[];
  unsafe: string[];
  all: string[];
}

export interface IconReport {
  total: number;
  unique: number;
  cacheHits: number;
  cacheMisses: number;
  icons: Array<{ name: string; color: string; count: number }>;
}

export interface Warning {
  slide: number;
  slideId: string;
  element: string;
  type: WarningType;
  message: string;
  threshold?: number;
}

export type WarningType =
  | 'near_overflow'
  | 'unsafe_font'
  | 'complex_gradient'
  | 'transparency_stack'
  | 'unsupported_effect'
  | 'missing_icon';

export interface ExportStats {
  slides: number;
  shapes: number;
  textBoxes: number;
  images: number;
  icons: number;
  fileSize: number;
  generatedAt: string;
}

export interface ExportReport {
  success: boolean;
  fonts: FontReport;
  icons: IconReport;
  warnings: Warning[];
  stats: ExportStats;
  slidesCompatibility: SlideCompatibility[];
}

export interface SlideCompatibility {
  index: number;
  id: string;
  type: string;
  compatible: boolean;
  issues: string[];
}

// =============================================================================
// Font Safety Classification
// =============================================================================

/**
 * Fonts that are native to Google Slides and will render correctly
 */
export const SAFE_FONTS = new Set([
  // Google Fonts (Slides native)
  'Roboto',
  'Open Sans',
  'Lato',
  'Source Sans Pro',
  'Montserrat',
  'Oswald',
  'Raleway',
  'PT Sans',
  'Noto Sans',
  'Ubuntu',
  'Poppins',
  'Work Sans',

  // System fonts (universal)
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Courier New', // Monospace is generally safe
]);

/**
 * Fonts that may substitute in Google Slides
 */
export const UNSAFE_FONTS = new Set([
  'Playfair Display',  // Serif - may become Times or Georgia
  'Impact',            // Display - may become Arial Black or similar
  'Comic Sans MS',     // May substitute
  'Brush Script',      // Script fonts rarely work
  'Papyrus',           // Decorative
]);

/**
 * Classify a font as safe or unsafe for Google Slides
 */
export function classifyFont(fontName: string): 'safe' | 'unsafe' | 'unknown' {
  const normalized = fontName.trim();

  if (SAFE_FONTS.has(normalized)) {
    return 'safe';
  }

  if (UNSAFE_FONTS.has(normalized)) {
    return 'unsafe';
  }

  // Heuristics for unknown fonts
  // Google Fonts are generally safer
  // System fonts are generally safer
  // Decorative/display fonts are risky

  return 'unknown';
}

/**
 * Get all fonts used in a deck
 */
export function extractFonts(deck: Deck): FontReport {
  const fonts = new Set<string>();

  // Add theme fonts
  fonts.add(deck.theme.fonts.heading);
  fonts.add(deck.theme.fonts.body);
  if (deck.theme.fonts.special) {
    fonts.add(deck.theme.fonts.special);
  }

  // Scan all text elements for explicit font overrides
  // (Currently our schema doesn't support per-element fonts, but future-proof)

  const all = Array.from(fonts);
  const safe = all.filter((f) => classifyFont(f) === 'safe');
  const unsafe = all.filter((f) => classifyFont(f) !== 'safe');

  return { safe, unsafe, all };
}

// =============================================================================
// Icon Analysis
// =============================================================================

/**
 * Extract icon usage from deck
 */
export function extractIcons(deck: Deck): {
  icons: Map<string, { color: string; count: number }>;
  total: number;
} {
  const icons = new Map<string, { color: string; count: number }>();
  let total = 0;

  for (const slide of deck.slides) {
    for (const element of slide.content.elements) {
      if (element.type === 'icon-card') {
        const key = `${element.icon}:${element.iconColor || deck.theme.colors.primary}`;
        const existing = icons.get(key);
        if (existing) {
          existing.count++;
        } else {
          icons.set(key, {
            color: element.iconColor || deck.theme.colors.primary,
            count: 1,
          });
        }
        total++;
      } else if (element.type === 'icon-grid') {
        for (const item of element.items) {
          const key = `${item.icon}:${deck.theme.colors.primary}`;
          const existing = icons.get(key);
          if (existing) {
            existing.count++;
          } else {
            icons.set(key, {
              color: deck.theme.colors.primary,
              count: 1,
            });
          }
          total++;
        }
      } else if (element.type === 'callout' && element.icon) {
        const color = deck.theme.colors[element.variant as keyof typeof deck.theme.colors] as string || deck.theme.colors.primary;
        const key = `${element.icon}:${color}`;
        const existing = icons.get(key);
        if (existing) {
          existing.count++;
        } else {
          icons.set(key, { color, count: 1 });
        }
        total++;
      }
    }
  }

  return { icons, total };
}

// =============================================================================
// Compatibility Checks
// =============================================================================

/**
 * Check a slide for Google Slides compatibility issues
 */
export function checkSlideCompatibility(
  slide: Deck['slides'][0],
  index: number,
  theme: Theme
): SlideCompatibility {
  const issues: string[] = [];

  // Check background
  if (slide.background?.type === 'gradient') {
    // Complex gradients may import oddly
    if (slide.background.gradient) {
      const angle = slide.background.gradient.angle;
      if (angle !== 0 && angle !== 90 && angle !== 180 && angle !== 270 && angle !== 135 && angle !== 45) {
        issues.push(`Non-standard gradient angle (${angle}°) may render differently`);
      }
    }
  }

  // Check for transparency issues
  // (Would need to scan all elements with alpha values)

  // Check element count (very dense slides may have issues)
  if (slide.content.elements.length > 20) {
    issues.push(`High element count (${slide.content.elements.length}) may affect performance`);
  }

  return {
    index,
    id: slide.id,
    type: slide.slideType,
    compatible: issues.length === 0,
    issues,
  };
}

// =============================================================================
// Warning Generation
// =============================================================================

/**
 * Generate warnings for a deck
 */
export function generateWarnings(deck: Deck): Warning[] {
  const warnings: Warning[] = [];
  const fonts = extractFonts(deck);

  // Font warnings
  for (const font of fonts.unsafe) {
    warnings.push({
      slide: 0,
      slideId: 'theme',
      element: 'fonts',
      type: 'unsafe_font',
      message: `Font "${font}" may substitute in Google Slides`,
    });
  }

  // Scan slides
  deck.slides.forEach((slide, index) => {
    // Check for complex effects
    if (slide.background?.type === 'image' && slide.background.image?.overlay) {
      if (slide.background.image.overlay.opacity < 0.1 || slide.background.image.overlay.opacity > 0.9) {
        warnings.push({
          slide: index + 1,
          slideId: slide.id,
          element: 'background',
          type: 'transparency_stack',
          message: 'Extreme overlay opacity may render differently',
          threshold: Math.round(slide.background.image.overlay.opacity * 100),
        });
      }
    }

    // Check element count
    if (slide.content.elements.length > 15) {
      warnings.push({
        slide: index + 1,
        slideId: slide.id,
        element: 'content',
        type: 'near_overflow',
        message: `Dense slide with ${slide.content.elements.length} elements`,
        threshold: slide.content.elements.length,
      });
    }
  });

  return warnings;
}

// =============================================================================
// Main Report Generator
// =============================================================================

export interface ReportOptions {
  /** PPTX buffer for file size calculation */
  pptxBuffer?: Buffer;
  /** Icon cache hits/misses from render */
  iconCacheStats?: { hits: number; misses: number };
}

/**
 * Generate a complete export report for Claude Code workflow
 *
 * @example
 * ```ts
 * const report = generateExportReport(deck, {
 *   pptxBuffer: result.buffer,
 *   iconCacheStats: { hits: 10, misses: 2 },
 * });
 * console.log(JSON.stringify(report, null, 2));
 * ```
 */
export function generateExportReport(
  deck: Deck,
  options: ReportOptions = {}
): ExportReport {
  const { pptxBuffer, iconCacheStats } = options;

  // Extract data
  const fonts = extractFonts(deck);
  const { icons, total: iconTotal } = extractIcons(deck);

  // Build icon report
  const iconReport: IconReport = {
    total: iconTotal,
    unique: icons.size,
    cacheHits: iconCacheStats?.hits ?? 0,
    cacheMisses: iconCacheStats?.misses ?? 0,
    icons: Array.from(icons.entries()).map(([key, value]) => ({
      name: key.split(':')[0],
      color: value.color,
      count: value.count,
    })),
  };

  // Generate warnings
  const warnings = generateWarnings(deck);

  // Check slide compatibility
  const slidesCompatibility = deck.slides.map((slide, index) =>
    checkSlideCompatibility(slide, index, deck.theme)
  );

  // Count stats
  let shapes = 0;
  let textBoxes = 0;
  let images = 0;

  for (const slide of deck.slides) {
    for (const element of slide.content.elements) {
      switch (element.type) {
        case 'text':
          textBoxes++;
          break;
        case 'icon-card':
          shapes++; // card background
          textBoxes += 2; // title + description
          images++; // icon
          break;
        case 'numbered-item':
          shapes++; // circle
          textBoxes += 2; // number + title
          break;
        case 'callout':
          shapes++;
          textBoxes++;
          break;
        case 'badge':
          shapes++;
          textBoxes++;
          break;
        case 'icon-grid':
          for (const item of element.items) {
            images++;
            textBoxes++;
          }
          break;
        case 'comparison-row':
          textBoxes += 1 + element.columns.length;
          break;
        case 'image':
          images++;
          break;
      }
    }

    // Header adds shapes/text
    if (slide.header) {
      shapes++;
      textBoxes++;
      if (slide.header.subtitle) textBoxes++;
    }
  }

  const stats: ExportStats = {
    slides: deck.slides.length,
    shapes,
    textBoxes,
    images,
    icons: iconTotal,
    fileSize: pptxBuffer?.length ?? 0,
    generatedAt: new Date().toISOString(),
  };

  const allCompatible = slidesCompatibility.every((s) => s.compatible);
  const noUnsafeFonts = fonts.unsafe.length === 0;

  return {
    success: allCompatible && noUnsafeFonts,
    fonts,
    icons: iconReport,
    warnings,
    stats,
    slidesCompatibility,
  };
}

/**
 * Format report as human-readable string
 */
export function formatReport(report: ExportReport): string {
  const lines: string[] = [];

  lines.push('=== Export Report ===\n');

  // Status
  lines.push(`Status: ${report.success ? '✓ Google Slides Compatible' : '⚠ Has Compatibility Issues'}`);
  lines.push('');

  // Stats
  lines.push('Stats:');
  lines.push(`  Slides: ${report.stats.slides}`);
  lines.push(`  Shapes: ${report.stats.shapes}`);
  lines.push(`  Text boxes: ${report.stats.textBoxes}`);
  lines.push(`  Icons: ${report.stats.icons} (${report.icons.unique} unique)`);
  lines.push(`  File size: ${(report.stats.fileSize / 1024).toFixed(1)} KB`);
  lines.push('');

  // Fonts
  lines.push('Fonts:');
  lines.push(`  Safe: ${report.fonts.safe.join(', ') || 'none'}`);
  if (report.fonts.unsafe.length > 0) {
    lines.push(`  ⚠ Unsafe: ${report.fonts.unsafe.join(', ')}`);
  }
  lines.push('');

  // Warnings
  if (report.warnings.length > 0) {
    lines.push('Warnings:');
    for (const warn of report.warnings) {
      lines.push(`  [${warn.type}] Slide ${warn.slide}: ${warn.message}`);
    }
    lines.push('');
  }

  // Compatibility
  const incompatible = report.slidesCompatibility.filter((s) => !s.compatible);
  if (incompatible.length > 0) {
    lines.push('Compatibility Issues:');
    for (const slide of incompatible) {
      lines.push(`  Slide ${slide.index + 1} (${slide.type}):`);
      for (const issue of slide.issues) {
        lines.push(`    - ${issue}`);
      }
    }
  }

  return lines.join('\n');
}
