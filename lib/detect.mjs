import puppeteer from 'puppeteer';

/**
 * Auto-detect slide deck configuration by analyzing the page
 * @param {string} url - URL of the slide deck
 * @param {object} options - Optional settings
 * @param {boolean} options.sandbox - Run Chrome with sandbox (default: false)
 */
export async function detectConfig(url, options = {}) {
  const { sandbox = false } = options;
  const browserArgs = sandbox ? [] : ['--no-sandbox', '--disable-setuid-sandbox'];
  const browser = await puppeteer.launch({
    headless: true,
    args: browserArgs
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  const config = await page.evaluate(() => {
    const result = {
      slideSelector: null,
      navSelector: null,
      navMethod: 'dots',
      totalSlides: null
    };

    // Common slide container selectors (in order of preference)
    const slideSelectors = [
      '.aspect-\\[16\\/9\\]',
      '.aspect-video',
      '[class*="slide-container"]',
      '[class*="slide-content"]',
      '.slide',
      '[class*="presentation"]',
      '.deck',
      'main > div:first-child'
    ];

    for (const selector of slideSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Check if it looks like a slide (reasonable aspect ratio)
          const ratio = rect.width / rect.height;
          if (ratio > 1.3 && ratio < 2.0 && rect.width > 400) {
            result.slideSelector = selector;
            break;
          }
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }

    // Common navigation selectors
    const navSelectors = [
      '.w-3.h-3.rounded-full',
      '.w-2.h-2.rounded-full',
      '[class*="dot"]',
      '[class*="indicator"]',
      '.nav-dot',
      '.slide-dot',
      '.pagination button',
      '.thumbnail'
    ];

    for (const selector of navSelectors) {
      try {
        const els = document.querySelectorAll(selector);
        if (els.length > 1) {
          result.navSelector = selector;
          result.totalSlides = els.length;
          break;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }

    // Try to find slide count from text
    if (!result.totalSlides) {
      const text = document.body.innerText;
      const match = text.match(/(?:slide\s+\d+\s+of\s+|\/\s*)(\d+)/i);
      if (match) {
        result.totalSlides = parseInt(match[1]);
      }
    }

    return result;
  });

  await browser.close();

  if (!config.slideSelector) {
    throw new Error('Could not detect slide container');
  }

  return config;
}
