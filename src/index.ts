/**
 * Magic Slides - Generate editable PPTX from schema
 *
 * A Z.AI-style slide generation system that creates native PowerPoint
 * presentations from a structured JSON schema with semantic theming.
 *
 * @example
 * ```ts
 * import { generateTheme, renderPptx, renderHtml } from 'make-slides/magic';
 *
 * // Generate theme from topic
 * const theme = generateTheme({ topic: 'Rafael Nadal: King of Clay' });
 *
 * // Create deck
 * const deck = {
 *   id: 'nadal-presentation',
 *   title: 'Rafael Nadal',
 *   theme: theme,
 *   slides: [
 *     {
 *       id: 'title',
 *       slideType: 'title',
 *       content: {
 *         elements: [
 *           { type: 'text', content: 'Rafael Nadal', size: 'title', bold: true },
 *           { type: 'text', content: 'The King of Clay', size: 'body' },
 *         ],
 *       },
 *     },
 *   ],
 * };
 *
 * // Generate PPTX
 * const result = await renderPptx(deck, { outputPath: 'nadal.pptx' });
 *
 * // Generate HTML preview
 * const html = renderHtml(deck, { standalone: true });
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Schema Types
// =============================================================================

export type {
  Deck,
  Slide,
  SlideType,
  SlideElement,
  SlideHeader,
  SlideContent,
  Theme,
  FontConfig,
  ColorPalette,
  BackgroundConfig,
  Dimensions,
  Bounds,
  LayoutType,
  // Element types
  TextBlock,
  IconCard,
  NumberedItem,
  Callout,
  Badge,
  IconGrid,
  ComparisonRow,
  ImageElement,
  ShapeType,
} from './schema/slide.js';

export {
  DEFAULT_THEME,
  TYPOGRAPHY_SCALE,
  SHAPE_PRESETS,
} from './schema/slide.js';

// =============================================================================
// Theme Generation
// =============================================================================

export type {
  TopicCategory,
  ThemeGeneratorOptions,
  GeneratedTheme,
} from './theme/generator.js';

export {
  generateTheme,
  generateBackground,
  detectCategory,
  extractKeywords,
  detectSemanticColor,
  getContrastingTextColor,
  withOpacity,
} from './theme/generator.js';

// =============================================================================
// Icon Rendering
// =============================================================================

export type {
  IconRenderOptions,
  RenderedIcon,
} from './icons/renderer.js';

export {
  renderIcon,
  renderIcons,
  fetchIconSvg,
  colorizeSvg,
  getCacheKey,
  getCachePath,
  clearIconCache,
  getCacheStats,
  getIconId,
  COMMON_ICONS,
  DEFAULT_ICON_SIZE,
  DEFAULT_ICON_SET,
  ICON_CACHE_DIR,
} from './icons/renderer.js';

// =============================================================================
// PPTX Rendering
// =============================================================================

export type {
  PptxRenderOptions,
  RenderResult,
} from './renderers/pptx.js';

export {
  renderPptx,
  renderSingleSlide,
} from './renderers/pptx.js';

// =============================================================================
// HTML Rendering
// =============================================================================

export type {
  HtmlRenderOptions,
  RenderedHtml,
} from './renderers/html.js';

export {
  renderHtml,
  renderSingleSlideHtml,
} from './renderers/html.js';

// =============================================================================
// Export Report (Claude Code Workflow)
// =============================================================================

export type {
  FontReport,
  IconReport,
  Warning,
  WarningType,
  ExportStats,
  ExportReport,
  SlideCompatibility,
  ReportOptions,
} from './utils/report.js';

export {
  generateExportReport,
  formatReport,
  extractFonts,
  extractIcons,
  classifyFont,
  checkSlideCompatibility,
  generateWarnings,
  SAFE_FONTS,
  UNSAFE_FONTS,
} from './utils/report.js';

// =============================================================================
// Conversion Utilities
// =============================================================================

export {
  // Pixel conversions
  pxToEmu,
  emuToPx,
  pxToInches,
  inchesToPx,
  // Font conversions
  fontPxToPptx,
  fontPptxToPx,
  fontPtToPptx,
  fontPptxToPt,
  // Color conversions
  cssColorToPptx,
  pptxColorToCss,
  cssRgbaToPptx,
  // Bounds conversions
  boundsToPptx,
  boundsFromPptx,
  // Gradient conversions
  gradientAngleToPptx,
  gradientAngleFromPptx,
  // Shape conversions
  borderRadiusToShapeType,
  // Text utilities
  safeTextWidth,
  // Slide size
  getSlideSize,
  // Constants
  EMU_PER_PX,
  EMU_PER_INCH,
  SLIDE_WIDTH_EMU,
  SLIDE_HEIGHT_EMU,
  FONT_SIZE_MULTIPLIER,
  TEXT_SAFETY_FACTOR,
} from './utils/convert.js';

// =============================================================================
// Convenience Functions
// =============================================================================

import type { Deck, Slide, Theme } from './schema/slide.js';
import { generateTheme, type ThemeGeneratorOptions } from './theme/generator.js';
import { renderPptx, type PptxRenderOptions } from './renderers/pptx.js';
import { renderHtml, type HtmlRenderOptions } from './renderers/html.js';
import { generateExportReport, formatReport, type ExportReport } from './utils/report.js';

/**
 * Quick generation: topic → PPTX
 *
 * @example
 * ```ts
 * const result = await quickGenerate({
 *   topic: 'Quarterly Sales Report',
 *   slides: [
 *     { slideType: 'title', content: { elements: [{ type: 'text', content: 'Q4 2024', size: 'title' }] } },
 *   ],
 *   outputPath: 'report.pptx',
 * });
 * ```
 */
export async function quickGenerate(options: {
  topic: string;
  slides: Array<Omit<Slide, 'id'>>;
  outputPath?: string;
  themeOptions?: Partial<ThemeGeneratorOptions>;
  pptxOptions?: Omit<PptxRenderOptions, 'outputPath'>;
}): Promise<{
  deck: Deck;
  pptxResult: Awaited<ReturnType<typeof renderPptx>>;
  report: ExportReport;
  reportText: string;
}> {
  const { topic, slides, outputPath, themeOptions = {}, pptxOptions = {} } = options;

  // Generate theme
  const theme = generateTheme({ topic, ...themeOptions });

  // Create deck
  const deck: Deck = {
    id: `deck-${Date.now()}`,
    title: topic,
    theme,
    slides: slides.map((slide, index) => ({
      ...slide,
      id: `slide-${index + 1}`,
    })),
    createdAt: new Date().toISOString(),
  };

  // Render PPTX
  const pptxResult = await renderPptx(deck, { ...pptxOptions, outputPath });

  // Generate export report for Claude Code workflow
  const report = generateExportReport(deck, {
    pptxBuffer: pptxResult.buffer,
    iconCacheStats: { hits: pptxResult.iconCount, misses: 0 },
  });
  const reportText = formatReport(report);

  return { deck, pptxResult, report, reportText };
}

/**
 * Create a simple title slide
 */
export function createTitleSlide(
  title: string,
  subtitle?: string
): Omit<Slide, 'id'> {
  const elements: Slide['content']['elements'] = [
    { type: 'text', content: title, size: 'title', bold: true, color: '#FFFFFF', align: 'center' },
  ];

  if (subtitle) {
    elements.push({ type: 'text', content: subtitle, size: 'body', color: '#FFFFFF', align: 'center' });
  }

  return {
    slideType: 'title',
    background: {
      type: 'gradient',
      gradient: { from: '#13487A', to: '#0D3A5F', angle: 135 },
    },
    content: { elements },
  };
}

/**
 * Create a content slide with icon cards
 */
export function createIconCardSlide(
  title: string,
  cards: Array<{ icon: string; title: string; description?: string }>
): Omit<Slide, 'id'> {
  return {
    slideType: 'content',
    header: { title },
    content: {
      layout: cards.length <= 2 ? 'grid-2-column' : 'grid-3-column',
      elements: cards.map((card) => ({
        type: 'icon-card' as const,
        ...card,
      })),
    },
  };
}

/**
 * Create an agenda slide
 */
export function createAgendaSlide(
  title: string,
  items: Array<{ title: string; description?: string }>
): Omit<Slide, 'id'> {
  return {
    slideType: 'agenda',
    header: { title },
    content: {
      layout: 'flex-column',
      elements: items.map((item, index) => ({
        type: 'numbered-item' as const,
        number: index + 1,
        ...item,
      })),
    },
  };
}

/**
 * Create a closing slide
 */
export function createClosingSlide(
  message: string = 'Thank You!',
  subtitle?: string
): Omit<Slide, 'id'> {
  const elements: Slide['content']['elements'] = [
    { type: 'text', content: message, size: 'title', bold: true, color: '#FFFFFF', align: 'center' },
  ];

  if (subtitle) {
    elements.push({ type: 'text', content: subtitle, size: 'body', color: '#FFFFFF', align: 'center' });
  }

  return {
    slideType: 'closing',
    background: {
      type: 'gradient',
      gradient: { from: '#13487A', to: '#0D3A5F', angle: 135 },
    },
    content: { elements },
  };
}
