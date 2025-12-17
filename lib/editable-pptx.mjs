import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';
import { detectSlideCount, navigateToSlide } from './navigation.mjs';

const require = createRequire(import.meta.url);

/**
 * Capture slides and export to editable PPTX using dom-to-pptx
 * This creates native PowerPoint elements (text boxes, shapes) that are editable
 */
export async function captureEditablePptx(config) {
  const {
    url,
    totalSlides,
    output,
    viewport,
    slideSelector,
    navSelector,
    navMethod,
    waitTime,
    sandbox = false,
    downloadTimeout = 60000
  } = config;

  console.log('Launching browser for editable PPTX export...');

  // Create temp download directory
  const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'make-slides-'));
  const tempPptxPath = path.join(downloadDir, 'export.pptx');

  const browserArgs = sandbox ? [] : ['--no-sandbox', '--disable-setuid-sandbox'];
  const browser = await puppeteer.launch({
    headless: true,
    args: browserArgs
  });

  let slideCount = 0;

  try {
    const page = await browser.newPage();
    await page.setViewport(viewport);

    // Set up download handling via CDP
    const client = await page.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir
    });

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for slide container
    console.log(`Waiting for slide container (${slideSelector})...`);
    await page.waitForSelector(slideSelector, { timeout: 10000 });

    // Inject dom-to-pptx bundle
    console.log('Injecting dom-to-pptx library...');
    let bundlePath;
    try {
      // Resolve the package main entry, then find the bundle in dist/
      const pkgMain = require.resolve('dom-to-pptx');
      bundlePath = path.join(path.dirname(pkgMain), 'dom-to-pptx.bundle.js');
    } catch (e) {
      throw new Error('dom-to-pptx not found. Run: npm install dom-to-pptx');
    }

    if (!fs.existsSync(bundlePath)) {
      throw new Error(`dom-to-pptx bundle not found at ${bundlePath}. Run: npm install dom-to-pptx`);
    }

    await page.addScriptTag({ path: bundlePath });

    // Wait for library to be available
    await page.waitForFunction(() => typeof window.domToPptx !== 'undefined', { timeout: 5000 });

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

    // Collect all slide elements by navigating through each slide
    const slideHTMLs = [];

    for (let i = 0; i < slides; i++) {
      console.log(`Preparing slide ${i + 1}/${slides}...`);

      // Navigate to slide
      await navigateToSlide(page, i, navSelector, navMethod, waitTime);

      // Get the slide's outer HTML for later reconstruction
      const slideHTML = await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        return el ? el.outerHTML : null;
      }, slideSelector);

      if (slideHTML) {
        slideHTMLs.push(slideHTML);
      } else {
        console.warn(`  Warning: Could not find slide element for slide ${i + 1}`);
      }
    }

    slideCount = slideHTMLs.length;
    console.log(`\nExporting ${slideCount} slides to editable PPTX...`);

    // Create slide elements and trigger export (will download file)
    await page.evaluate(async (slideHTMLs, slideSelector, viewport) => {
      // Create a container for all slides
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      // Add each slide as a child element
      const slideElements = [];
      for (const html of slideHTMLs) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        const slideEl = wrapper.firstChild;
        slideEl.style.width = viewport.width + 'px';
        slideEl.style.height = viewport.height + 'px';
        container.appendChild(slideEl);
        slideElements.push(slideEl);
      }

      // Wait a moment for styles to compute
      await new Promise(r => setTimeout(r, 500));

      // Export all slides to PPTX (triggers download)
      await window.domToPptx.exportToPptx(slideElements, {
        fileName: 'export.pptx'
      });

      // Cleanup
      container.remove();
    }, slideHTMLs, slideSelector, viewport);

    // Wait for download to complete
    console.log('Waiting for download to complete...');
    let downloadComplete = false;
    const maxIterations = Math.ceil(downloadTimeout / 500);
    for (let i = 0; i < maxIterations; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (fs.existsSync(tempPptxPath)) {
        // Check if file is still being written (no .crdownload)
        const files = fs.readdirSync(downloadDir);
        const hasPartialFile = files.some(f => f.endsWith('.crdownload'));
        if (!hasPartialFile) {
          downloadComplete = true;
          break;
        }
      }
    }

    if (!downloadComplete) {
      throw new Error(`Download timed out after ${downloadTimeout / 1000}s. Try increasing --timeout`);
    }

    // Move downloaded file to output location
    const outputPath = path.resolve(output);
    fs.copyFileSync(tempPptxPath, outputPath);

    // Get file size for logging
    const stats = fs.statSync(outputPath);
    console.log(`Created: ${output} (${(stats.size / 1024).toFixed(1)} KB)`);

  } finally {
    // Always close browser and cleanup temp dir
    await browser.close();
    try {
      fs.rmSync(downloadDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  return { output, slideCount };
}
