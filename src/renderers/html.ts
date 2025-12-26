/**
 * HTML Renderer
 *
 * Generates HTML slides for browser preview
 * Uses inline Tailwind-style CSS for consistent rendering
 *
 * @see data/z-ai-research/Z-AI-RESEARCH-SUMMARY.md
 */

import type {
  Deck,
  Slide,
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
  BackgroundConfig,
} from '../schema/slide.js';

// =============================================================================
// Types
// =============================================================================

export interface HtmlRenderOptions {
  /** Include Tailwind CDN link */
  includeTailwind?: boolean;
  /** Include Google Fonts links */
  includeFonts?: boolean;
  /** Generate standalone HTML (with full document) */
  standalone?: boolean;
  /** Slide index to render (for single slide) */
  slideIndex?: number;
}

export interface RenderedHtml {
  /** Full HTML string */
  html: string;
  /** Individual slide HTML snippets */
  slides: string[];
  /** CSS styles */
  styles: string;
}

// =============================================================================
// Constants
// =============================================================================

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;

const FONT_SIZES: Record<string, string> = {
  title: '72px',
  heading: '40px',
  subheading: '30px',
  body: '22px',
  caption: '14px',
};

// =============================================================================
// CSS Generation
// =============================================================================

/**
 * Generate CSS variables from theme
 */
function generateThemeCss(theme: Theme): string {
  return `
    :root {
      --color-primary: ${theme.colors.primary};
      --color-positive: ${theme.colors.positive};
      --color-negative: ${theme.colors.negative};
      --color-warning: ${theme.colors.warning};
      --color-text-dark: ${theme.colors.text.dark};
      --color-text-medium: ${theme.colors.text.medium};
      --color-text-light: ${theme.colors.text.light};
      --color-text-inverse: ${theme.colors.text.inverse};
      --color-bg-white: ${theme.colors.background.white};
      --color-bg-light: ${theme.colors.background.light};
      --color-bg-dark: ${theme.colors.background.dark};
      --font-heading: '${theme.fonts.heading}', sans-serif;
      --font-body: '${theme.fonts.body}', sans-serif;
      ${theme.fonts.special ? `--font-special: '${theme.fonts.special}', monospace;` : ''}
    }
  `;
}

/**
 * Generate base slide styles
 */
function generateBaseCss(): string {
  return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .slide {
      width: ${SLIDE_WIDTH}px;
      height: ${SLIDE_HEIGHT}px;
      position: relative;
      overflow: hidden;
      font-family: var(--font-body);
    }

    .slide-title {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 40px;
    }

    .slide-content {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .slide-header {
      padding: 24px 40px;
      color: var(--color-text-inverse);
    }

    .slide-header h1 {
      font-family: var(--font-heading);
      font-size: ${FONT_SIZES.heading};
      font-weight: 700;
      margin-bottom: 8px;
    }

    .slide-header p {
      font-size: ${FONT_SIZES.caption};
      opacity: 0.9;
    }

    .slide-body {
      flex: 1;
      padding: 24px 40px;
      background: var(--color-bg-light);
    }

    .layout-grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }

    .layout-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }

    .layout-flex {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Element Styles */
    .icon-card {
      background: var(--color-bg-white);
      border: 1px solid #E0E0E0;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      gap: 16px;
    }

    .icon-card-icon {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
    }

    .icon-card-content h3 {
      font-family: var(--font-heading);
      font-size: 24px;
      font-weight: 700;
      color: var(--color-text-dark);
      margin-bottom: 8px;
    }

    .icon-card-content p {
      font-size: 18px;
      color: var(--color-text-medium);
      line-height: 1.5;
    }

    .numbered-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }

    .numbered-item-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--color-primary);
      color: var(--color-text-inverse);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-heading);
      font-weight: 700;
      font-size: 20px;
      flex-shrink: 0;
    }

    .numbered-item-content h3 {
      font-family: var(--font-heading);
      font-size: 24px;
      font-weight: 700;
      color: var(--color-text-dark);
    }

    .numbered-item-content p {
      font-size: 18px;
      color: var(--color-text-medium);
      margin-top: 4px;
    }

    .callout {
      border-radius: 8px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .callout-primary {
      background: rgba(var(--color-primary-rgb, 19, 72, 122), 0.1);
      border: 2px solid var(--color-primary);
    }

    .callout-positive {
      background: rgba(80, 180, 50, 0.1);
      border: 2px solid var(--color-positive);
    }

    .callout-negative {
      background: rgba(237, 86, 27, 0.1);
      border: 2px solid var(--color-negative);
    }

    .callout-warning {
      background: rgba(255, 171, 64, 0.1);
      border: 2px solid var(--color-warning);
    }

    .badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .icon-grid {
      display: grid;
      gap: 24px;
    }

    .icon-grid-item {
      text-align: center;
    }

    .icon-grid-item img {
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }

    .icon-grid-item h4 {
      font-family: var(--font-heading);
      font-size: 16px;
      font-weight: 700;
      color: var(--color-text-dark);
    }

    .icon-grid-item p {
      font-size: 14px;
      color: var(--color-text-medium);
    }

    .comparison-row {
      display: grid;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #E0E0E0;
    }

    .comparison-label {
      font-weight: 500;
      color: var(--color-text-dark);
    }

    .comparison-cell {
      text-align: center;
    }

    .check-positive {
      color: var(--color-positive);
      font-size: 24px;
    }

    .check-negative {
      color: var(--color-negative);
      font-size: 24px;
    }

    .text-block {
      line-height: 1.5;
    }

    .text-title {
      font-family: var(--font-heading);
      font-size: ${FONT_SIZES.title};
      font-weight: 700;
    }

    .text-heading {
      font-family: var(--font-heading);
      font-size: ${FONT_SIZES.heading};
      font-weight: 700;
    }

    .text-subheading {
      font-size: ${FONT_SIZES.subheading};
    }

    .text-body {
      font-size: ${FONT_SIZES.body};
    }

    .text-caption {
      font-size: ${FONT_SIZES.caption};
    }
  `;
}

/**
 * Generate Google Fonts link
 */
function generateFontsLink(theme: Theme): string {
  const fonts = new Set([theme.fonts.heading, theme.fonts.body]);
  if (theme.fonts.special) fonts.add(theme.fonts.special);

  const fontQuery = Array.from(fonts)
    .map((f) => f.replace(/ /g, '+') + ':wght@400;700')
    .join('&family=');

  return `<link href="https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap" rel="stylesheet">`;
}

// =============================================================================
// Background Rendering
// =============================================================================

/**
 * Generate background CSS
 */
function renderBackground(bg?: BackgroundConfig, defaultColor: string = '#F5F5F5'): string {
  if (!bg) {
    return `background-color: ${defaultColor};`;
  }

  switch (bg.type) {
    case 'solid':
      return `background-color: ${bg.color || defaultColor};`;

    case 'gradient':
      if (bg.gradient) {
        return `background: linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to});`;
      }
      return `background-color: ${defaultColor};`;

    case 'image':
      if (bg.image) {
        let style = `background-image: url('${bg.image.url}'); background-size: cover; background-position: center;`;
        if (bg.image.overlay) {
          style += ` position: relative;`;
        }
        return style;
      }
      return `background-color: ${defaultColor};`;

    default:
      return `background-color: ${defaultColor};`;
  }
}

// =============================================================================
// Element Rendering
// =============================================================================

/**
 * Render a slide element to HTML
 */
function renderElement(element: SlideElement, theme: Theme): string {
  switch (element.type) {
    case 'text':
      return renderTextBlock(element, theme);
    case 'icon-card':
      return renderIconCard(element, theme);
    case 'numbered-item':
      return renderNumberedItem(element, theme);
    case 'callout':
      return renderCallout(element, theme);
    case 'badge':
      return renderBadge(element, theme);
    case 'icon-grid':
      return renderIconGrid(element, theme);
    case 'comparison-row':
      return renderComparisonRow(element, theme);
    case 'image':
      return renderImage(element);
    default:
      return '';
  }
}

function renderTextBlock(element: TextBlock, theme: Theme): string {
  const sizeClass = element.size ? `text-${element.size}` : 'text-body';
  const alignStyle = element.align ? `text-align: ${element.align};` : '';
  const colorStyle = element.color ? `color: ${element.color};` : '';
  const boldStyle = element.bold ? 'font-weight: 700;' : '';

  return `
    <div class="text-block ${sizeClass}" style="${alignStyle} ${colorStyle} ${boldStyle}">
      ${escapeHtml(element.content)}
    </div>
  `;
}

function renderIconCard(element: IconCard, theme: Theme): string {
  const iconUrl = `https://api.iconify.design/mdi/${element.icon}.svg?color=${encodeURIComponent(element.iconColor || theme.colors.primary)}`;

  return `
    <div class="icon-card" style="${element.backgroundColor ? `background: ${element.backgroundColor};` : ''}">
      <img class="icon-card-icon" src="${iconUrl}" alt="${element.icon}">
      <div class="icon-card-content">
        <h3>${escapeHtml(element.title)}</h3>
        ${element.description ? `<p>${escapeHtml(element.description)}</p>` : ''}
      </div>
    </div>
  `;
}

function renderNumberedItem(element: NumberedItem, theme: Theme): string {
  return `
    <div class="numbered-item">
      <div class="numbered-item-circle">${element.number}</div>
      <div class="numbered-item-content">
        <h3>${escapeHtml(element.title)}</h3>
        ${element.description ? `<p>${escapeHtml(element.description)}</p>` : ''}
      </div>
    </div>
  `;
}

function renderCallout(element: Callout, theme: Theme): string {
  const variant = element.variant || 'primary';
  const iconUrl = element.icon
    ? `https://api.iconify.design/mdi/${element.icon}.svg?color=${encodeURIComponent(theme.colors[variant as keyof typeof theme.colors] as string || theme.colors.primary)}`
    : '';

  return `
    <div class="callout callout-${variant}">
      ${element.icon ? `<img src="${iconUrl}" alt="${element.icon}" width="24" height="24">` : ''}
      <span>${escapeHtml(element.text)}</span>
    </div>
  `;
}

function renderBadge(element: Badge, theme: Theme): string {
  const bgColor = element.backgroundColor || theme.colors.primary;
  const textColor = element.color || theme.colors.text.inverse;

  return `
    <span class="badge" style="background: ${bgColor}; color: ${textColor};">
      ${escapeHtml(element.text)}
    </span>
  `;
}

function renderIconGrid(element: IconGrid, theme: Theme): string {
  const columns = element.columns || 3;
  const items = element.items
    .map((item) => {
      const iconUrl = `https://api.iconify.design/mdi/${item.icon}.svg?color=${encodeURIComponent(theme.colors.primary)}`;
      return `
        <div class="icon-grid-item">
          <img src="${iconUrl}" alt="${item.icon}">
          <h4>${escapeHtml(item.label)}</h4>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
        </div>
      `;
    })
    .join('');

  return `
    <div class="icon-grid" style="grid-template-columns: repeat(${columns}, 1fr);">
      ${items}
    </div>
  `;
}

function renderComparisonRow(element: ComparisonRow, theme: Theme): string {
  const columns = element.columns
    .map((col) => {
      if (typeof col.value === 'boolean') {
        const icon = col.value ? '✓' : '✗';
        const cls = col.value ? 'check-positive' : 'check-negative';
        return `<div class="comparison-cell ${cls}">${icon}</div>`;
      }
      const sentimentColor =
        col.sentiment === 'positive'
          ? theme.colors.positive
          : col.sentiment === 'negative'
            ? theme.colors.negative
            : 'inherit';
      return `<div class="comparison-cell" style="color: ${sentimentColor};">${escapeHtml(col.value)}</div>`;
    })
    .join('');

  return `
    <div class="comparison-row" style="grid-template-columns: 200px repeat(${element.columns.length}, 1fr);">
      <div class="comparison-label">${escapeHtml(element.label)}</div>
      ${columns}
    </div>
  `;
}

function renderImage(element: ImageElement): string {
  const style = element.bounds
    ? `width: ${element.bounds.width}px; height: ${element.bounds.height}px;`
    : '';
  const borderRadius = element.borderRadius ? `border-radius: ${element.borderRadius}px;` : '';

  return `
    <img src="${element.src}" alt="${element.alt || ''}" style="${style} ${borderRadius} object-fit: cover;">
  `;
}

// =============================================================================
// Slide Rendering
// =============================================================================

/**
 * Render a single slide to HTML
 */
function renderSlide(slide: Slide, theme: Theme): string {
  const bgStyle = renderBackground(slide.background, theme.colors.background.light);

  if (slide.slideType === 'title' || slide.slideType === 'closing') {
    return renderTitleSlide(slide, theme, bgStyle);
  }

  return renderContentSlide(slide, theme, bgStyle);
}

function renderTitleSlide(slide: Slide, theme: Theme, bgStyle: string): string {
  const elements = slide.content.elements.map((el) => renderElement(el, theme)).join('');

  return `
    <div class="slide slide-title" style="${bgStyle}">
      ${elements}
    </div>
  `;
}

function renderContentSlide(slide: Slide, theme: Theme, bgStyle: string): string {
  const headerBg = slide.header?.backgroundColor || theme.colors.primary;
  const headerText = slide.header?.textColor || theme.colors.text.inverse;

  const layoutClass =
    slide.content.layout === 'grid-2-column'
      ? 'layout-grid-2'
      : slide.content.layout === 'grid-3-column'
        ? 'layout-grid-3'
        : 'layout-flex';

  const elements = slide.content.elements.map((el) => renderElement(el, theme)).join('');

  const bottomCallout = slide.content.bottomCallout
    ? `<div class="slide-bottom-callout">${renderCallout(slide.content.bottomCallout, theme)}</div>`
    : '';

  return `
    <div class="slide slide-content" style="${bgStyle}">
      ${
        slide.header
          ? `
        <div class="slide-header" style="background: ${headerBg}; color: ${headerText};">
          <h1>${escapeHtml(slide.header.title)}</h1>
          ${slide.header.subtitle ? `<p>${escapeHtml(slide.header.subtitle)}</p>` : ''}
        </div>
      `
          : ''
      }
      <div class="slide-body">
        <div class="${layoutClass}">
          ${elements}
        </div>
        ${bottomCallout}
      </div>
    </div>
  `;
}

// =============================================================================
// Main Render Function
// =============================================================================

/**
 * Render a deck to HTML
 *
 * @example
 * ```ts
 * const result = renderHtml(deck, {
 *   standalone: true,
 *   includeFonts: true,
 * });
 * fs.writeFileSync('preview.html', result.html);
 * ```
 */
export function renderHtml(deck: Deck, options: HtmlRenderOptions = {}): RenderedHtml {
  const { includeTailwind = false, includeFonts = true, standalone = true, slideIndex } = options;

  // Generate styles
  const themeCss = generateThemeCss(deck.theme);
  const baseCss = generateBaseCss();
  const styles = `<style>${themeCss}${baseCss}</style>`;

  // Render slides
  const slidesToRender =
    slideIndex !== undefined ? [deck.slides[slideIndex]] : deck.slides;

  const slideHtmls = slidesToRender.map((slide) => renderSlide(slide, deck.theme));

  // Generate fonts link
  const fontsLink = includeFonts ? generateFontsLink(deck.theme) : '';

  // Generate Tailwind link
  const tailwindLink = includeTailwind
    ? '<script src="https://cdn.tailwindcss.com"></script>'
    : '';

  if (standalone) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(deck.title)}</title>
  ${fontsLink}
  ${tailwindLink}
  ${styles}
</head>
<body style="background: #333; display: flex; flex-direction: column; align-items: center; gap: 20px; padding: 20px;">
  ${slideHtmls.join('\n')}
</body>
</html>
    `.trim();

    return {
      html,
      slides: slideHtmls,
      styles: themeCss + baseCss,
    };
  }

  return {
    html: slideHtmls.join('\n'),
    slides: slideHtmls,
    styles: themeCss + baseCss,
  };
}

/**
 * Render a single slide to HTML (for iframe preview)
 */
export function renderSingleSlideHtml(
  slide: Slide,
  theme: Theme,
  options: HtmlRenderOptions = {}
): string {
  const deck: Deck = {
    id: 'single-slide',
    title: slide.header?.title || 'Slide',
    theme,
    slides: [slide],
  };

  const result = renderHtml(deck, { ...options, slideIndex: 0 });
  return result.html;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
