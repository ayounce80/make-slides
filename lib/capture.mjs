import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export async function capturePDF(config) {
  const {
    url,
    totalSlides,
    output,
    viewport,
    slideSelector,
    navSelector,
    navMethod,
    waitTime,
    keepScreenshots,
    screenshotsDir
  } = config;

  console.log('Launching browser...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport(viewport);

  // Create screenshots directory
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for slide container
  console.log(`Waiting for slide container (${slideSelector})...`);
  await page.waitForSelector(slideSelector, { timeout: 10000 });

  // Detect total slides if not specified
  let slides = totalSlides;
  if (!slides) {
    console.log('Detecting slide count...');
    slides = await detectSlideCount(page, navSelector, navMethod);
    console.log(`Detected ${slides} slides`);
  }

  // Wait for navigation elements
  if (navMethod === 'dots') {
    await page.waitForSelector(navSelector, { timeout: 5000 });
  }

  const screenshots = [];

  for (let i = 0; i < slides; i++) {
    console.log(`Capturing slide ${i + 1}/${slides}...`);

    // Navigate to slide
    await navigateToSlide(page, i, navSelector, navMethod, waitTime);

    // Capture screenshot
    const slideElement = await page.$(slideSelector);
    if (slideElement) {
      const screenshotPath = path.join(screenshotsDir, `slide-${String(i + 1).padStart(3, '0')}.png`);
      await slideElement.screenshot({ path: screenshotPath, type: 'png' });
      screenshots.push(screenshotPath);
    } else {
      console.warn(`  Warning: Could not find slide element for slide ${i + 1}`);
    }
  }

  await browser.close();
  console.log(`\nCaptured ${screenshots.length} slides`);

  // Generate PDF
  console.log('\nGenerating PDF...');
  await generatePDF(screenshots, output);
  console.log(`Created: ${output}`);

  // Cleanup screenshots if requested
  if (!keepScreenshots) {
    console.log('Cleaning up screenshots...');
    for (const screenshot of screenshots) {
      fs.unlinkSync(screenshot);
    }
    try {
      fs.rmdirSync(screenshotsDir);
    } catch (e) {
      // Directory not empty or doesn't exist, ignore
    }
  }

  return { output, slideCount: screenshots.length };
}

async function detectSlideCount(page, navSelector, navMethod) {
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

  // Default fallback
  console.warn('Could not detect slide count, defaulting to 10');
  return 10;
}

async function navigateToSlide(page, index, navSelector, navMethod, waitTime) {
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

async function generatePDF(screenshots, output) {
  const pngFiles = screenshots.join(' ');

  // Try img2pdf first (best quality)
  try {
    execSync(`img2pdf ${pngFiles} -o "${output}"`, { stdio: 'pipe' });
    return;
  } catch (e) {
    // img2pdf not available
  }

  // Try ImageMagick convert
  try {
    execSync(`convert ${pngFiles} -quality 100 "${output}"`, { stdio: 'pipe' });
    return;
  } catch (e) {
    // ImageMagick not available
  }

  // Fallback: use Puppeteer to create PDF
  console.log('Using Puppeteer PDF generation (img2pdf recommended for best quality)');
  await createPDFWithPuppeteer(screenshots, output);
}

async function createPDFWithPuppeteer(screenshots, output) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Create HTML with all images
  const images = screenshots.map(s => {
    const data = fs.readFileSync(s).toString('base64');
    return `<div style="page-break-after: always; margin: 0; padding: 0;">
      <img src="data:image/png;base64,${data}" style="width: 100%; height: 100%; object-fit: contain;">
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
    <html><head><style>
      * { margin: 0; padding: 0; }
      @page { size: 1920px 1080px; margin: 0; }
    </style></head>
    <body>${images}</body></html>`;

  await page.setContent(html);
  await page.pdf({
    path: output,
    width: '1920px',
    height: '1080px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });

  await browser.close();
}
