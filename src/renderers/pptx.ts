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
import {
  SLIDE,
  MARGIN,
  HEADER,
  CONTENT,
  ICON_CARD,
  BOTTOM_CALLOUT,
  FONT_SIZE,
  getTwoColumnLayout,
  getIconCardLayout,
} from '../utils/zai-layout.js';

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
 * Render title slide - Z.AI MINIMAL APPROACH
 * Z.AI structure (slide1.xml):
 * 1. Solid background color
 * 2. ONE gradient overlay rectangle (95%→85% alpha)
 * 3. Title text (sz=4305, centered, bold)
 * 4. Divider line (white, 80% opacity)
 * 5. Subtitle text (sz=1435)
 * 6. Attribution text (sz=1196)
 * 7. Footer text (sz=956)
 *
 * NO: side decorative elements, multiple gradient layers, accent bars
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

  // Z.AI: ONE gradient overlay (not multiple)
  pptxSlide.addShape('rect', {
    x: 0,
    y: 0,
    w: SLIDE_WIDTH_INCHES,
    h: SLIDE_HEIGHT_INCHES,
    fill: { color: color(bgColor), transparency: 10 },
    line: { color: color(bgColor), transparency: 100 },
  });

  // Find title and subtitle elements
  const titleElement = slide.content.elements.find(
    (el): el is TextBlock => el.type === 'text' && el.size === 'title'
  );
  const subtitleElement = slide.content.elements.find(
    (el): el is TextBlock => el.type === 'text' && el.size === 'body'
  );

  // Title text (centered)
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

  // Divider line (white, 80% opacity)
  pptxSlide.addShape('rect', {
    x: (SLIDE_WIDTH_INCHES - 1.5) / 2,
    y: 3.5,
    w: 1.5,
    h: 0.04,
    fill: { color: 'FFFFFF', transparency: 20 },
    line: { color: 'FFFFFF', transparency: 100 },
  });

  // Subtitle text
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

  // Attribution (if available)
  if (deck?.client) {
    pptxSlide.addText(`Prepared for ${deck.client}`, {
      x: 0.5,
      y: 5.0,
      w: SLIDE_WIDTH_INCHES - 1,
      h: 0.4,
      fontSize: fontSize('card-title'),
      fontFace: theme.fonts.body,
      color: 'F3F4F6',
      align: 'center',
      valign: 'middle',
    });
  }

  // Footer
  const footerText = deck?.author
    ? `${deck.author} | ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  pptxSlide.addText(footerText, {
    x: 0,
    y: SLIDE_HEIGHT_INCHES - 0.5,
    w: SLIDE_WIDTH_INCHES,
    h: 0.35,
    fontSize: fontSize('caption'),
    fontFace: theme.fonts.body,
    color: color(theme.colors.text.inverse),
    align: 'center',
    valign: 'middle',
  });

  if (slide.notes) {
    pptxSlide.addNotes(slide.notes);
  }
}

/**
 * Render section divider slide - Z.AI MINIMAL APPROACH
 * Z.AI structure (slide3.xml, slide6.xml):
 * 1. Solid background color
 * 2. Title text (sz=4305, centered, bold)
 * 3. Divider line (white, 60% opacity)
 * 4. Subtitle text (sz=1794, centered)
 *
 * NO: gradient overlays, decorative bands, title background, accent lines
 */
async function renderSectionSlide(
  pptx: PptxGenJSInstance,
  slide: SlideSchema,
  theme: Theme
): Promise<void> {
  const pptxSlide = pptx.addSlide();

  // Solid background only
  const bgColor = slide.background?.type === 'solid' && slide.background.color
    ? slide.background.color
    : theme.colors.primary;

  pptxSlide.background = { color: color(bgColor) };

  // Find title and subtitle elements
  const titleElement = slide.content.elements.find(
    (el): el is TextBlock => el.type === 'text' && (el.size === 'title' || el.size === 'heading')
  );
  const subtitleElement = slide.content.elements.find(
    (el): el is TextBlock => el.type === 'text' && el.size !== 'title' && el.size !== 'heading'
  );

  // Title text (centered)
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

  // Divider line (white, 60% opacity)
  pptxSlide.addShape('rect', {
    x: (SLIDE_WIDTH_INCHES - 1.8) / 2,
    y: 3.6,
    w: 1.8,
    h: 0.04,
    fill: { color: 'FFFFFF', transparency: 40 },
    line: { color: 'FFFFFF', transparency: 100 },
  });

  // Subtitle text
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

  if (slide.notes) {
    pptxSlide.addNotes(slide.notes);
  }
}

/**
 * Render content slide with header - Z.AI MINIMAL APPROACH
 * Z.AI structure (slide5.xml):
 * 1. Solid white background
 * 2. Header bar (rect, solid primary color)
 * 3. Header title text (sz=2392, bold, white)
 * 4. Content elements
 *
 * NO: gradient overlays, accent lines, left accent bars, footer decorations
 */
async function renderContentSlide(
  pptx: PptxGenJSInstance,
  slide: SlideSchema,
  theme: Theme,
  iconCacheDir?: string
): Promise<number> {
  const pptxSlide = pptx.addSlide();
  let iconCount = 0;

  // Solid background
  pptxSlide.background = {
    color: color(theme.colors.background.light),
  };

  // Header bar (Z.AI uses 809625 EMU = ~0.85 inches, solid fill only)
  const headerHeight = 0.85;
  if (slide.header) {
    const headerBgColor = slide.header.backgroundColor || theme.colors.primary;

    // Header background - JUST ONE RECT, no overlays
    pptxSlide.addShape('rect', {
      x: 0,
      y: 0,
      w: SLIDE_WIDTH_INCHES,
      h: headerHeight,
      fill: { color: color(headerBgColor) },
      line: { color: color(headerBgColor), transparency: 100 },
    });

    // Header title
    pptxSlide.addText(slide.header.title, {
      x: 0.5,
      y: 0.12,
      w: SLIDE_WIDTH_INCHES - 1,
      h: 0.6,
      fontSize: fontSize('heading'),
      fontFace: theme.fonts.heading,
      color: color(slide.header.textColor || theme.colors.text.inverse),
      bold: true,
    });

    // Header subtitle (if present)
    if (slide.header.subtitle) {
      pptxSlide.addText(slide.header.subtitle, {
        x: 0.5,
        y: 0.6,
        w: SLIDE_WIDTH_INCHES - 1,
        h: 0.25,
        fontSize: fontSize('caption'),
        fontFace: theme.fonts.body,
        color: color(theme.colors.text.inverse),
      });
    }
  }

  // Content area
  const contentY = slide.header ? 1.1 : 0.5;

  // Render elements based on layout
  const layout = slide.content.layout || 'flex-column';
  const elements = slide.content.elements;

  if (layout === 'grid-2-column') {
    // Z.AI-style 2-column layout:
    // - Text elements span full width (subtitles/descriptions)
    // - Icon-cards go in 2-column pairs
    // - Callouts span full width
    const leftMargin = MARGIN.HORIZONTAL;
    const contentWidth = SLIDE_WIDTH_INCHES - leftMargin * 2;
    const columnWidth = (contentWidth - 0.4) / 2;
    const columnGap = 0.4;

    let y = contentY;
    let iconCardCount = 0;

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];

      if (element.type === 'text') {
        // Text spans full width at current y
        iconCount += await renderElement(pptxSlide, element, theme, leftMargin, y, contentWidth, iconCacheDir);
        y += 0.6; // Compact spacing after subtitle
      } else if (element.type === 'icon-card') {
        // Icon-cards go in 2-column grid
        const column = iconCardCount % 2;
        const x = leftMargin + column * (columnWidth + columnGap);

        // Start new row on first column
        if (column === 0 && iconCardCount > 0) {
          y += 2.5; // Row spacing
        }

        iconCount += await renderElement(pptxSlide, element, theme, x, y, columnWidth, iconCacheDir);
        iconCardCount++;
      } else if (element.type === 'callout') {
        // Callouts span full width, advance y if we had icon-cards
        if (iconCardCount > 0) {
          y += 2.5; // Clear the icon-card row
          iconCardCount = 0;
        }
        iconCount += await renderElement(pptxSlide, element, theme, leftMargin, y, contentWidth, iconCacheDir);
        y += 1.0;
      } else {
        // Other elements (numbered-item, comparison-row, etc.) span full width
        if (iconCardCount > 0) {
          y += 2.5;
          iconCardCount = 0;
        }
        iconCount += await renderElement(pptxSlide, element, theme, leftMargin, y, contentWidth, iconCacheDir);
        y += 1.5;
      }
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
      if (element.type === 'comparison-row') {
        iconCount += await renderComparisonRow(pptxSlide, element, theme, 0.5, y, SLIDE_WIDTH_INCHES - 1, comparisonRowIndex, iconCacheDir);
        comparisonRowIndex++;
        y += 0.7;
      } else {
        iconCount += await renderElement(pptxSlide, element, theme, 0.5, y, SLIDE_WIDTH_INCHES - 1, iconCacheDir);
        y += 1.5;
        comparisonRowIndex = 0;
      }
    }
  }

  // Bottom callout
  if (slide.content.bottomCallout) {
    iconCount += await renderCallout(pptxSlide, slide.content.bottomCallout, theme, 0.5, SLIDE_HEIGHT_INCHES - 1, SLIDE_WIDTH_INCHES - 1, iconCacheDir);
  }

  // NO footer decorations - Z.AI doesn't add them

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
 * Render text block - Z.AI MINIMAL APPROACH
 * Z.AI uses TextBox elements with noFill - NO background shapes for text
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

  // Z.AI: Just text, no background shapes
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
 * Render icon card - Z.AI STYLE
 * Handles multi-line descriptions by rendering each line as a separate item
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
  const iconBgSize = ICON_CARD.ICON_BG_SIZE;
  const padding = 0.25;
  const iconColor = element.iconColor || theme.colors.primary;

  // Parse description lines to determine card height
  const descLines = element.description
    ? element.description.split('\n').filter(l => l.trim())
    : [];
  const lineHeight = 0.4;
  const headerHeight = iconBgSize + 0.15;

  // Z.AI uses ~3.5" for cards with multiple attribute lines
  const minHeight = 1.4;
  const descAreaHeight = descLines.length > 0 ? 0.5 + descLines.length * lineHeight : 0;
  const cardHeight = Math.max(minHeight, headerHeight + descAreaHeight + 0.3);

  // Card container (roundRect with border) - Z.AI uses 2.6pt border
  slide.addShape('roundRect', {
    x,
    y,
    w: width,
    h: cardHeight,
    fill: { color: color(theme.colors.primary), transparency: 95 },
    line: { color: color(theme.colors.primary), width: 2.6 },
    rectRadius: 0.07,
  });

  // Icon background (roundRect, solid fill)
  slide.addShape('roundRect', {
    x: x + padding,
    y: y + padding,
    w: iconBgSize,
    h: iconBgSize,
    fill: { color: color(iconColor) },
    line: { color: color(iconColor), transparency: 100 },
    rectRadius: 0.35,
  });

  // Icon image
  const iconDisplaySize = iconBgSize * 0.6;
  try {
    const icon = await renderIcon({
      name: element.icon,
      color: iconColor,
      size: 200,
      cacheDir: iconCacheDir,
    });

    slide.addImage({
      data: `data:image/png;base64,${icon.buffer.toString('base64')}`,
      x: x + padding + (iconBgSize - iconDisplaySize) / 2,
      y: y + padding + (iconBgSize - iconDisplaySize) / 2,
      w: iconDisplaySize,
      h: iconDisplaySize,
    });
  } catch {
    slide.addText(element.icon, {
      x: x + padding,
      y: y + padding,
      w: iconBgSize,
      h: iconBgSize,
      fontSize: FONT_SIZE.DETAIL,
      color: color(iconColor),
      align: 'center',
      valign: 'middle',
    });
  }

  // Title text (Z.AI uses sz=1794 → 17.94pt)
  slide.addText(element.title, {
    x: x + iconBgSize + padding * 2,
    y: y + padding,
    w: width - iconBgSize - padding * 3,
    h: 0.35,
    fontSize: FONT_SIZE.CARD_TITLE,
    fontFace: theme.fonts.heading,
    color: color(iconColor),
    bold: true,
  });

  // Subtitle/first line description next to icon
  if (descLines.length > 0) {
    slide.addText(descLines[0], {
      x: x + iconBgSize + padding * 2,
      y: y + padding + 0.35,
      w: width - iconBgSize - padding * 3,
      h: 0.3,
      fontSize: FONT_SIZE.DETAIL,
      fontFace: theme.fonts.body,
      color: color(theme.colors.text.medium),
    });
  }

  // Remaining description lines as individual items
  if (descLines.length > 1) {
    const itemsStartY = y + headerHeight + 0.1;
    const itemX = x + padding;
    const itemW = width - padding * 2;

    for (let i = 1; i < descLines.length; i++) {
      const line = descLines[i];
      const itemY = itemsStartY + (i - 1) * lineHeight;

      // Determine line color based on content
      let lineColor = theme.colors.text.medium;
      let bgColor = theme.colors.primary;
      let bgTransparency = 92;

      if (line.toLowerCase().includes('immutable') || line.includes('= true')) {
        lineColor = theme.colors.positive;
        bgColor = theme.colors.positive;
        bgTransparency = 85;
      } else if (line.toLowerCase().includes('can change') || line.toLowerCase().includes('changeable')) {
        lineColor = theme.colors.warning || '#FFAB40';
        bgColor = theme.colors.warning || '#FFAB40';
        bgTransparency = 85;
      } else if (line.includes('= false')) {
        lineColor = theme.colors.text.medium;
      }

      // Background for line
      slide.addShape('roundRect', {
        x: itemX,
        y: itemY,
        w: itemW,
        h: lineHeight - 0.05,
        fill: { color: color(bgColor), transparency: bgTransparency },
        line: { color: color(bgColor), transparency: 100 },
        rectRadius: 0.05,
      });

      // Line text
      slide.addText(line, {
        x: itemX + 0.15,
        y: itemY,
        w: itemW - 0.3,
        h: lineHeight - 0.05,
        fontSize: FONT_SIZE.DETAIL,
        fontFace: theme.fonts.body,
        color: color(lineColor),
        valign: 'middle',
        bold: line.toLowerCase().includes('immutable') || line.toLowerCase().includes('can change'),
      });
    }
  }

  return 1;
}

/**
 * Render numbered item - Z.AI MINIMAL APPROACH
 * Z.AI uses:
 * - roundRect badge (solid primary)
 * - number text (white)
 * - title text (no background)
 * - description text (no background)
 *
 * NO: container background, left accent bar, badge glow, title/desc backgrounds
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

  // Number badge (roundRect, solid primary)
  slide.addShape('roundRect', {
    x: x + 0.1,
    y,
    w: badgeSize,
    h: badgeSize,
    fill: { color: color(theme.colors.primary) },
    line: { color: color(theme.colors.primary), transparency: 100 },
    rectRadius: 0.2,
  });

  // Number text
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

  // Title text (no background)
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

  // Description (no background)
  if (element.description) {
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
 * Render callout box - Z.AI STYLE
 * Z.AI structure:
 * - roundRect background (12% opacity)
 * - round2SameRect left accent bar
 * - icon in circle
 * - title text (bold)
 * - description text (optional)
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
  const calloutHeight = 0.95;
  const iconSize = 0.4;
  let iconCount = 0;

  // Callout background (roundRect, 12% opacity like Z.AI)
  slide.addShape('roundRect', {
    x,
    y,
    w: width,
    h: calloutHeight,
    fill: { color: color(accentColor), transparency: 88 },
    line: { color: color(accentColor), transparency: 100 },
    rectRadius: 0.1,
  });

  // Left accent bar (round2SameRect) - Z.AI signature element
  const accentWidth = 0.12;
  slide.addShape('roundRect', {
    x,
    y,
    w: accentWidth,
    h: calloutHeight,
    fill: { color: color(accentColor) },
    line: { color: color(accentColor), transparency: 100 },
    rectRadius: 0.06,
  });

  // Icon
  try {
    const icon = await renderIcon({
      name: iconName,
      color: accentColor,
      size: 150,
      cacheDir: iconCacheDir,
    });

    slide.addImage({
      data: `data:image/png;base64,${icon.buffer.toString('base64')}`,
      x: x + 0.3,
      y: y + (calloutHeight - iconSize) / 2,
      w: iconSize,
      h: iconSize,
    });
    iconCount = 1;
  } catch {
    // Fallback - no icon
  }

  // Callout text (bold)
  slide.addText(element.text, {
    x: x + 0.85,
    y,
    w: width - 1.0,
    h: calloutHeight,
    fontSize: fontSize('body'),
    fontFace: theme.fonts.body,
    color: color(theme.colors.text.dark),
    bold: true,
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
 * Render comparison row - Z.AI MINIMAL APPROACH
 * Simplified structure:
 * - Label cell (rect background + text)
 * - Column cells (rect background + icon or text)
 *
 * NO: round2SameRect left accent bars per cell
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
  const cellHeight = 0.85;
  const cellGap = 0.15;
  const columnWidth = (width - labelWidth - cellGap * element.columns.length) / element.columns.length;
  const iconSize = 0.28;
  let iconCount = 0;

  // Label cell background
  slide.addShape('rect', {
    x,
    y,
    w: labelWidth - cellGap,
    h: cellHeight,
    fill: { color: color(theme.colors.primary), transparency: 95 },
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

  // Column cells
  for (let i = 0; i < element.columns.length; i++) {
    const col = element.columns[i];
    const cellX = x + labelWidth + i * (columnWidth + cellGap);

    const cellColor = col.sentiment === 'positive'
      ? theme.colors.positive
      : col.sentiment === 'negative'
        ? theme.colors.negative
        : theme.colors.primary;

    // Cell background
    slide.addShape('rect', {
      x: cellX,
      y,
      w: columnWidth,
      h: cellHeight,
      fill: { color: color(cellColor), transparency: 95 },
      line: { color: color(cellColor), transparency: 100 },
    });

    if (typeof col.value === 'boolean') {
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
