/**
 * Semantic Theme Generator
 *
 * Generates context-appropriate themes based on topic analysis
 * Based on Z.AI research: Colors and fonts are derived from topic semantics
 *
 * @see data/z-ai-research/Z-AI-RESEARCH-SUMMARY.md
 */

import type { Theme, FontConfig, ColorPalette, BackgroundConfig } from '../schema/slide.js';

// =============================================================================
// Types
// =============================================================================

export type TopicCategory =
  | 'business'
  | 'technology'
  | 'sports'
  | 'fashion'
  | 'entertainment'
  | 'science'
  | 'education'
  | 'healthcare'
  | 'finance'
  | 'nature'
  | 'food'
  | 'travel'
  | 'general';

export interface ThemeGeneratorOptions {
  /** Title or topic of the presentation */
  topic: string;
  /** Optional subtitle or description */
  description?: string;
  /** Override primary color */
  primaryColor?: string;
  /** Override font family */
  fontFamily?: string;
  /** Force a specific category */
  category?: TopicCategory;
}

export interface GeneratedTheme extends Theme {
  category: TopicCategory;
  keywords: string[];
  backgroundStyle: 'solid' | 'photo';
}

// =============================================================================
// Keyword Mappings
// =============================================================================

const CATEGORY_KEYWORDS: Record<TopicCategory, string[]> = {
  business: [
    'business', 'corporate', 'company', 'enterprise', 'sales', 'marketing',
    'strategy', 'growth', 'profit', 'revenue', 'client', 'customer', 'crm',
    'sfmc', 'salesforce', 'b2b', 'b2c', 'roi', 'kpi', 'analytics',
  ],
  technology: [
    'tech', 'technology', 'software', 'hardware', 'ai', 'artificial intelligence',
    'machine learning', 'ml', 'data', 'cloud', 'saas', 'api', 'code', 'programming',
    'developer', 'engineering', 'digital', 'cyber', 'security', 'blockchain',
  ],
  sports: [
    'sports', 'football', 'soccer', 'basketball', 'tennis', 'baseball',
    'hockey', 'golf', 'athlete', 'championship', 'tournament', 'league',
    'olympic', 'fitness', 'training', 'coach', 'team', 'player', 'clay',
    'court', 'field', 'stadium', 'nadal', 'federer', 'lebron',
  ],
  fashion: [
    'fashion', 'style', 'design', 'clothing', 'apparel', 'runway', 'model',
    'vogue', 'designer', 'boutique', 'luxury', 'brand', 'beauty', 'makeup',
    'cosmetics', 'glamour', 'chic', 'trendy', 'haute couture', 'prada',
  ],
  entertainment: [
    'entertainment', 'movie', 'film', 'tv', 'television', 'show', 'series',
    'comedy', 'drama', 'music', 'concert', 'celebrity', 'hollywood', 'netflix',
    'streaming', 'gaming', 'game', 'sitcom', 'big bang', 'nerd', 'geek',
  ],
  science: [
    'science', 'research', 'study', 'experiment', 'laboratory', 'physics',
    'chemistry', 'biology', 'astronomy', 'space', 'nasa', 'quantum',
    'molecule', 'atom', 'formula', 'equation', 'theory', 'hypothesis',
  ],
  education: [
    'education', 'school', 'university', 'college', 'learning', 'teaching',
    'student', 'teacher', 'professor', 'course', 'curriculum', 'training',
    'workshop', 'seminar', 'lecture', 'degree', 'certification',
  ],
  healthcare: [
    'health', 'healthcare', 'medical', 'medicine', 'doctor', 'hospital',
    'patient', 'treatment', 'therapy', 'wellness', 'clinical', 'pharma',
    'pharmaceutical', 'diagnosis', 'nursing', 'surgery',
  ],
  finance: [
    'finance', 'financial', 'bank', 'banking', 'investment', 'stock',
    'trading', 'market', 'economy', 'economic', 'wealth', 'money',
    'insurance', 'mortgage', 'loan', 'credit', 'fintech',
  ],
  nature: [
    'nature', 'environment', 'eco', 'green', 'sustainable', 'climate',
    'wildlife', 'forest', 'ocean', 'mountain', 'earth', 'planet',
    'conservation', 'organic', 'renewable',
  ],
  food: [
    'food', 'restaurant', 'culinary', 'chef', 'cooking', 'recipe',
    'cuisine', 'gourmet', 'dining', 'menu', 'ingredients', 'taste',
    'flavor', 'nutrition', 'beverage', 'wine', 'coffee',
  ],
  travel: [
    'travel', 'tourism', 'vacation', 'destination', 'hotel', 'flight',
    'adventure', 'explore', 'journey', 'trip', 'cruise', 'resort',
    'backpack', 'sightseeing', 'landmark',
  ],
  general: [],
};

// =============================================================================
// Color Palettes by Category
// =============================================================================

interface CategoryStyle {
  primaryColor: string;
  fonts: FontConfig;
  backgroundStyle: 'solid' | 'photo';
}

const CATEGORY_STYLES: Record<TopicCategory, CategoryStyle> = {
  business: {
    primaryColor: '#13487A',  // Professional blue
    fonts: { heading: 'Roboto', body: 'Roboto' },
    backgroundStyle: 'solid',
  },
  technology: {
    primaryColor: '#0D47A1',  // Tech blue
    fonts: { heading: 'Roboto', body: 'Roboto' },
    backgroundStyle: 'solid',
  },
  sports: {
    primaryColor: '#A0522D',  // Clay/sienna (validated from Nadal deck)
    fonts: { heading: 'Source Sans Pro', body: 'Source Sans Pro' },
    backgroundStyle: 'photo',
  },
  fashion: {
    primaryColor: '#E91E63',  // Pink/magenta (validated from Andy Sachs deck)
    fonts: { heading: 'Playfair Display', body: 'Source Sans Pro' },
    backgroundStyle: 'photo',
  },
  entertainment: {
    primaryColor: '#FF9900',  // Orange (validated from Big Bang deck)
    fonts: { heading: 'Impact', body: 'Roboto', special: 'Courier New' },
    backgroundStyle: 'photo',
  },
  science: {
    primaryColor: '#1565C0',  // Deep blue
    fonts: { heading: 'Roboto', body: 'Roboto', special: 'Courier New' },
    backgroundStyle: 'solid',
  },
  education: {
    primaryColor: '#2E7D32',  // Educational green
    fonts: { heading: 'Roboto', body: 'Roboto' },
    backgroundStyle: 'solid',
  },
  healthcare: {
    primaryColor: '#00838F',  // Medical teal
    fonts: { heading: 'Roboto', body: 'Roboto' },
    backgroundStyle: 'solid',
  },
  finance: {
    primaryColor: '#1B5E20',  // Money green
    fonts: { heading: 'Roboto', body: 'Roboto' },
    backgroundStyle: 'solid',
  },
  nature: {
    primaryColor: '#33691E',  // Nature green
    fonts: { heading: 'Source Sans Pro', body: 'Source Sans Pro' },
    backgroundStyle: 'photo',
  },
  food: {
    primaryColor: '#BF360C',  // Warm orange/red
    fonts: { heading: 'Playfair Display', body: 'Source Sans Pro' },
    backgroundStyle: 'photo',
  },
  travel: {
    primaryColor: '#0288D1',  // Sky blue
    fonts: { heading: 'Source Sans Pro', body: 'Source Sans Pro' },
    backgroundStyle: 'photo',
  },
  general: {
    primaryColor: '#37474F',  // Neutral gray-blue
    fonts: { heading: 'Roboto', body: 'Roboto' },
    backgroundStyle: 'solid',
  },
};

// =============================================================================
// Semantic Color Overrides
// =============================================================================

/**
 * Special keyword-to-color mappings for semantic precision
 * These override the category default when matched
 */
const SEMANTIC_COLORS: Record<string, string> = {
  // Sports-specific
  'clay': '#A0522D',      // Tennis clay court
  'grass': '#228B22',     // Wimbledon
  'hard court': '#2E5090', // US Open blue

  // Brand colors (when detected)
  'salesforce': '#00A1E0',
  'microsoft': '#00A4EF',
  'google': '#4285F4',
  'amazon': '#FF9900',
  'apple': '#000000',
  'netflix': '#E50914',
  'spotify': '#1DB954',

  // Emotion/mood
  'luxury': '#B8860B',    // Gold
  'premium': '#4A4A4A',   // Dark gray
  'eco': '#2E7D32',       // Green
  'fire': '#D84315',      // Fire orange
  'ice': '#4FC3F7',       // Ice blue
  'gold': '#FFD700',      // Achievement gold
};

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Detect category from topic text
 */
export function detectCategory(text: string): TopicCategory {
  const normalizedText = text.toLowerCase();
  const matchCounts: Partial<Record<TopicCategory, number>> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [TopicCategory, string[]][]) {
    if (category === 'general') continue;

    let count = 0;
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword)) {
        count++;
      }
    }
    if (count > 0) {
      matchCounts[category] = count;
    }
  }

  // Find category with most matches
  let bestCategory: TopicCategory = 'general';
  let bestCount = 0;

  for (const [category, count] of Object.entries(matchCounts) as [TopicCategory, number][]) {
    if (count > bestCount) {
      bestCount = count;
      bestCategory = category;
    }
  }

  return bestCategory;
}

/**
 * Extract matched keywords from text
 */
export function extractKeywords(text: string, category: TopicCategory): string[] {
  const normalizedText = text.toLowerCase();
  const keywords = CATEGORY_KEYWORDS[category] || [];
  return keywords.filter((keyword) => normalizedText.includes(keyword));
}

/**
 * Detect semantic color override from text
 */
export function detectSemanticColor(text: string): string | null {
  const normalizedText = text.toLowerCase();

  for (const [keyword, color] of Object.entries(SEMANTIC_COLORS)) {
    if (normalizedText.includes(keyword)) {
      return color;
    }
  }

  return null;
}

// =============================================================================
// Theme Generation
// =============================================================================

/**
 * Generate a theme based on topic analysis
 *
 * @example
 * ```ts
 * const theme = generateTheme({
 *   topic: 'Rafael Nadal: King of Clay',
 *   description: 'A journey through tennis history',
 * });
 * // theme.colors.primary will be #A0522D (clay color)
 * // theme.fonts.heading will be 'Source Sans Pro'
 * ```
 */
export function generateTheme(options: ThemeGeneratorOptions): GeneratedTheme {
  const { topic, description = '', primaryColor, fontFamily, category: forcedCategory } = options;

  // Combine topic and description for analysis
  const fullText = `${topic} ${description}`;

  // Detect or use forced category
  const category = forcedCategory || detectCategory(fullText);
  const keywords = extractKeywords(fullText, category);

  // Get base style for category
  const categoryStyle = CATEGORY_STYLES[category];

  // Check for semantic color override
  const semanticColor = detectSemanticColor(fullText);

  // Determine final primary color
  const finalPrimaryColor = primaryColor || semanticColor || categoryStyle.primaryColor;

  // Determine fonts (allow override)
  const fonts: FontConfig = fontFamily
    ? { heading: fontFamily, body: fontFamily }
    : { ...categoryStyle.fonts };

  // Build color palette
  const colors: ColorPalette = {
    primary: finalPrimaryColor,
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
      light: '#FFFFFF',  // Z.AI uses pure white for content slides, not gray
      dark: '#333333',
    },
  };

  // Add secondary color for certain themes
  if (category === 'entertainment') {
    colors.secondary = '#FFD700'; // Gold for comedy/entertainment
  } else if (category === 'sports') {
    colors.secondary = '#E57373'; // Coral for sports
  }

  return {
    name: `${category.charAt(0).toUpperCase() + category.slice(1)} Theme`,
    fonts,
    colors,
    slideSize: { width: 1280, height: 720 },
    category,
    keywords,
    backgroundStyle: categoryStyle.backgroundStyle,
  };
}

// =============================================================================
// Background Generation
// =============================================================================

/**
 * Generate a background config based on theme
 */
export function generateBackground(
  theme: GeneratedTheme,
  slideType: 'title' | 'content' | 'closing' = 'content'
): BackgroundConfig {
  if (slideType === 'title' || slideType === 'closing') {
    // Title/closing slides use gradient or solid primary
    return {
      type: 'gradient',
      gradient: {
        from: theme.colors.primary,
        to: adjustBrightness(theme.colors.primary, -20),
        angle: 135,
      },
    };
  }

  if (theme.backgroundStyle === 'solid') {
    // Business/tech slides use solid light background
    return {
      type: 'solid',
      color: theme.colors.background.light,
    };
  }

  // Photo-style backgrounds (placeholder - actual photos would be provided)
  return {
    type: 'solid',
    color: theme.colors.background.white,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Adjust color brightness
 * @param hex - Hex color
 * @param percent - Positive = lighter, negative = darker
 */
function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Get contrasting text color (white or dark)
 */
export function getContrastingTextColor(backgroundColor: string): string {
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#333333' : '#FFFFFF';
}

/**
 * Generate color with opacity
 */
export function withOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
