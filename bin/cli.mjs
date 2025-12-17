#!/usr/bin/env node

import { program, Option } from 'commander';
import { capturePDF } from '../lib/capture.mjs';
import { captureEditablePptx } from '../lib/editable-pptx.mjs';
import { detectConfig } from '../lib/detect.mjs';
import fs from 'fs';
import path from 'path';

program
  .name('make-slides')
  .description('Convert React/Vite slide decks to PDF or editable PPTX')
  .version('1.3.0')
  .option('-u, --url <url>', 'Dev server URL', 'http://localhost:5173')
  .option('-s, --slides <number>', 'Number of slides (auto-detected if not specified)')
  .option('-o, --output <file>', 'Output filename', 'presentation.pdf')
  .addOption(new Option('-f, --format <type>', 'Output format').choices(['pdf', 'pptx-image', 'pptx-editable']).default('pdf'))
  .option('-e, --editable', 'Shorthand for --format pptx-editable (editable PowerPoint)')
  .option('-w, --width <pixels>', 'Viewport width', '1920')
  .option('--height <pixels>', 'Viewport height', '1080')
  .option('--slide-selector <selector>', 'CSS selector for slide container')
  .option('--nav-selector <selector>', 'CSS selector for navigation dots')
  .option('--nav-method <method>', 'Navigation method: dots, keyboard, url', 'dots')
  .option('--wait <ms>', 'Wait time between slides in ms', '500')
  .option('--keep-screenshots', 'Keep screenshot PNGs after generation')
  .option('--screenshots-dir <dir>', 'Screenshots directory', './screenshots')
  .option('--config <file>', 'Config file path (make-slides.config.json)')
  .option('--detect', 'Auto-detect slide deck configuration')
  .option('--dry-run', 'Show detected config without capturing')
  .option('--sandbox', 'Run Chrome with sandbox enabled (more secure, may not work in all environments)')
  .option('--timeout <ms>', 'Download timeout for editable PPTX in ms', '60000');

program.parse();

const opts = program.opts();

async function main() {
  // Determine format
  let format = opts.format;
  if (opts.editable) {
    format = 'pptx-editable';
  }

  // Set appropriate header
  const formatLabels = {
    'pdf': '📄 make-slides - React Slide Deck to PDF',
    'pptx-image': '📊 make-slides - React Slide Deck to PPTX (screenshots)',
    'pptx-editable': '✏️ make-slides - React Slide Deck to Editable PPTX'
  };
  console.log(`\n${formatLabels[format] || formatLabels['pdf']}\n`);

  // Load config file if exists
  let config = {};
  const configPath = opts.config || 'make-slides.config.json';

  if (fs.existsSync(configPath)) {
    console.log(`Loading config from ${configPath}...`);
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err) {
      console.error(`Error parsing config file ${configPath}: ${err.message}`);
      process.exit(1);
    }
  }

  // Validate numeric options
  const width = parseInt(opts.width);
  const height = parseInt(opts.height);
  const wait = parseInt(opts.wait);
  const timeout = parseInt(opts.timeout);
  const slides = opts.slides ? parseInt(opts.slides) : null;

  if (isNaN(width) || width <= 0) {
    console.error('Error: --width must be a positive number');
    process.exit(1);
  }
  if (isNaN(height) || height <= 0) {
    console.error('Error: --height must be a positive number');
    process.exit(1);
  }
  if (isNaN(wait) || wait < 0) {
    console.error('Error: --wait must be a non-negative number');
    process.exit(1);
  }
  if (isNaN(timeout) || timeout <= 0) {
    console.error('Error: --timeout must be a positive number');
    process.exit(1);
  }
  if (slides !== null && (isNaN(slides) || slides <= 0)) {
    console.error('Error: --slides must be a positive number');
    process.exit(1);
  }

  // Auto-detect if requested or no config
  if (opts.detect || (!config.slideSelector && !opts.slideSelector)) {
    console.log('Auto-detecting slide deck configuration...');
    try {
      const detected = await detectConfig(opts.url, { sandbox: opts.sandbox });
      config = { ...config, ...detected };
      console.log('Detected:', detected);
    } catch (err) {
      console.log('Auto-detect failed:', err.message);
      console.log('Using defaults or specify --slide-selector and --nav-selector');
    }
  }

  // Determine output filename based on format if using default
  let outputFile = opts.output;
  if (outputFile === 'presentation.pdf') {
    if (format === 'pptx-editable' || format === 'pptx-image') {
      outputFile = 'presentation.pptx';
    }
  }

  // Merge CLI options over config
  const finalConfig = {
    url: opts.url,
    totalSlides: slides || config.totalSlides || null,
    output: outputFile,
    format: format,
    viewport: { width, height },
    slideSelector: opts.slideSelector || config.slideSelector || '.aspect-\\[16\\/9\\]',
    navSelector: opts.navSelector || config.navSelector || '.w-3.h-3.rounded-full',
    navMethod: opts.navMethod || config.navMethod || 'dots',
    waitTime: wait,
    keepScreenshots: opts.keepScreenshots || false,
    screenshotsDir: opts.screenshotsDir,
    sandbox: opts.sandbox || false,
    downloadTimeout: timeout
  };

  if (opts.dryRun) {
    console.log('\nDry run - Configuration:');
    console.log(JSON.stringify(finalConfig, null, 2));
    process.exit(0);
  }

  try {
    if (format === 'pptx-editable') {
      await captureEditablePptx(finalConfig);
    } else {
      // pdf or pptx-image both use screenshot approach
      await capturePDF(finalConfig);
    }
    console.log('\n✅ Done!\n');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
