/**
 * Z.AI-Style Layout Constants
 *
 * Precise positioning values reverse-engineered from Z.AI reference PPTX.
 * All values in inches (pptxgenjs native unit).
 *
 * @see data/z-ai-research/colts-reference-pptx/ppt/slides/slide5.xml
 */

// EMU to inches conversion: 1 inch = 914400 EMU
const EMU_TO_INCHES = 914400;

// Convert EMU to inches
const emu = (emuValue: number): number => emuValue / EMU_TO_INCHES;

// =============================================================================
// Slide Dimensions
// =============================================================================

export const SLIDE = {
  /** Full slide width (13.33 inches) */
  WIDTH: emu(12191695),
  /** Full slide height (7.5 inches) */
  HEIGHT: emu(6858000),
} as const;

// =============================================================================
// Margins and Spacing
// =============================================================================

export const MARGIN = {
  /** Left/right margin from slide edge (~0.67 inches) */
  HORIZONTAL: emu(609584),
  /** Internal padding within cards (~0.32 inches) */
  CARD_INTERNAL: emu(304793),
  /** Gap between columns (~0.42 inches) */
  COLUMN_GAP: emu(381175),
} as const;

// =============================================================================
// Header Layout
// =============================================================================

export const HEADER = {
  /** Header bar height (~0.885 inches) */
  HEIGHT: emu(809625),
  /** Header title x position */
  TITLE_X: emu(609584),
  /** Header title y position */
  TITLE_Y: emu(114300),
  /** Header title height */
  TITLE_HEIGHT: emu(571500),
} as const;

// =============================================================================
// Content Layout
// =============================================================================

export const CONTENT = {
  /** Subtitle line y position (below header) */
  SUBTITLE_Y: emu(1190625),
  /** Subtitle height */
  SUBTITLE_HEIGHT: emu(342900),
  /** Content area start y (for cards) */
  CARDS_Y: emu(2009774),
  /** Full content width (slide width - margins) */
  WIDTH: emu(10972525),
  /** Single column card width */
  CARD_WIDTH: emu(5295767),
  /** Card height (tall cards) */
  CARD_HEIGHT: emu(3190874),
  /** Right column x position */
  RIGHT_COLUMN_X: emu(6286342),
} as const;

// =============================================================================
// Icon Card Internal Layout
// =============================================================================

export const ICON_CARD = {
  /** Icon background size (~0.583 inches) */
  ICON_BG_SIZE: emu(533386),
  /** Icon background x offset from card edge */
  ICON_X_OFFSET: emu(304793),
  /** Icon background y offset from card edge */
  ICON_Y_OFFSET: emu(342901),
  /** Card title x offset (after icon) */
  TITLE_X_OFFSET: emu(990575),
  /** Card title y offset */
  TITLE_Y_OFFSET: emu(438150),
  /** Description y offset from card top */
  DESC1_Y_OFFSET: emu(1104901),
  /** Description 2 y offset */
  DESC2_Y_OFFSET: emu(1495425),
  /** Detail box y offset */
  DETAIL_BOX_Y_OFFSET: emu(2009775),
  /** Detail box height */
  DETAIL_BOX_HEIGHT: emu(876299),
  /** Detail text x offset */
  DETAIL_TEXT_X_OFFSET: emu(533387),
  /** Detail text y offset */
  DETAIL_TEXT_Y_OFFSET: emu(2162176),
} as const;

// =============================================================================
// Bottom Callout Layout
// =============================================================================

export const BOTTOM_CALLOUT = {
  /** Bottom callout y position */
  Y: emu(5676900),
  /** Bottom callout height */
  HEIGHT: emu(800100),
  /** Bottom callout text y offset */
  TEXT_Y_OFFSET: emu(228600),
} as const;

// =============================================================================
// Font Sizes (pt values from sz attributes)
// =============================================================================

export const FONT_SIZE = {
  /** Header title: sz=2392 → 23.92pt */
  HEADER_TITLE: 23.92,
  /** Subtitle: sz=1794 → 17.94pt */
  SUBTITLE: 17.94,
  /** Card title: sz=1794 → 17.94pt */
  CARD_TITLE: 17.94,
  /** Description: sz=1315 → 13.15pt */
  DESCRIPTION: 13.15,
  /** Detail text: sz=1196 → 11.96pt */
  DETAIL: 11.96,
  /** Title slide: sz=4305 → 43.05pt */
  TITLE: 43.05,
} as const;

// =============================================================================
// Computed Layout Helpers
// =============================================================================

/**
 * Get 2-column layout positions
 */
export function getTwoColumnLayout() {
  return {
    left: {
      x: MARGIN.HORIZONTAL,
      y: CONTENT.CARDS_Y,
      width: CONTENT.CARD_WIDTH,
      height: CONTENT.CARD_HEIGHT,
    },
    right: {
      x: CONTENT.RIGHT_COLUMN_X,
      y: CONTENT.CARDS_Y,
      width: CONTENT.CARD_WIDTH,
      height: CONTENT.CARD_HEIGHT,
    },
    gap: MARGIN.COLUMN_GAP,
  };
}

/**
 * Get icon card internal positions
 * @param cardX - Card container x position
 * @param cardY - Card container y position
 */
export function getIconCardLayout(cardX: number, cardY: number) {
  return {
    iconBg: {
      x: cardX + ICON_CARD.ICON_X_OFFSET,
      y: cardY + ICON_CARD.ICON_Y_OFFSET,
      size: ICON_CARD.ICON_BG_SIZE,
    },
    title: {
      x: cardX + ICON_CARD.TITLE_X_OFFSET,
      y: cardY + ICON_CARD.TITLE_Y_OFFSET,
    },
    desc1: {
      x: cardX + ICON_CARD.ICON_X_OFFSET,
      y: cardY + ICON_CARD.DESC1_Y_OFFSET,
    },
    desc2: {
      x: cardX + ICON_CARD.ICON_X_OFFSET,
      y: cardY + ICON_CARD.DESC2_Y_OFFSET,
    },
    detailBox: {
      x: cardX + ICON_CARD.ICON_X_OFFSET,
      y: cardY + ICON_CARD.DETAIL_BOX_Y_OFFSET,
      height: ICON_CARD.DETAIL_BOX_HEIGHT,
    },
    detailText: {
      x: cardX + ICON_CARD.DETAIL_TEXT_X_OFFSET,
      y: cardY + ICON_CARD.DETAIL_TEXT_Y_OFFSET,
    },
  };
}
