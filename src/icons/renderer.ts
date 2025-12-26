/**
 * Icon Renderer
 *
 * Renders Material Icons to colored PNGs using Iconify API + Sharp
 * Icons are cached by hash(icon+color) for reuse across slides
 *
 * @see data/z-ai-research/Z-AI-RESEARCH-SUMMARY.md
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// Sharp is optional - we'll handle the import gracefully
let sharp: typeof import('sharp') | null = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  // Sharp not available - will use fallback or throw on render
}

// =============================================================================
// Constants
// =============================================================================

/** Default icon render size (3x for retina displays) */
export const DEFAULT_ICON_SIZE = 300;

/** Iconify API base URL */
export const ICONIFY_API = 'https://api.iconify.design';

/** Default icon set for Material Design Icons */
export const DEFAULT_ICON_SET = 'mdi';

/** Google Material Icons set (baseline) */
export const GOOGLE_MATERIAL_ICONS_SET = 'ic';

/**
 * Map of Google Material Icons snake_case names to MDI kebab-case names
 * Z.AI uses Google Material Icons format (swap_horiz, check_circle)
 * but we can use the `ic` set directly from Iconify for Google icons
 */
const GOOGLE_TO_MDI_MAP: Record<string, string> = {
  // Common icons that need mapping between sets
  'swap_horiz': 'swap-horizontal',
  'check_circle': 'check-circle',
  'thumb_up': 'thumb-up',
  'lightbulb': 'lightbulb',
  'cloud': 'cloud',
  'insights': 'chart-line',
  'verified': 'check-decagram',
  'business': 'domain',
  'assignment': 'clipboard-text',
  'integration_instructions': 'code-tags',
  'arrow_forward': 'arrow-right',
  'psychology': 'head-lightbulb',
  'settings': 'cog',
  'lock': 'lock',
  'security': 'shield-check',
  'analytics': 'chart-bar',
  'data_object': 'code-json',
  'sync': 'sync',
  'account_circle': 'account-circle',
  'person': 'account',
  'people': 'account-group',
  'email': 'email',
  'phone': 'phone',
  'calendar_today': 'calendar',
  'schedule': 'clock-outline',
  'trending_up': 'trending-up',
  'trending_down': 'trending-down',
  'warning': 'alert',
  'error': 'alert-circle',
  'info': 'information',
  'help': 'help-circle',
  'star': 'star',
  'favorite': 'heart',
  'delete': 'delete',
  'edit': 'pencil',
  'add': 'plus',
  'remove': 'minus',
  'search': 'magnify',
  'visibility': 'eye',
  'visibility_off': 'eye-off',
  'refresh': 'refresh',
  'download': 'download',
  'upload': 'upload',
  'share': 'share',
  'link': 'link',
  'language': 'web',
  'cloud_upload': 'cloud-upload',
  'cloud_download': 'cloud-download',
  'storage': 'database',
  'dns': 'server',
  'api': 'api',
  'code': 'code-tags',
  'terminal': 'console',
  'rocket_launch': 'rocket-launch',
  'flag': 'flag',
  'emoji_events': 'trophy',
  'military_tech': 'medal',
  'workspace_premium': 'certificate',
};

/**
 * Normalize icon name from Google Material format to Iconify-compatible format
 * If the icon is in our mapping, return MDI name
 * Otherwise, convert snake_case to kebab-case and try with ic: prefix
 */
function normalizeIconName(name: string): { set: string; name: string } {
  // Already has set prefix (e.g., "mdi:lock")
  if (name.includes(':')) {
    const [set, iconName] = name.split(':');
    return { set, name: iconName };
  }

  // Check if it's a known Google icon with MDI equivalent
  if (GOOGLE_TO_MDI_MAP[name]) {
    return { set: DEFAULT_ICON_SET, name: GOOGLE_TO_MDI_MAP[name] };
  }

  // If it looks like a Google Material icon (snake_case), try ic set first
  if (name.includes('_')) {
    // Use Google Material Icons baseline set
    return { set: 'ic', name: `baseline-${name.replace(/_/g, '-')}` };
  }

  // Default: assume MDI kebab-case
  return { set: DEFAULT_ICON_SET, name };
}

/** Cache directory for rendered icons */
export const ICON_CACHE_DIR = '.icon-cache';

// =============================================================================
// Types
// =============================================================================

export interface IconRenderOptions {
  /** Icon name (e.g., "lock", "settings", "check-circle") */
  name: string;
  /** Fill color in hex (e.g., "#FFFFFF", "#E91E63") */
  color: string;
  /** Render size in pixels (default: 300) */
  size?: number;
  /** Icon set (default: "mdi" for Material Design Icons) */
  iconSet?: string;
  /** Cache directory (default: ".icon-cache") */
  cacheDir?: string;
}

export interface RenderedIcon {
  /** PNG buffer */
  buffer: Buffer;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Cache key (hash of icon+color+size) */
  cacheKey: string;
  /** Path to cached file (if cached) */
  cachePath?: string;
}

// =============================================================================
// Cache Utilities
// =============================================================================

/**
 * Generate cache key from icon options
 */
export function getCacheKey(options: IconRenderOptions): string {
  const { name, color, size = DEFAULT_ICON_SIZE, iconSet = DEFAULT_ICON_SET } = options;
  const data = `${iconSet}:${name}:${color}:${size}`;
  return createHash('md5').update(data).digest('hex');
}

/**
 * Get cache file path for an icon
 */
export function getCachePath(cacheKey: string, cacheDir: string = ICON_CACHE_DIR): string {
  return path.join(cacheDir, `${cacheKey}.png`);
}

/**
 * Check if icon is cached
 */
async function isCached(cacheKey: string, cacheDir: string): Promise<boolean> {
  const cachePath = getCachePath(cacheKey, cacheDir);
  try {
    await fs.access(cachePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read icon from cache
 */
async function readFromCache(cacheKey: string, cacheDir: string): Promise<Buffer | null> {
  const cachePath = getCachePath(cacheKey, cacheDir);
  try {
    return await fs.readFile(cachePath);
  } catch {
    return null;
  }
}

/**
 * Write icon to cache
 */
async function writeToCache(cacheKey: string, buffer: Buffer, cacheDir: string): Promise<string> {
  await fs.mkdir(cacheDir, { recursive: true });
  const cachePath = getCachePath(cacheKey, cacheDir);
  await fs.writeFile(cachePath, buffer);
  return cachePath;
}

// =============================================================================
// SVG Fetching
// =============================================================================

/**
 * Fetch SVG from Iconify API
 * @param iconSet - Icon set (e.g., "mdi") - may be overridden by normalizeIconName
 * @param name - Icon name (e.g., "lock", "swap_horiz", "mdi:lock")
 * @returns SVG string
 */
export async function fetchIconSvg(iconSet: string, name: string): Promise<string> {
  // Normalize icon name (handles Google Material → MDI mapping and set prefixes)
  const normalized = normalizeIconName(name);
  const set = normalized.set;
  const iconName = normalized.name;

  const url = `${ICONIFY_API}/${set}/${iconName}.svg`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch icon ${set}:${iconName}: ${response.status}`);
  }

  return response.text();
}

// =============================================================================
// SVG Manipulation
// =============================================================================

/**
 * Apply color to SVG by setting fill attribute
 * @param svg - SVG string
 * @param color - Fill color (hex)
 * @returns Modified SVG string
 */
export function colorizeSvg(svg: string, color: string): string {
  // Remove any existing fill attributes on the root svg element
  let modified = svg.replace(/<svg([^>]*)fill="[^"]*"/g, '<svg$1');

  // Add fill attribute to root svg element
  modified = modified.replace(/<svg/, `<svg fill="${color}"`);

  // Also set fill on path elements that don't have explicit fills
  // This handles icons with multiple paths
  modified = modified.replace(
    /<path(?![^>]*fill=)/g,
    `<path fill="${color}"`
  );

  return modified;
}

/**
 * Set SVG dimensions
 * @param svg - SVG string
 * @param size - Size in pixels
 * @returns Modified SVG string
 */
export function resizeSvg(svg: string, size: number): string {
  // Set explicit width and height
  let modified = svg
    .replace(/width="[^"]*"/g, `width="${size}"`)
    .replace(/height="[^"]*"/g, `height="${size}"`);

  // If no width/height, add them
  if (!modified.includes('width=')) {
    modified = modified.replace('<svg', `<svg width="${size}" height="${size}"`);
  }

  return modified;
}

// =============================================================================
// PNG Rendering
// =============================================================================

/**
 * Convert SVG to PNG using Sharp
 * @param svg - SVG string
 * @param size - Output size in pixels
 * @returns PNG buffer
 */
async function svgToPng(svg: string, size: number): Promise<Buffer> {
  if (!sharp) {
    throw new Error(
      'Sharp is not available. Install it with: npm install sharp'
    );
  }

  // Convert SVG to PNG
  const buffer = await sharp(Buffer.from(svg))
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
    })
    .png()
    .toBuffer();

  return buffer;
}

// =============================================================================
// Main Render Function
// =============================================================================

/**
 * Render a Material Icon to a colored PNG
 *
 * @example
 * ```ts
 * const icon = await renderIcon({
 *   name: 'lock',
 *   color: '#E91E63',
 *   size: 300,
 * });
 * // icon.buffer is the PNG data
 * ```
 */
export async function renderIcon(options: IconRenderOptions): Promise<RenderedIcon> {
  const {
    name,
    color,
    size = DEFAULT_ICON_SIZE,
    iconSet = DEFAULT_ICON_SET,
    cacheDir = ICON_CACHE_DIR,
  } = options;

  // Generate cache key
  const cacheKey = getCacheKey(options);

  // Check cache first
  if (await isCached(cacheKey, cacheDir)) {
    const buffer = await readFromCache(cacheKey, cacheDir);
    if (buffer) {
      return {
        buffer,
        width: size,
        height: size,
        cacheKey,
        cachePath: getCachePath(cacheKey, cacheDir),
      };
    }
  }

  // Fetch SVG from Iconify
  const svg = await fetchIconSvg(iconSet, name);

  // Apply color and resize
  const coloredSvg = colorizeSvg(svg, color);
  const resizedSvg = resizeSvg(coloredSvg, size);

  // Convert to PNG
  const buffer = await svgToPng(resizedSvg, size);

  // Cache the result
  const cachePath = await writeToCache(cacheKey, buffer, cacheDir);

  return {
    buffer,
    width: size,
    height: size,
    cacheKey,
    cachePath,
  };
}

/**
 * Render multiple icons in parallel
 */
export async function renderIcons(
  icons: IconRenderOptions[]
): Promise<Map<string, RenderedIcon>> {
  const results = await Promise.all(
    icons.map(async (options) => {
      const icon = await renderIcon(options);
      return [getCacheKey(options), icon] as const;
    })
  );

  return new Map(results);
}

// =============================================================================
// Icon Set Helpers
// =============================================================================

/** Common Material Design icon names used in presentations */
export const COMMON_ICONS = [
  'arrow-right',
  'arrow-left',
  'check',
  'check-circle',
  'close',
  'close-circle',
  'star',
  'heart',
  'account',
  'cog',
  'settings',
  'lock',
  'lock-open',
  'email',
  'phone',
  'calendar',
  'clock',
  'chart-bar',
  'chart-line',
  'trending-up',
  'trending-down',
  'lightbulb',
  'information',
  'alert',
  'help-circle',
  'plus',
  'minus',
  'magnify',
  'download',
  'upload',
  'share',
  'link',
  'web',
  'cloud',
  'database',
  'server',
  'code-tags',
  'api',
  'rocket',
  'target',
  'flag',
  'trophy',
  'medal',
  'certificate',
] as const;

/**
 * Get full icon identifier with set prefix
 */
export function getIconId(name: string, iconSet: string = DEFAULT_ICON_SET): string {
  if (name.includes(':')) {
    return name;
  }
  return `${iconSet}:${name}`;
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clear the icon cache
 */
export async function clearIconCache(cacheDir: string = ICON_CACHE_DIR): Promise<void> {
  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(cacheDir: string = ICON_CACHE_DIR): Promise<{
  count: number;
  totalSize: number;
}> {
  try {
    const files = await fs.readdir(cacheDir);
    const pngFiles = files.filter((f) => f.endsWith('.png'));

    let totalSize = 0;
    for (const file of pngFiles) {
      const stat = await fs.stat(path.join(cacheDir, file));
      totalSize += stat.size;
    }

    return { count: pngFiles.length, totalSize };
  } catch {
    return { count: 0, totalSize: 0 };
  }
}
