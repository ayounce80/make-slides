import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { detectSlideCount, navigateToSlide } from './navigation.mjs';

export async function capturePDF(config) {
  const {
    url,
    totalSlides,
    output,
    format = 'pdf',
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

  const screenshots = [];

  try {
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
  } finally {
    await browser.close();
  }

  console.log(`\nCaptured ${screenshots.length} slides`);

  // Generate output based on format
  if (format === 'pptx-image') {
    console.log('\nGenerating PPTX with screenshots...');
    await generatePPTXWithImages(screenshots, output, viewport);
  } else {
    console.log('\nGenerating PDF...');
    await generatePDF(screenshots, output, viewport);
  }
  console.log(`Created: ${output}`);

  // Cleanup screenshots if requested
  if (!keepScreenshots) {
    console.log('Cleaning up screenshots...');
    for (const screenshot of screenshots) {
      try {
        fs.unlinkSync(screenshot);
      } catch (e) {
        // File may not exist, ignore
      }
    }
    try {
      fs.rmdirSync(screenshotsDir);
    } catch (e) {
      // Directory not empty or doesn't exist, ignore
    }
  }

  return { output, slideCount: screenshots.length };
}

async function generatePDF(screenshots, output, viewport) {
  // Try img2pdf first (best quality) - uses argument array to prevent injection
  try {
    execFileSync('img2pdf', [...screenshots, '-o', output], { stdio: 'pipe' });
    return;
  } catch (e) {
    // img2pdf not available or failed
  }

  // Try ImageMagick convert - uses argument array to prevent injection
  try {
    execFileSync('convert', [...screenshots, '-quality', '100', output], { stdio: 'pipe' });
    return;
  } catch (e) {
    // ImageMagick not available or failed
  }

  // Fallback: use Puppeteer to create PDF
  console.log('Note: Install img2pdf or ImageMagick for better PDF quality');
  await createPDFWithPuppeteer(screenshots, output, viewport);
}

async function createPDFWithPuppeteer(screenshots, output, viewport) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Use viewport dimensions from config
    const width = viewport?.width || 1920;
    const height = viewport?.height || 1080;

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
        @page { size: ${width}px ${height}px; margin: 0; }
      </style></head>
      <body>${images}</body></html>`;

    await page.setContent(html);
    await page.pdf({
      path: output,
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
  } finally {
    await browser.close();
  }
}

async function generatePPTXWithImages(screenshots, output, viewport) {
  // Dynamically import pptxgenjs
  const PptxGenJS = (await import('pptxgenjs')).default;

  const pptx = new PptxGenJS();

  // Set slide dimensions (16:9 aspect ratio, in inches)
  pptx.defineLayout({ name: '16x9', width: 10, height: 5.625 });
  pptx.layout = '16x9';

  for (const screenshotPath of screenshots) {
    const slide = pptx.addSlide();

    // Read image as base64
    const imageData = fs.readFileSync(screenshotPath);
    const base64 = imageData.toString('base64');

    // Add as full-bleed background image
    slide.addImage({
      data: `image/png;base64,${base64}`,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%'
    });
  }

  await pptx.writeFile({ fileName: output });
}
