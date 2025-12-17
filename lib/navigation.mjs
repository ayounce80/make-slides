/**
 * Shared navigation utilities for slide deck capture
 */

/**
 * Detect the number of slides in the deck
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} navSelector - CSS selector for navigation dots
 * @param {string} navMethod - Navigation method (dots, keyboard, url)
 * @returns {Promise<number>} Number of slides detected
 */
export async function detectSlideCount(page, navSelector, navMethod) {
  if (navMethod === 'dots') {
    const dots = await page.$$(navSelector);
    if (dots.length > 0) {
      return dots.length;
    }
  }

  // Fallback: look for common slide count patterns
  const patterns = [
    // "Slide X of Y" pattern
    async () => {
      const text = await page.evaluate(() => document.body.innerText);
      const match = text.match(/(?:slide\s+\d+\s+of\s+|\/\s*)(\d+)/i);
      return match ? parseInt(match[1]) : null;
    },
    // Count navigation thumbnails
    async () => {
      const thumbs = await page.$$('.thumbnail, .slide-thumb, [class*="thumb"]');
      return thumbs.length > 0 ? thumbs.length : null;
    }
  ];

  for (const pattern of patterns) {
    const count = await pattern();
    if (count) return count;
  }

  // Default fallback - warn user
  console.warn('Could not detect slide count, defaulting to 10. Use --slides to specify explicitly.');
  return 10;
}

/**
 * Navigate to a specific slide
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {number} index - Zero-based slide index
 * @param {string} navSelector - CSS selector for navigation dots
 * @param {string} navMethod - Navigation method (dots, keyboard, url)
 * @param {number} waitTime - Time to wait after navigation (ms)
 */
export async function navigateToSlide(page, index, navSelector, navMethod, waitTime) {
  switch (navMethod) {
    case 'dots':
      const dots = await page.$$(navSelector);
      if (dots[index]) {
        await dots[index].click();
      }
      break;

    case 'keyboard':
      if (index > 0) {
        await page.keyboard.press('ArrowRight');
      }
      break;

    case 'url':
      await page.goto(`${page.url().split('#')[0]}#slide-${index + 1}`, {
        waitUntil: 'networkidle0'
      });
      break;

    default:
      throw new Error(`Unknown navigation method: ${navMethod}`);
  }

  await new Promise(r => setTimeout(r, waitTime));
}
