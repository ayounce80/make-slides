/**
 * Magic Slides Schema
 *
 * Based on Z.AI research: 4 decks analyzed, patterns validated
 * @see data/z-ai-research/Z-AI-RESEARCH-SUMMARY.md
 */

// =============================================================================
// Core Types
// =============================================================================

/** Slide dimensions in pixels (HTML) - converts to EMUs for PPTX */
export interface Dimensions {
  width: number;   // Default: 1280px
  height: number;  // Default: 720px
}

/** Position and size for layout elements */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// =============================================================================
// Theme System (Dynamic per-deck)
// =============================================================================

/**
 * Font family selection based on topic genre
 * Business: Sans-serif (Roboto)
 * Fashion/Editorial: Serif heading (Playfair Display)
 * Comedy/Entertainment: Display font (Impact)
 */
export interface FontConfig {
  heading: string;      // e.g., "Roboto", "Playfair Display", "Impact"
  body: string;         // e.g., "Roboto", "Source Sans Pro"
  special?: string;     // e.g., "Courier New" for equations
}

/**
 * Color palette generated based on topic semantics
 * e.g., "King of Clay" → clay/sienna (#A0522D)
 */
export interface ColorPalette {
  primary: string;      // Topic-derived accent (e.g., #13487A, #E91E63)
  secondary?: string;   // Optional secondary accent
  positive: string;     // Success indicators (#50B432)
  negative: string;     // Warning indicators (#ED561B)
  warning: string;      // Amber for changeable states (#FFAB40)

  // Grayscale (always present)
  text: {
    dark: string;       // #333333 - headers
    medium: string;     // #555555 - body
    light: string;      // #666666 - secondary
    inverse: string;    // #FFFFFF - on dark backgrounds
  };

  background: {
    white: string;      // #FFFFFF
    light: string;      // #F5F5F5
    dark: string;       // #333333
  };
}

/** Background style for slides */
export interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  gradient?: {
    from: string;
    to: string;
    angle: number;      // degrees
  };
  image?: {
    url: string;
    overlay?: {
      color: string;
      opacity: number;  // 0-1
    };
  };
}

/** Complete theme configuration for a deck */
export interface Theme {
  name: string;
  fonts: FontConfig;
  colors: ColorPalette;
  slideSize: Dimensions;
}

// =============================================================================
// Slide Types (6 identified from Z.AI research)
// =============================================================================

export type SlideType =
  | 'title'           // Opening slide - centered, gradient background
  | 'section'         // Section divider - full-color bg, centered title, decorative line
  | 'agenda'          // Table of contents - numbered grid
  | 'content'         // Standard slide - header + body
  | 'two-column'      // Side-by-side comparison cards
  | 'comparison'      // Feature matrix table
  | 'closing';        // Thank you / Q&A slide

// =============================================================================
// Layout Types (3 identified patterns)
// =============================================================================

export type LayoutType =
  | 'grid-2-column'   // Two equal columns
  | 'grid-3-column'   // Three equal columns
  | 'flex-column';    // Stacked vertically

// =============================================================================
// Element Types (6 identified from Z.AI research)
// =============================================================================

/** Agenda item with circled number */
export interface NumberedItem {
  type: 'numbered-item';
  number: number;
  title: string;
  description?: string;
}

/** Icon + title + description in rounded box */
export interface IconCard {
  type: 'icon-card';
  icon: string;         // Material Icon name (e.g., "lock", "settings")
  title: string;
  description?: string;
  iconColor?: string;   // Override theme color
  backgroundColor?: string;
}

/** Row with positive/negative indicators */
export interface ComparisonRow {
  type: 'comparison-row';
  label: string;
  columns: Array<{
    value: string | boolean;  // string for text, boolean for checkmark/x
    sentiment?: 'positive' | 'negative' | 'neutral';
  }>;
}

/** Grid of icon + text pairs */
export interface IconGrid {
  type: 'icon-grid';
  items: Array<{
    icon: string;
    label: string;
    description?: string;
  }>;
  columns?: 2 | 3 | 4;
}

/** Highlighted message box */
export interface Callout {
  type: 'callout';
  text: string;
  icon?: string;
  variant?: 'primary' | 'positive' | 'negative' | 'warning';
}

/** Small labeled tag */
export interface Badge {
  type: 'badge';
  text: string;
  color?: string;
  backgroundColor?: string;
}

/** Text block with optional styling */
export interface TextBlock {
  type: 'text';
  content: string;
  size?: 'title' | 'heading' | 'subheading' | 'body' | 'caption';
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

/** Image element */
export interface ImageElement {
  type: 'image';
  src: string;          // URL or base64
  alt?: string;
  bounds?: Bounds;
  borderRadius?: number;
}

export type SlideElement =
  | NumberedItem
  | IconCard
  | ComparisonRow
  | IconGrid
  | Callout
  | Badge
  | TextBlock
  | ImageElement;

// =============================================================================
// Slide Header (common pattern)
// =============================================================================

export interface SlideHeader {
  title: string;
  subtitle?: string;
  backgroundColor?: string;
  textColor?: string;
}

// =============================================================================
// Slide Content
// =============================================================================

export interface SlideContent {
  layout?: LayoutType;
  elements: SlideElement[];
  bottomCallout?: Callout;
}

// =============================================================================
// Complete Slide Definition
// =============================================================================

export interface Slide {
  id: string;
  slideType: SlideType;
  background?: BackgroundConfig;
  header?: SlideHeader;
  content: SlideContent;

  // Optional metadata
  notes?: string;
  transition?: 'none' | 'fade' | 'slide';
}

// =============================================================================
// Complete Deck (Presentation)
// =============================================================================

export interface Deck {
  id: string;
  title: string;
  theme: Theme;
  slides: Slide[];

  // Metadata
  author?: string;
  client?: string;        // "Prepared for {client}" on title slide
  createdAt?: string;
  updatedAt?: string;
}

// =============================================================================
// Typography Scale (px values)
// =============================================================================

export const TYPOGRAPHY_SCALE = {
  title: 72,       // text-7xl
  header: 40,      // text-[40px]
  section: 30,     // text-3xl
  cardTitle: 26,   // text-[26px]
  bodyLarge: 24,   // text-[24px]
  body: 22,        // text-[22px]
  bodySmall: 18,   // text-[18px]
  caption: 14,     // text-sm
} as const;

// =============================================================================
// Shape Types (only 3 allowed - PPTX constraint)
// =============================================================================

export type ShapeType = 'rect' | 'roundRect' | 'round2SameRect';

export const SHAPE_PRESETS = {
  rect: 'rect',                   // border-radius: 0
  roundRect: 'roundRect',         // border-radius: 8px (uniform)
  round2SameRect: 'round2SameRect' // border-radius: 8px 8px 0 0 (top only)
} as const;

// =============================================================================
// Default Theme (Business/Professional)
// =============================================================================

export const DEFAULT_THEME: Theme = {
  name: 'Business',
  fonts: {
    heading: 'Roboto',
    body: 'Roboto',
  },
  colors: {
    primary: '#13487A',
    positive: '#50B432',
    negative: '#ED561B',
    warning: '#FFAB40',
    text: {
      dark: '#333333',
      medium: '#555555',
      light: '#666666',
      inverse: '#FFFFFF',
    },
    background: {
      white: '#FFFFFF',
      light: '#FFFFFF',  // Z.AI uses pure white for content slides
      dark: '#333333',
    },
  },
  slideSize: {
    width: 1280,
    height: 720,
  },
};
