/**
 * Coordinate and Unit Conversion Utilities
 *
 * PPTX uses EMUs (English Metric Units)
 * 1 inch = 914400 EMUs
 * At 96 DPI: 1 pixel = 9525 EMUs
 *
 * @see data/z-ai-research/Z-AI-RESEARCH-SUMMARY.md
 */

// =============================================================================
// Constants
// =============================================================================

/** EMUs per pixel at 96 DPI */
export const EMU_PER_PX = 9525;

/** EMUs per inch */
export const EMU_PER_INCH = 914400;

/** Standard slide width in EMUs (16:9 at 10 inches) */
export const SLIDE_WIDTH_EMU = 12191695;

/** Standard slide height in EMUs (16:9 at 10 inches) */
export const SLIDE_HEIGHT_EMU = 6858000;

/** Font size multiplier: PPTX font units are 1/100 of a point */
export const FONT_SIZE_MULTIPLIER = 59.8;

/** Text box width safety factor to prevent wrapping drift */
export const TEXT_SAFETY_FACTOR = 1.04; // +4% buffer

// =============================================================================
// Pixel ↔ EMU Conversions
// =============================================================================

/**
 * Convert pixels to EMUs
 * @param px - Value in pixels
 * @returns Value in EMUs
 */
export function pxToEmu(px: number): number {
  return Math.round(px * EMU_PER_PX);
}

/**
 * Convert EMUs to pixels
 * @param emu - Value in EMUs
 * @returns Value in pixels
 */
export function emuToPx(emu: number): number {
  return Math.round(emu / EMU_PER_PX);
}

/**
 * Convert pixels to inches
 * @param px - Value in pixels
 * @param dpi - Dots per inch (default: 96)
 * @returns Value in inches
 */
export function pxToInches(px: number, dpi: number = 96): number {
  return px / dpi;
}

/**
 * Convert inches to pixels
 * @param inches - Value in inches
 * @param dpi - Dots per inch (default: 96)
 * @returns Value in pixels
 */
export function inchesToPx(inches: number, dpi: number = 96): number {
  return inches * dpi;
}

// =============================================================================
// Font Size Conversions
// =============================================================================

/**
 * Convert CSS pixel font size to PPTX font size
 * PPTX uses hundredths of a point
 * @param px - Font size in CSS pixels
 * @returns Font size for PPTX (sz attribute)
 */
export function fontPxToPptx(px: number): number {
  return Math.round(px * FONT_SIZE_MULTIPLIER);
}

/**
 * Convert PPTX font size to CSS pixels
 * @param pptxSize - Font size from PPTX (sz attribute)
 * @returns Font size in CSS pixels
 */
export function fontPptxToPx(pptxSize: number): number {
  return Math.round(pptxSize / FONT_SIZE_MULTIPLIER);
}

/**
 * Convert points to PPTX font size
 * @param pt - Font size in points
 * @returns Font size for PPTX (sz attribute)
 */
export function fontPtToPptx(pt: number): number {
  return pt * 100;
}

/**
 * Convert PPTX font size to points
 * @param pptxSize - Font size from PPTX (sz attribute)
 * @returns Font size in points
 */
export function fontPptxToPt(pptxSize: number): number {
  return pptxSize / 100;
}

// =============================================================================
// Color Conversions
// =============================================================================

/**
 * Convert CSS hex color to PPTX srgbClr format
 * CSS: #RRGGBB or #RGB
 * PPTX: RRGGBB (no hash)
 * @param cssColor - CSS hex color (e.g., "#13487A" or "#FFF")
 * @returns PPTX color string (e.g., "13487A")
 */
export function cssColorToPptx(cssColor: string): string {
  let color = cssColor.replace('#', '').toUpperCase();

  // Expand shorthand (#RGB → RRGGBB)
  if (color.length === 3) {
    color = color
      .split('')
      .map((c) => c + c)
      .join('');
  }

  return color;
}

/**
 * Convert PPTX srgbClr to CSS hex color
 * @param pptxColor - PPTX color (e.g., "13487A")
 * @returns CSS hex color (e.g., "#13487A")
 */
export function pptxColorToCss(pptxColor: string): string {
  return `#${pptxColor}`;
}

/**
 * Convert CSS rgba to PPTX color with alpha
 * CSS: rgba(R, G, B, A) where A is 0-1
 * PPTX: { color: "RRGGBB", alpha: 0-100000 }
 * @param rgba - CSS rgba string
 * @returns Object with color and alpha for PPTX
 */
export function cssRgbaToPptx(rgba: string): { color: string; alpha: number } {
  const match = rgba.match(
    /rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );

  if (!match) {
    throw new Error(`Invalid rgba string: ${rgba}`);
  }

  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  const a = match[4] !== undefined ? parseFloat(match[4]) : 1;

  const color = [r, g, b]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

  // PPTX alpha: 0 = transparent, 100000 = opaque
  const alpha = Math.round(a * 100000);

  return { color, alpha };
}

// =============================================================================
// Bounds & Layout Conversions
// =============================================================================

export interface CssBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PptxBounds {
  x: number; // EMU
  y: number; // EMU
  cx: number; // EMU (width)
  cy: number; // EMU (height)
}

/**
 * Convert CSS bounds (px) to PPTX bounds (EMU)
 * @param bounds - Bounds in CSS pixels
 * @param applyTextSafety - Apply width safety factor for text boxes
 * @returns Bounds in EMUs
 */
export function boundsToPptx(
  bounds: CssBounds,
  applyTextSafety: boolean = false
): PptxBounds {
  const width = applyTextSafety
    ? bounds.width * TEXT_SAFETY_FACTOR
    : bounds.width;

  return {
    x: pxToEmu(bounds.x),
    y: pxToEmu(bounds.y),
    cx: pxToEmu(width),
    cy: pxToEmu(bounds.height),
  };
}

/**
 * Convert PPTX bounds (EMU) to CSS bounds (px)
 * @param bounds - Bounds in EMUs
 * @returns Bounds in CSS pixels
 */
export function boundsFromPptx(bounds: PptxBounds): CssBounds {
  return {
    x: emuToPx(bounds.x),
    y: emuToPx(bounds.y),
    width: emuToPx(bounds.cx),
    height: emuToPx(bounds.cy),
  };
}

// =============================================================================
// Gradient Angle Conversions
// =============================================================================

/**
 * Convert CSS gradient angle to PPTX angle
 * CSS: 0deg = top, 90deg = right (clockwise from top)
 * PPTX: 0 = right, increases counter-clockwise, in 60000ths of a degree
 * @param cssDeg - CSS angle in degrees
 * @returns PPTX angle value
 */
export function gradientAngleToPptx(cssDeg: number): number {
  // CSS to PPTX angle conversion:
  // CSS 0° (top) → PPTX 5400000 (90°)
  // CSS 90° (right) → PPTX 0 (0°)
  // CSS 180° (bottom) → PPTX 16200000 (270°)
  const pptxDeg = (90 - cssDeg + 360) % 360;
  return pptxDeg * 60000;
}

/**
 * Convert PPTX gradient angle to CSS degrees
 * @param pptxAngle - PPTX angle value
 * @returns CSS angle in degrees
 */
export function gradientAngleFromPptx(pptxAngle: number): number {
  const pptxDeg = pptxAngle / 60000;
  return (90 - pptxDeg + 360) % 360;
}

// =============================================================================
// Border Radius Conversions
// =============================================================================

/**
 * Determine PPTX shape type from CSS border-radius
 * @param radiusValues - CSS border-radius values [topLeft, topRight, bottomRight, bottomLeft]
 * @returns PPTX shape preset name
 */
export function borderRadiusToShapeType(
  radiusValues: [number, number, number, number]
): 'rect' | 'roundRect' | 'round2SameRect' {
  const [tl, tr, br, bl] = radiusValues;
  const hasTopLeft = tl > 0;
  const hasTopRight = tr > 0;
  const hasBottomRight = br > 0;
  const hasBottomLeft = bl > 0;

  // All corners rounded equally
  if (hasTopLeft && hasTopRight && hasBottomRight && hasBottomLeft) {
    if (tl === tr && tr === br && br === bl) {
      return 'roundRect';
    }
  }

  // Only top corners rounded (common pattern)
  if (hasTopLeft && hasTopRight && !hasBottomRight && !hasBottomLeft) {
    return 'round2SameRect';
  }

  // No rounding or unsupported pattern → use rect
  return 'rect';
}

// =============================================================================
// Text Metrics
// =============================================================================

/**
 * Estimate text box width with safety margin
 * Browsers and PowerPoint wrap text differently - add buffer to prevent drift
 * @param computedWidth - Browser-computed text width in pixels
 * @returns Adjusted width in pixels
 */
export function safeTextWidth(computedWidth: number): number {
  return computedWidth * TEXT_SAFETY_FACTOR;
}

// =============================================================================
// Slide Size Helpers
// =============================================================================

export interface SlideSize {
  widthPx: number;
  heightPx: number;
  widthEmu: number;
  heightEmu: number;
}

/**
 * Get slide size in both units
 * @param widthPx - Width in pixels (default: 1280)
 * @param heightPx - Height in pixels (default: 720)
 * @returns Size in both pixel and EMU units
 */
export function getSlideSize(
  widthPx: number = 1280,
  heightPx: number = 720
): SlideSize {
  return {
    widthPx,
    heightPx,
    widthEmu: pxToEmu(widthPx),
    heightEmu: pxToEmu(heightPx),
  };
}
