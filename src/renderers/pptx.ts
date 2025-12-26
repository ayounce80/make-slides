/**
 * PPTX Renderer
 *
 * Generates native PowerPoint from slide schema using pptxgenjs
 * Produces editable PPTX with native shapes, text boxes, and embedded images
 *
 * @see data/z-ai-research/Z-AI-RESEARCH-SUMMARY.md
 */

import PptxGenJSDefault from 'pptxgenjs';
import type {
  Deck,
  Slide as SlideSchema,
  SlideElement,
  Theme,
  IconCard,
  TextBlock,
  NumberedItem,
  Callout,
  Badge,
  IconGrid,
  ComparisonRow,
  ImageElement,
} from '../schema/slide.js';

// Handle both ESM and CJS imports - pptxgenjs exports differently
const PptxGenJSConstructor = ((PptxGenJSDefault as { default?: unknown }).default || PptxGenJSDefault) as new () => PptxGenJSInstance;

// Define the instance interface based on pptxgenjs API
interface PptxGenJSInstance {
  readonly version: string;
  author: string;
  title: string;
  subject: string;
  layout: string;
  defineSlideMaster(options: { title: string; background: { color: string } }): void;
  addSlide(): PptxSlide;
  write(options: { outputType: string }): Promise<Buffer>;
}

interface PptxSlide {
  background: { color: string };
  addShape(type: string, options: Record<string, unknown>): void;
  addText(text: string | unknown[], options: Record<string, unknown>): void;
  addImage(options: Record<string, unknown>): void;
  addNotes(notes: string): void;
}
import {
  pxToInches,
  fontPxToPptx,
  cssColorToPptx,
  TEXT_SAFETY_FACTOR,
} from '../utils/convert.js';
import { renderIcon } from '../icons/renderer.js';

// =============================================================================
// Types
// =============================================================================

export interface PptxRenderOptions {
  /** Output file path */
  outputPath?: string;
  /** Include speaker notes */
  includeNotes?: boolean;
  /** Icon cache directory */
  iconCacheDir?: string;
}

export interface RenderResult {
  /** Generated PPTX buffer */
  buffer: Buffer;
  /** Output file path (if written) */
  filePath?: string;
  /** Rendered icon count */
  iconCount: number;
  /** Slide count */
  slideCount: number;
}

// =============================================================================
// Constants
// =============================================================================

const SLIDE_WIDTH_INCHES = 13.333; // 16:9 standard
const SLIDE_HEIGHT_INCHES = 7.5;

/**
 * Font size map: CSS px values
 * These get converted to pt via pxToPt() for pptxgenjs
 *
 * Z.AI validated typography scale:
 * - Title: 72px → 43.05pt
 * - Heading (header bar): 40px → 23.92pt
 * - Subheading: 24px → 14.35pt
 * - Body: 22px → 13.15pt
 * - Card title: 20px → 11.96pt
 * - Card body: 18px → 10.76pt
 * - Caption/footer: 16px → 9.56pt
 */
const FONT_SIZE_PX: Record<string, number> = {
  title: 72,
  heading: 40,
  subheading: 24,   // Was 30, Z.AI uses 24px
  body: 22,
  'card-title': 20,
  'card-body': 18,
  caption: 16,      // Was 14, Z.AI uses 16px
};

/**
 * Convert CSS px to PowerPoint pt
 * PPTX pt = px * 0.598 (validated from Z.AI reference deck)
 */
function pxToPt(px: number): number {
  return Math.floor(px * 59.8) / 100;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert px to inches for pptxgenjs
 */
function px(value: number): number {
  return pxToInches(value);
}

/**
 * Convert font size from schema to pptxgenjs format (pt)
 * Accepts either a size name or a px value
 */
function fontSize(size: keyof typeof FONT_SIZE_PX | number): number {
  if (typeof size === 'number') {
    // Assume raw number is px, convert to pt
    return pxToPt(size);
  }
  const px = FONT_SIZE_PX[size] || 22;
  return pxToPt(px);
}

/**
 * Convert hex color to pptxgenjs format
 */
function color(hex: string): string {
  return cssColorToPptx(hex);
}

// =============================================================================
// Slide Renderers
// =============================================================================

/**
 * Render title slide
 * Z.AI title slide structure:
 * 1. Solid background color
 * 2. Full-slide gradient overlay (95% → 85% alpha)
 * 3. Title text (sz=4305, centered)
 * 4. Decorative divider line (white, 80% opacity)
 * 5. Subtitle text (sz=1435)
 * 6. "Prepared for" attribution (sz=1196)
 * 7. Footer with company/date (sz=956)
 */
async function renderTitleSlide(
  pptx: PptxGenJSInstance,
  slide: SlideSchema,
  theme: Theme,
  deck?: Deck
): Promise<void> {
  const pptxSlide = pptx.addSlide();

  // Solid background
  const bgColor = slide.background?.type === 'solid' && slide.background.color
    ? slide.background.color
    : slide.background?.type === 'gradient' && slide.background.gradient
      ? slide.background.gradient.from
      : theme.colors.primary;

  pptxSlide.background = { color: color(bgColor) };

  // Gradient overlay rectangle (Z.AI uses 95% → 85% alpha gradient)
  pptxSlide.addShape('rect', {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH_INCHES,
    h: SLIDE_HEIGHT_INCHES,
    fill: {
      color: color(bgColor),
      transparency: 8, // ~92% opacity (pptxgenjs uses inverse)
    },
    line: { color: color(bgColor), transparency: 100 },
  });

  // Additional gradient layer for depth
  pptxSlide.addShape('rect', {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH_INCHES,
    h: SLIDE_HEIGHT_INCHES,
    fill: { color: color(bgColor), transparency: 15 },
    line: { color: color(bgColor), transparency: 100 },
  });

  // Top accent bar
  pptxSlide.addShape('rect', {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH_INCHES,
    h: 0.06,
    fill: { color: 'FFFFFF', transparency: 75 },
    line: { color: 'FFFFFF', transparency: 100 },
  });

  // Side decorative elements
  pptxSlide.addShape('rect', {
    x: 0,
    y: 0,
    w: 0.15,
    h: SLIDE_HEIGHT_INCHES,
    fill: { color: 'FFFFFF', transparency: 90 },
    line: { color: 'FFFFFF', transparency: 100 },
  });

  pptxSlide.addShape('rect', {
    x: SLIDE_WIDTH_INCHES - 0.15,
    y: 0,
    w: 0.15,
    h: SLIDE_HEIGHT_INCHES,
    fill: { color: 'FFFFFF', transparency: 90 },
    line: { color: 'FFFFFF', transparency: 100 },
  });

  // Find title and subtitle elements
  const titleElement = slide.content.elements.find(
    (el): el is TextBlock => el.type === 'text' && el.size === 'title'
  );
  const subtitleElement = slide.content.elements.find(
    (el): el is TextBlock => el.type === 'text' && el.size === 'body'
  );

  // Render title (centered, upper third)
  if (titleElement) {
    pptxSlide.addText(titleElement.content, {
      x: 0.5,
      y: 2.2,
      w: SLIDE_WIDTH_INCHES - 1,
      h: 1.2,
      fontSize: fontSize('title'),
      fontFace: theme.fonts.heading,
      color: color(titleElement.color || theme.colors.text.inverse),
      bold: titleElement.bold !== false,
      align: titleElement.align || 'center',
      valign: 'middle',
    });
  }

  // Decorative divider line (white rectangle, 80% opacity)
  pptxSlide.addShape('rect', {
    x: (SLIDE_WIDTH_INCHES - 1.5) / 2,  // Centered
    y: 3.5,
    w: 1.5,
    h: 0.04,  // Thin line (~4px)
    fill: { color: 'FFFFFF', transparency: 20 },  // 80% opacity
    line: { color: 'FFFFFF', transparency: 100 },
  });

  // Render subtitle (below divider)
  if (subtitleElement) {
    pptxSlide.addText(subtitleElement.content, {
      x: 0.5,
      y: 3.7,
      w: SLIDE_WIDTH_INCHES - 1,
      h: 0.6,
      fontSize: fontSize('subheading'),
      fontFace: theme.fonts.body,
      color: color(subtitleElement.color || theme.colors.text.inverse),
      align: subtitleElement.align || 'center',
      valign: 'middle',
    });
  }

  // "Prepared for" attribution (if available in deck metadata)
  if (deck?.client) {
    pptxSlide.addText(`Prepared for ${deck.client}`, {
      x: 0.5,
      y: 5.0,
      w: SLIDE_WIDTH_INCHES - 1,
      h: 0.4,
      fontSize: fontSize('card-title'),  // sz=1196 (~20px)
      fontFace: theme.fonts.body,
      color: 'F3F4F6',  // Slightly dimmer white
      align: 'center',
      valign: 'middle',
    });
  }

  // Footer with company/date
  const footerText = deck?.author
    ? `${deck.author} | ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  pptxSlide.addText(footerText, {
    x: 0,
    y: SLIDE_HEIGHT_INCHES - 0.5,
    w: SLIDE_WIDTH_INCHES,
    h: 0.35,
    fontSize: fontSize('caption'),  // sz=956 (~16px)
    fontFace: theme.fonts.body,
    color: color(theme.colors.text.inverse),
    align: 'center',
    valign: 'middle',
  });

  // Notes
  if (slide.notes) {
    pptxSlide.addNotes(slide.notes);
  }
}

/**
 * Render section divider slide
 * Z.AI section slide structure:
 * 1. Solid background color (primary)
 * 2. Title text (sz=4305, centered, bold)
 * 3. Decorative divider line (white, 60% opacity)
 * 4. Subtitle text (sz=1794, centered)
 */
async function renderSectionSlide(
  pptx: PptxGenJSInstance,
  slide: SlideSchema,
  theme: Theme
): Promise<void> {
  const pptxSlide = pptx.addSlide();

  // Solid background
  const bgColor = slide.background?.type === 'solid' && slide.background.color
    ? slide.background.color
    : theme.colors.primary;

  pptxSlide.background = { color: color(bgColor) };

  // Full-slide gradient overlay for depth
  pptxSlide.addShape('rect', {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH_INCHES,
    h: SLIDE_HEIGHT_INCHES,
    fill: { color: color(bgColor), transparency: 10 },
    line: { color: color(bgColor), transparency: 100 },
  });

  // Top decorative band
  pptxSlide.addShape('rect', {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH_INCHES,
    h: 0.8,
    fill: { color: 'FFFFFF', transparency: 95 },
    line: { color: 'FFFFFF', transparency: 100 },
  });

  // Bottom decorative band
  pptxSlide.addShape('rect', {
    x: 0,
    y: SLIDE_HEIGHT_INCHES - 0.8,
    w: SLIDE_WIDTH_INCHES,
    h: 0.8,
    fill: { color: 'FFFFFF', transparency: 95 },
    line: { color: 'FFFFFF', transparency: 100 },
  });

  // Find title and subtitle elements
  const titleElement = slide.content.elements.find(
    (el): el is TextBlock => el.type === 'text' && (el.size === 'title' || el.size === 'heading')
  );
  const subtitleElement = slide.content.elements.find(
    (el): el is TextBlock => el.type === 'text' && el.size !== 'title' && el.size !== 'heading'
  );

  // Title background container
  pptxSlide.addShape('roundRect', {
    x: (SLIDE_WIDTH_INCHES - 10) / 2,
    y: 2.3,
    w: 10,
    h: 1.2,
    fill: { color: 'FFFFFF', transparency: 92 },
    line: { color: 'FFFFFF', transparency: 100 },
    rectRadius: 0.08,
  });

  // Render title (centered)
  if (titleElement) {
    pptxSlide.addText(titleElement.content, {
      x: 0.5,
      y: 2.5,
      w: SLIDE_WIDTH_INCHES - 1,
      h: 0.9,
      fontSize: fontSize('title'),
      fontFace: theme.fonts.heading,
      color: color(titleElement.color || theme.colors.text.inverse),
      bold: true,
      align: 'center',
      valign: 'middle',
    });
  }

  // Decorative divider line (white, 60% opacity)
  pptxSlide.addShape('rect', {
    x: (SLIDE_WIDTH_INCHES - 1.8) / 2,  // Centered
    y: 3.6,
    w: 1.8,
    h: 0.04,  // Thin line (~4px)
    fill: { color: 'FFFFFF', transparency: 40 },  // 60% opacity
    line: { color: 'FFFFFF', transparency: 100 },
  });

  // Additional thin accent lines
  pptxSlide.addShape('rect', {
    x: (SLIDE_WIDTH_INCHES - 3) / 2,
    y: 3.55,
    w: 0.4,
    h: 0.02,
    fill: { color: 'FFFFFF', transparency: 60 },
    line: { color: 'FFFFFF', transparency: 100 },
  });

  pptxSlide.addShape('rect', {
    x: (SLIDE_WIDTH_INCHES + 2.2) / 2,
    y: 3.55,
    w: 0.4,
    h: 0.02,
    fill: { color: 'FFFFFF', transparency: 60 },
    line: { color: 'FFFFFF', transparency: 100 },
  });

  // Render subtitle (below divider)
  if (subtitleElement) {
    pptxSlide.addText(subtitleElement.content, {
      x: 0.5,
      y: 3.9,
      w: SLIDE_WIDTH_INCHES - 1,
      h: 0.5,
      fontSize: fontSize('subheading'),
      fontFace: theme.fonts.body,
      color: color(subtitleElement.color || theme.colors.text.inverse),
      align: 'center',
      valign: 'middle',
    });
  }

  // Notes
  if (slide.notes) {
    pptxSlide.addNotes(slide.notes);
  }
}

/**
 * Render content slide with header
 */
async function renderContentSlide(
  pptx: PptxGenJSInstance,
  slide: SlideSchema,
  theme: Theme,
  iconCacheDir?: string
): Promise<number> {
  const pptxSlide = pptx.addSlide();
  let iconCount = 0;

  // Background
  pptxSlide.background = {
    color: color(theme.colors.background.light),
  };

  // Header bar (Z.AI uses 809625 EMU = ~0.85 inches)
  const headerHeight = 0.85;
  if (slide.header) {
    const headerBgColor = slide.header.backgroundColor || theme.colors.primary;

    // Header background
    pptxSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: SLIDE_WIDTH_INCHES,
      h: headerHeight,
      fill: { color: color(headerBgColor) },
      line: { color: color(headerBgColor) },
    });

    // Gradient overlay (Z.AI adds subtle gradient)
    pptxSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: SLIDE_WIDTH_INCHES,
      h: headerHeight,
      fill: { color: color(headerBgColor), transparency: 15 },
      line: { color: color(headerBgColor), transparency: 100 },
    });

    // Bottom accent line (subtle white separator)
    pptxSlide.addShape('rect', {
      x: 0,
      y: headerHeight - 0.02,
      w: SLIDE_WIDTH_INCHES,
      h: 0.02,
      fill: { color: 'FFFFFF', transparency: 85 },
      line: { color: 'FFFFFF', transparency: 100 },
    });

    // Left accent bar
    pptxSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: 0.08,
      h: headerHeight,
      fill: { color: 'FFFFFF', transparency: 80 },
      line: { color: 'FFFFFF', transparency: 100 },
    });

    // Header title
    pptxSlide.addText(slide.header.title, {
      x: 0.5,
      y: 0.12,  // Adjusted for shorter header
      w: SLIDE_WIDTH_INCHES - 1,
      h: 0.6,
      fontSize: fontSize('heading'),
      fontFace: theme.fonts.heading,
      color: color(slide.header.textColor || theme.colors.text.inverse),
      bold: true,
    });

    // Header subtitle
    if (slide.header.subtitle) {
      pptxSlide.addText(slide.header.subtitle, {
        x: 0.5,
        y: 0.6,  // Adjusted for shorter header
        w: SLIDE_WIDTH_INCHES - 1,
        h: 0.25,
        fontSize: fontSize('caption'),
        fontFace: theme.fonts.body,
        color: color(theme.colors.text.inverse),
      });
    }
  }

  // Content area (adjusted for shorter header)
  const contentY = slide.header ? 1.1 : 0.5;
  const contentHeight = SLIDE_HEIGHT_INCHES - contentY - 0.5;

  // Render elements based on layout
  const layout = slide.content.layout || 'flex-column';
  const elements = slide.content.elements;

  if (layout === 'grid-2-column') {
    const columnWidth = (SLIDE_WIDTH_INCHES - 1.5) / 2;
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const column = i % 2;
      const row = Math.floor(i / 2);

      const x = 0.5 + column * (columnWidth + 0.5);
      const y = contentY + row * 2;

      iconCount += await renderElement(pptxSlide, element, theme, x, y, columnWidth, iconCacheDir);
    }
  } else if (layout === 'grid-3-column') {
    const columnWidth = (SLIDE_WIDTH_INCHES - 2) / 3;
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      const column = i % 3;
      const row = Math.floor(i / 3);

      const x = 0.5 + column * (columnWidth + 0.5);
      const y = contentY + row * 2;

      iconCount += await renderElement(pptxSlide, element, theme, x, y, columnWidth, iconCacheDir);
    }
  } else {
    // flex-column layout
    let y = contentY;
    let comparisonRowIndex = 0;
    for (const element of elements) {
      // Track row indices for comparison rows (for striping)
      if (element.type === 'comparison-row') {
        iconCount += await renderComparisonRow(pptxSlide, element, theme, 0.5, y, SLIDE_WIDTH_INCHES - 1, comparisonRowIndex, iconCacheDir);
        comparisonRowIndex++;
        y += 0.7; // Tighter spacing for table rows
      } else {
        iconCount += await renderElement(pptxSlide, element, theme, 0.5, y, SLIDE_WIDTH_INCHES - 1, iconCacheDir);
        y += 1.5; // Normal spacing between elements
        comparisonRowIndex = 0; // Reset for non-comparison elements
      }
    }
  }

  // Bottom callout
  if (slide.content.bottomCallout) {
    iconCount += await renderCallout(pptxSlide, slide.content.bottomCallout, theme, 0.5, SLIDE_HEIGHT_INCHES - 1, SLIDE_WIDTH_INCHES - 1, iconCacheDir);
  }

  // Footer area (Z.AI adds decorative footer elements)
  // Bottom accent line
  pptxSlide.addShape('rect', {
    x: 0,
    y: SLIDE_HEIGHT_INCHES - 0.15,
    w: SLIDE_WIDTH_INCHES,
    h: 0.02,
    fill: { color: color(theme.colors.primary), transparency: 85 },
    line: { color: color(theme.colors.primary), transparency: 100 },
  });

  // Footer background
  pptxSlide.addShape('rect', {
    x: 0,
    y: SLIDE_HEIGHT_INCHES - 0.12,
    w: SLIDE_WIDTH_INCHES,
    h: 0.12,
    fill: { color: color(theme.colors.primary), transparency: 97 },
    line: { color: color(theme.colors.primary), transparency: 100 },
  });

  // Notes
  if (slide.notes) {
    pptxSlide.addNotes(slide.notes);
  }

  return iconCount;
}

// =============================================================================
// Element Renderers
// =============================================================================

/**
 * Render a single element
 */
async function renderElement(
  slide: PptxSlide,
  element: SlideElement,
  theme: Theme,
  x: number,
  y: number,
  width: number,
  iconCacheDir?: string
): Promise<number> {
  let iconCount = 0;

  switch (element.type) {
    case 'text':
      renderTextBlock(slide, element, theme, x, y, width);
      break;

    case 'icon-card':
      iconCount += await renderIconCard(slide, element, theme, x, y, width, iconCacheDir);
      break;

    case 'numbered-item':
      renderNumberedItem(slide, element, theme, x, y, width);
      break;

    case 'callout':
      iconCount += await renderCallout(slide, element, theme, x, y, width, iconCacheDir);
      break;

    case 'badge':
      renderBadge(slide, element, theme, x, y);
      break;

    case 'icon-grid':
      iconCount += await renderIconGrid(slide, element, theme, x, y, width, iconCacheDir);
      break;

    case 'comparison-row':
      // Note: rowIndex tracking happens at layout level
      iconCount += await renderComparisonRow(slide, element, theme, x, y, width, 0, iconCacheDir);
      break;

    case 'image':
      await renderImage(slide, element, x, y, width);
      break;
  }

  return iconCount;
}

/**
 * Render text block
 * Z.AI uses rect shapes for text containers, especially for labels and subheadings
 * Enhanced with background shapes for all text types
 */
function renderTextBlock(
  slide: PptxSlide,
  element: TextBlock,
  theme: Theme,
  x: number,
  y: number,
  width: number
): void {
  const textHeight = element.size === 'heading' ? 0.6 : 0.5;

  // Add background shapes for visual depth
  if (element.size === 'heading') {
    // Heading gets full-width subtle background
    slide.addShape('rect', {
      x,
      y,
      w: width,
      h: textHeight,
      fill: { color: color(theme.colors.primary), transparency: 98 },
      line: { color: color(theme.colors.primary), transparency: 100 },
    });

    // Left accent for heading
    slide.addShape('rect', {
      x,
      y,
      w: 0.05,
      h: textHeight,
      fill: { color: color(theme.colors.primary), transparency: 60 },
      line: { color: color(theme.colors.primary), transparency: 100 },
    });
  } else if (element.size === 'subheading' || element.size === 'caption') {
    // Subheading/caption gets partial width background
    slide.addShape('rect', {
      x,
      y,
      w: width * 0.3,
      h: textHeight,
      fill: { color: color(theme.colors.primary), transparency: 95 },
      line: { color: color(theme.colors.primary), transparency: 100 },
    });
  } else if (element.size === 'body') {
    // Body text gets very subtle background
    slide.addShape('rect', {
      x,
      y,
      w: width * 0.95,
      h: textHeight,
      fill: { color: color(theme.colors.primary), transparency: 99 },
      line: { color: color(theme.colors.primary), transparency: 100 },
    });
  }

  slide.addText(element.content, {
    x,
    y,
    w: width * TEXT_SAFETY_FACTOR,
    h: textHeight,
    fontSize: fontSize(element.size || 'body'),
    fontFace: element.size === 'title' || element.size === 'heading'
      ? theme.fonts.heading
      : theme.fonts.body,
    color: color(element.color || theme.colors.text.dark),
    bold: element.bold,
    align: element.align || 'left',
    valign: 'middle',
  });
}

/**
 * Render icon card (icon + title + description in rounded box)
 * Z.AI structure (slide5):
 * - Outer container (roundRect with border and 5% fill)
 * - Icon background (roundRect, solid fill with primary color)
 * - Icon image
 * - Title text (rect)
 * - Subtitle text (rect)
 * - Detail background (roundRect, 8% fill)
 * - Detail text (rect)
 */
async function renderIconCard(
  slide: PptxSlide,
  element: IconCard,
  theme: Theme,
  x: number,
  y: number,
  width: number,
  iconCacheDir?: string
): Promise<number> {
  const cardHeight = 1.8;
  const iconSize = 0.6;
  const iconBgSize = 0.55;  // Icon background slightly larger
  const padding = 0.2;

  // Card background container (rounded rectangle with border - Z.AI style)
  slide.addShape('roundRect', {
    x,
    y,
    w: width,
    h: cardHeight,
    fill: { color: color(theme.colors.primary), transparency: 95 },  // 5% opacity
    line: { color: color(theme.colors.primary), width: 2.5 },  // Z.AI uses ~2.5pt border
    rectRadius: 0.08,
  });

  // Icon background (roundRect with solid primary color - Z.AI uses fully filled)
  const iconColor = element.iconColor || theme.colors.primary;
  slide.addShape('roundRect', {
    x: x + padding,
    y: y + padding,
    w: iconBgSize,
    h: iconBgSize,
    fill: { color: color(iconColor) },  // Solid fill like Z.AI
    line: { color: color(iconColor), transparency: 100 },
    rectRadius: 0.2,  // High radius for rounded square
  });

  // Render icon
  try {
    const icon = await renderIcon({
      name: element.icon,
      color: iconColor,
      size: 200,
      cacheDir: iconCacheDir,
    });

    slide.addImage({
      data: `data:image/png;base64,${icon.buffer.toString('base64')}`,
      x: x + padding + (iconBgSize - iconSize * 0.7) / 2,  // Center in bg
      y: y + padding + (iconBgSize - iconSize * 0.7) / 2,
      w: iconSize * 0.7,  // Slightly smaller than container
      h: iconSize * 0.7,
    });
  } catch {
    // Fallback: render icon name as text
    slide.addText(element.icon, {
      x: x + padding,
      y: y + padding,
      w: iconBgSize,
      h: iconBgSize,
      fontSize: fontSize('caption'),
      color: color(iconColor),
      align: 'center',
      valign: 'middle',
    });
  }

  // Title background (rect for text container)
  slide.addShape('rect', {
    x: x + iconBgSize + padding * 2,
    y: y + padding,
    w: width - iconBgSize - padding * 3,
    h: 0.5,
    fill: { color: color(theme.colors.primary), transparency: 98 },
    line: { color: color(theme.colors.primary), transparency: 100 },
  });

  // Title (Z.AI uses 20px → 11.96pt for card titles)
  slide.addText(element.title, {
    x: x + iconBgSize + padding * 2,
    y: y + padding,
    w: width - iconBgSize - padding * 3,
    h: 0.5,
    fontSize: fontSize('card-title'),
    fontFace: theme.fonts.heading,
    color: color(iconColor),
    bold: true,
  });

  // Bottom accent (round2SameRect for polish)
  const accentWidth = 0.04;
  slide.addShape('round2SameRect', {
    x: x - (cardHeight * 0.3 - accentWidth) / 2,
    y: y + cardHeight - 0.15 + (cardHeight * 0.3 - accentWidth) / 2,
    w: cardHeight * 0.3,
    h: accentWidth,
    fill: { color: color(iconColor), transparency: 50 },
    line: { color: color(iconColor), transparency: 100 },
    rectRadius: 0.5,
    rotate: 270,
  });

  // Description with background box (Z.AI style)
  if (element.description) {
    const descY = y + cardHeight - 0.9;
    const descH = 0.7;
    const descX = x + padding;
    const descW = width - padding * 2;

    // Description background (roundRect with 8% fill - Z.AI style)
    slide.addShape('roundRect', {
      x: descX,
      y: descY,
      w: descW,
      h: descH,
      fill: { color: color(theme.colors.primary), transparency: 92 },  // 8% opacity
      line: { color: color(theme.colors.primary), transparency: 100 },
      rectRadius: 0.06,
    });

    // Description text
    slide.addText(element.description, {
      x: descX + 0.15,
      y: descY,
      w: descW - 0.3,
      h: descH,
      fontSize: fontSize('card-body'),
      fontFace: theme.fonts.body,
      color: color(theme.colors.text.medium),
      valign: 'middle',
    });
  }

  return 1; // 1 icon rendered
}

/**
 * Render numbered item (for agenda slides)
 * Z.AI uses roundRect for number badges, not ellipse
 * Enhanced with background shapes for visual depth
 */
function renderNumberedItem(
  slide: PptxSlide,
  element: NumberedItem,
  theme: Theme,
  x: number,
  y: number,
  width: number
): void {
  const badgeSize = 0.5;
  const itemHeight = element.description ? 1.0 : 0.5;

  // Item container background (subtle for hover-like effect)
  slide.addShape('rect', {
    x,
    y,
    w: width,
    h: itemHeight,
    fill: { color: color(theme.colors.primary), transparency: 97 },
    line: { color: color(theme.colors.primary), transparency: 100 },
  });

  // Left accent bar (round2SameRect for polish)
  const accentWidth = 0.06;
  slide.addShape('round2SameRect', {
    x: x - (itemHeight - accentWidth) / 2,
    y: y + (itemHeight - accentWidth) / 2,
    w: itemHeight,
    h: accentWidth,
    fill: { color: color(theme.colors.primary), transparency: 70 },
    line: { color: color(theme.colors.primary), transparency: 100 },
    rectRadius: 0.5,
    rotate: 270,
  });

  // Number badge background (extra layer for depth)
  slide.addShape('roundRect', {
    x: x + 0.08,
    y: y - 0.02,
    w: badgeSize + 0.04,
    h: badgeSize + 0.04,
    fill: { color: color(theme.colors.primary), transparency: 30 },
    line: { color: color(theme.colors.primary), transparency: 100 },
    rectRadius: 0.25,
  });

  // Number badge (roundRect with high corner radius for pill shape)
  slide.addShape('roundRect', {
    x: x + 0.1,
    y,
    w: badgeSize,
    h: badgeSize,
    fill: { color: color(theme.colors.primary) },
    line: { color: color(theme.colors.primary), transparency: 100 },
    rectRadius: 0.2,
  });

  // Number text (Z.AI uses 20px for number in badge)
  slide.addText(element.number.toString(), {
    x: x + 0.1,
    y,
    w: badgeSize,
    h: badgeSize,
    fontSize: fontSize('card-title'),
    fontFace: theme.fonts.heading,
    color: color(theme.colors.text.inverse),
    align: 'center',
    valign: 'middle',
    bold: true,
  });

  // Title background (rect for text container)
  slide.addShape('rect', {
    x: x + badgeSize + 0.3,
    y,
    w: width - badgeSize - 0.4,
    h: badgeSize,
    fill: { color: color(theme.colors.primary), transparency: 98 },
    line: { color: color(theme.colors.primary), transparency: 100 },
  });

  // Title (Z.AI uses 22px for agenda item titles)
  slide.addText(element.title, {
    x: x + badgeSize + 0.3,
    y,
    w: width - badgeSize - 0.4,
    h: badgeSize,
    fontSize: fontSize('body'),
    fontFace: theme.fonts.heading,
    color: color(theme.colors.text.dark),
    bold: true,
    valign: 'middle',
  });

  // Description
  if (element.description) {
    // Description background
    slide.addShape('rect', {
      x: x + badgeSize + 0.3,
      y: y + badgeSize,
      w: width - badgeSize - 0.4,
      h: 0.5,
      fill: { color: color(theme.colors.primary), transparency: 96 },
      line: { color: color(theme.colors.primary), transparency: 100 },
    });

    slide.addText(element.description, {
      x: x + badgeSize + 0.3,
      y: y + badgeSize,
      w: width - badgeSize - 0.4,
      h: 0.5,
      fontSize: fontSize('body'),
      fontFace: theme.fonts.body,
      color: color(theme.colors.text.medium),
    });
  }
}

/**
 * Render callout box
 * Z.AI callout structure:
 * - Left border accent (4px colored rectangle)
 * - Light background tint (5-8% opacity)
 * - Icon in left area
 * - Text with optional bold keyword
 */
async function renderCallout(
  slide: PptxSlide,
  element: Callout,
  theme: Theme,
  x: number,
  y: number,
  width: number,
  iconCacheDir?: string
): Promise<number> {
  const variantColors: Record<string, string> = {
    primary: theme.colors.primary,
    positive: theme.colors.positive,
    negative: theme.colors.negative,
    warning: theme.colors.warning,
  };

  const variantIcons: Record<string, string> = {
    primary: 'lightbulb',
    positive: 'check_circle',
    negative: 'warning',
    warning: 'info',
  };

  const accentColor = variantColors[element.variant || 'primary'];
  const iconName = element.icon || variantIcons[element.variant || 'primary'];
  const calloutHeight = 0.9;
  const iconSize = 0.45;
  let iconCount = 0;

  // Callout background (light tint)
  slide.addShape('roundRect', {
    x,
    y,
    w: width,
    h: calloutHeight,
    fill: { color: color(accentColor), transparency: 92 },  // ~8% opacity
    line: { color: color(accentColor), transparency: 100 },
    rectRadius: 0.05,
  });

  // Left border accent (round2SameRect, rotated 270°)
  // Z.AI uses round2SameRect with adj1=50000 (rounded), adj2=0 (straight), rot=270°
  // When rotated 270°, the shape's width becomes visual height
  // Pre-rotation dimensions: w=calloutHeight, h=0.14" (becomes visual w=0.14, h=calloutHeight)
  const accentWidth = 0.14;  // Visual width after rotation
  slide.addShape('round2SameRect', {
    // Position adjusted for rotation around center
    x: x - (calloutHeight - accentWidth) / 2,
    y: y + (calloutHeight - accentWidth) / 2,
    w: calloutHeight,  // Pre-rotation width (becomes visual height)
    h: accentWidth,    // Pre-rotation height (becomes visual width)
    fill: { color: color(accentColor) },
    line: { color: color(accentColor), transparency: 100 },
    rectRadius: 0.5,   // Maps to adj1=50000 (50% = fully rounded on that side)
    rotate: 270,
  });

  // Render icon
  try {
    const icon = await renderIcon({
      name: iconName,
      color: accentColor,
      size: 150,
      cacheDir: iconCacheDir,
    });

    slide.addImage({
      data: `data:image/png;base64,${icon.buffer.toString('base64')}`,
      x: x + 0.15,
      y: y + (calloutHeight - iconSize) / 2,
      w: iconSize,
      h: iconSize,
    });
    iconCount = 1;
  } catch {
    // Fallback - no icon
  }

  // Callout text
  slide.addText(element.text, {
    x: x + 0.7,  // After icon
    y,
    w: width - 0.9,
    h: calloutHeight,
    fontSize: fontSize('body'),
    fontFace: theme.fonts.body,
    color: color(theme.colors.text.dark),
    valign: 'middle',
  });

  return iconCount;
}

/**
 * Render badge
 */
function renderBadge(
  slide: PptxSlide,
  element: Badge,
  theme: Theme,
  x: number,
  y: number
): void {
  const badgeWidth = element.text.length * 0.12 + 0.3;
  const badgeHeight = 0.35;

  slide.addShape('roundRect', {
    x,
    y,
    w: badgeWidth,
    h: badgeHeight,
    fill: { color: color(element.backgroundColor || theme.colors.primary) },
    rectRadius: 0.1,
  });

  slide.addText(element.text, {
    x,
    y,
    w: badgeWidth,
    h: badgeHeight,
    fontSize: fontSize(14), // Small badge text
    fontFace: theme.fonts.body,
    color: color(element.color || theme.colors.text.inverse),
    align: 'center',
    valign: 'middle',
    bold: true,
  });
}

/**
 * Render icon grid
 */
async function renderIconGrid(
  slide: PptxSlide,
  element: IconGrid,
  theme: Theme,
  x: number,
  y: number,
  width: number,
  iconCacheDir?: string
): Promise<number> {
  const columns = element.columns || 3;
  const itemWidth = (width - 0.2 * (columns - 1)) / columns;
  const itemHeight = 1.2;
  let iconCount = 0;

  for (let i = 0; i < element.items.length; i++) {
    const item = element.items[i];
    const col = i % columns;
    const row = Math.floor(i / columns);

    const itemX = x + col * (itemWidth + 0.2);
    const itemY = y + row * (itemHeight + 0.2);

    // Render icon
    try {
      const icon = await renderIcon({
        name: item.icon,
        color: theme.colors.primary,
        size: 150,
        cacheDir: iconCacheDir,
      });

      slide.addImage({
        data: `data:image/png;base64,${icon.buffer.toString('base64')}`,
        x: itemX + (itemWidth - 0.5) / 2,
        y: itemY,
        w: 0.5,
        h: 0.5,
      });
      iconCount++;
    } catch {
      // Fallback
    }

    // Label
    slide.addText(item.label, {
      x: itemX,
      y: itemY + 0.55,
      w: itemWidth,
      h: 0.35,
      fontSize: fontSize('caption'),
      fontFace: theme.fonts.body,
      color: color(theme.colors.text.dark),
      align: 'center',
      bold: true,
    });

    // Description
    if (item.description) {
      slide.addText(item.description, {
        x: itemX,
        y: itemY + 0.85,
        w: itemWidth,
        h: 0.35,
        fontSize: fontSize(14), // Small description text
        fontFace: theme.fonts.body,
        color: color(theme.colors.text.medium),
        align: 'center',
      });
    }
  }

  return iconCount;
}

/**
 * Render comparison row with card-based layout
 * Z.AI comparison structure (slide24):
 * - Each cell is a card with:
 *   - rect background (5% opacity fill)
 *   - round2SameRect left accent (rotated 270°)
 *   - Icon centered
 *   - Text below
 */
async function renderComparisonRow(
  slide: PptxSlide,
  element: ComparisonRow,
  theme: Theme,
  x: number,
  y: number,
  width: number,
  rowIndex: number = 0,
  iconCacheDir?: string
): Promise<number> {
  const labelWidth = 2.8;
  const cellHeight = 0.85;  // Taller for card layout
  const cellGap = 0.15;
  const columnWidth = (width - labelWidth - cellGap * element.columns.length) / element.columns.length;
  const iconSize = 0.28;
  const accentHeight = cellHeight;
  const accentWidth = 0.07;  // Thin accent bar
  let iconCount = 0;

  // Label background (light fill for alternating rows)
  slide.addShape('rect', {
    x,
    y,
    w: labelWidth - cellGap,
    h: cellHeight,
    fill: { color: color(theme.colors.primary), transparency: 95 },  // 5% opacity
    line: { color: color(theme.colors.primary), transparency: 100 },
  });

  // Label text
  slide.addText(element.label, {
    x: x + 0.15,
    y,
    w: labelWidth - 0.3,
    h: cellHeight,
    fontSize: fontSize('card-body'),
    fontFace: theme.fonts.body,
    color: color(theme.colors.primary),
    bold: true,
    valign: 'middle',
  });

  // Columns as card cells
  for (let i = 0; i < element.columns.length; i++) {
    const col = element.columns[i];
    const cellX = x + labelWidth + i * (columnWidth + cellGap);

    // Determine cell color based on sentiment
    const cellColor = col.sentiment === 'positive'
      ? theme.colors.positive
      : col.sentiment === 'negative'
        ? theme.colors.negative
        : theme.colors.primary;

    // Cell background (rect with 5% opacity fill)
    slide.addShape('rect', {
      x: cellX,
      y,
      w: columnWidth,
      h: cellHeight,
      fill: { color: color(cellColor), transparency: 95 },  // 5% opacity
      line: { color: color(cellColor), transparency: 100 },
    });

    // Left accent bar (round2SameRect, rotated 270°)
    // Pre-rotation: w=cellHeight, h=accentWidth. After 270° rotation: visual w=accentWidth, h=cellHeight
    slide.addShape('round2SameRect', {
      x: cellX - (cellHeight - accentWidth) / 2,
      y: y + (cellHeight - accentWidth) / 2,
      w: cellHeight,  // Pre-rotation width (becomes visual height)
      h: accentWidth, // Pre-rotation height (becomes visual width)
      fill: { color: color(cellColor) },
      line: { color: color(cellColor), transparency: 100 },
      rectRadius: 0.5,  // 50% = fully rounded on one side
      rotate: 270,
    });

    if (typeof col.value === 'boolean') {
      // Render icon for boolean values
      const iconName = col.value ? 'check_circle' : 'cancel';
      const iconColor = col.value ? theme.colors.positive : theme.colors.negative;

      try {
        const icon = await renderIcon({
          name: iconName,
          color: iconColor,
          size: 120,
          cacheDir: iconCacheDir,
        });

        slide.addImage({
          data: `data:image/png;base64,${icon.buffer.toString('base64')}`,
          x: cellX + (columnWidth - iconSize) / 2,
          y: y + (cellHeight - iconSize) / 2,
          w: iconSize,
          h: iconSize,
        });
        iconCount++;
      } catch {
        // Fallback to text symbol
        const symbol = col.value ? '✓' : '✗';
        slide.addText(symbol, {
          x: cellX,
          y,
          w: columnWidth,
          h: cellHeight,
          fontSize: fontSize('body'),
          fontFace: theme.fonts.body,
          color: color(iconColor),
          align: 'center',
          valign: 'middle',
          bold: true,
        });
      }
    } else {
      // Text value with sentiment coloring
      const textColor = col.sentiment === 'positive'
        ? theme.colors.positive
        : col.sentiment === 'negative'
          ? theme.colors.negative
          : theme.colors.text.medium;

      slide.addText(col.value, {
        x: cellX + 0.1,
        y,
        w: columnWidth - 0.2,
        h: cellHeight,
        fontSize: fontSize('card-body'),
        fontFace: theme.fonts.body,
        color: color(textColor),
        align: 'center',
        valign: 'middle',
      });
    }
  }

  return iconCount;
}

/**
 * Render image element
 */
async function renderImage(
  slide: PptxSlide,
  element: ImageElement,
  x: number,
  y: number,
  width: number
): Promise<void> {
  const bounds = element.bounds || { x: 0, y: 0, width: 400, height: 300 };

  slide.addImage({
    path: element.src,
    x: x + pxToInches(bounds.x),
    y: y + pxToInches(bounds.y),
    w: pxToInches(bounds.width),
    h: pxToInches(bounds.height),
  });
}

// =============================================================================
// Main Render Function
// =============================================================================

/**
 * Render a deck to PPTX
 *
 * @example
 * ```ts
 * const result = await renderPptx(deck, {
 *   outputPath: 'output/presentation.pptx',
 * });
 * console.log(`Generated ${result.slideCount} slides with ${result.iconCount} icons`);
 * ```
 */
export async function renderPptx(
  deck: Deck,
  options: PptxRenderOptions = {}
): Promise<RenderResult> {
  const { outputPath, includeNotes = true, iconCacheDir } = options;

  // Create presentation
  const pptx = new PptxGenJSConstructor();

  // Set presentation properties
  pptx.author = deck.author || 'Magic Slides';
  pptx.title = deck.title;
  pptx.subject = deck.title;
  pptx.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"

  // Define slide master with theme
  pptx.defineSlideMaster({
    title: 'MAGIC_SLIDES',
    background: { color: color(deck.theme.colors.background.light) },
  });

  let iconCount = 0;

  // Render each slide
  for (const slide of deck.slides) {
    switch (slide.slideType) {
      case 'title':
      case 'closing':
        await renderTitleSlide(pptx, slide, deck.theme, deck);
        break;

      case 'section':
        await renderSectionSlide(pptx, slide, deck.theme);
        break;

      default:
        iconCount += await renderContentSlide(pptx, slide, deck.theme, iconCacheDir);
        break;
    }
  }

  // Generate output
  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;

  let filePath: string | undefined;
  if (outputPath) {
    const fs = await import('fs');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    await fs.promises.mkdir(dir, { recursive: true });

    // Write file
    await fs.promises.writeFile(outputPath, buffer);
    filePath = outputPath;
  }

  return {
    buffer,
    filePath,
    iconCount,
    slideCount: deck.slides.length,
  };
}

/**
 * Render a single slide (for testing)
 */
export async function renderSingleSlide(
  slide: SlideSchema,
  theme: Theme,
  options: PptxRenderOptions = {}
): Promise<RenderResult> {
  const deck: Deck = {
    id: 'single-slide',
    title: slide.header?.title || 'Slide',
    theme,
    slides: [slide],
  };

  return renderPptx(deck, options);
}
