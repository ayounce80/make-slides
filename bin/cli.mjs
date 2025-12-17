#!/usr/bin/env node

import { program } from 'commander';
import { capturePDF } from '../lib/capture.mjs';
import { detectConfig } from '../lib/detect.mjs';
import fs from 'fs';
import path from 'path';

program
  .name('make-pdf')
  .description('Convert React/Vite slide decks to pixel-perfect PDFs')
  .version('1.0.0')
  .option('-u, --url <url>', 'Dev server URL', 'http://localhost:5173')
  .option('-s, --slides <number>', 'Number of slides (auto-detected if not specified)')
  .option('-o, --output <file>', 'Output PDF filename', 'presentation.pdf')
  .option('-w, --width <pixels>', 'Viewport width', '1920')
  .option('-h, --height <pixels>', 'Viewport height', '1080')
  .option('--slide-selector <selector>', 'CSS selector for slide container')
  .option('--nav-selector <selector>', 'CSS selector for navigation dots')
  .option('--nav-method <method>', 'Navigation method: dots, keyboard, url', 'dots')
  .option('--wait <ms>', 'Wait time between slides in ms', '500')
  .option('--keep-screenshots', 'Keep screenshot PNGs after PDF generation')
  .option('--screenshots-dir <dir>', 'Screenshots directory', './screenshots')
  .option('--config <file>', 'Config file path (make-pdf.config.json)')
  .option('--detect', 'Auto-detect slide deck configuration')
  .option('--dry-run', 'Show detected config without capturing');

program.parse();

const opts = program.opts();

async function main() {
  console.log('\n📄 make-pdf - React Slide Deck to PDF\n');

  // Load config file if exists
  let config = {};
  const configPath = opts.config || 'make-pdf.config.json';

  if (fs.existsSync(configPath)) {
    console.log(`Loading config from ${configPath}...`);
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  // Auto-detect if requested or no config
  if (opts.detect || (!config.slideSelector && !opts.slideSelector)) {
    console.log('Auto-detecting slide deck configuration...');
    try {
      const detected = await detectConfig(opts.url);
      config = { ...config, ...detected };
      console.log('Detected:', detected);
    } catch (err) {
      console.log('Auto-detect failed:', err.message);
      console.log('Using defaults or specify --slide-selector and --nav-selector');
    }
  }

  // Merge CLI options over config
  const finalConfig = {
    url: opts.url,
    totalSlides: parseInt(opts.slides) || config.totalSlides || null,
    output: opts.output,
    viewport: {
      width: parseInt(opts.width),
      height: parseInt(opts.height)
    },
    slideSelector: opts.slideSelector || config.slideSelector || '.aspect-\\[16\\/9\\]',
    navSelector: opts.navSelector || config.navSelector || '.w-3.h-3.rounded-full',
    navMethod: opts.navMethod || config.navMethod || 'dots',
    waitTime: parseInt(opts.wait),
    keepScreenshots: opts.keepScreenshots || false,
    screenshotsDir: opts.screenshotsDir
  };

  if (opts.dryRun) {
    console.log('\nDry run - Configuration:');
    console.log(JSON.stringify(finalConfig, null, 2));
    process.exit(0);
  }

  try {
    await capturePDF(finalConfig);
    console.log('\n✅ Done!\n');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
