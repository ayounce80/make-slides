# make-slides

Convert React/Vite slide decks to PDF or editable PowerPoint presentations.

```
Git Repo → Dev Server → Puppeteer → PDF / PPTX
```

## Features

- **PDF Export** - Screenshot-based, pixel-perfect output
- **PPTX (Screenshots)** - PowerPoint with embedded images
- **PPTX (Editable)** - Native PowerPoint elements with editable text/shapes via dom-to-pptx

## Installation

```bash
npm install -g make-slides
# or
npx make-slides
```

### Prerequisites

For best PDF quality, install img2pdf:
```bash
pip install img2pdf
```

## Quick Start

```bash
# In your slide deck project directory
npm run dev &          # Start dev server

# PDF (default)
make-slides -o slides.pdf

# Editable PPTX (text/shapes are editable in PowerPoint)
make-slides --editable -o slides.pptx

# PPTX with screenshots (pixel-perfect but not editable)
make-slides --format pptx-image -o slides.pptx
```

## Output Formats

| Format | Command | Pros | Cons |
|--------|---------|------|------|
| **PDF** | `make-slides` | Pixel-perfect, universal | Not editable |
| **PPTX (editable)** | `make-slides --editable` | Editable text/shapes, smaller files | System fonts only, minor layout differences |
| **PPTX (screenshots)** | `make-slides --format pptx-image` | Pixel-perfect in PowerPoint | Not editable, larger files |

## Usage

```bash
# Basic usage (auto-detect everything)
make-slides

# Editable PowerPoint
make-slides --editable -o presentation.pptx
make-slides -e -o presentation.pptx
make-slides --format pptx-editable -o presentation.pptx

# PPTX with screenshots
make-slides --format pptx-image -o presentation.pptx

# Specify output file
make-slides -o my-presentation.pdf

# Specify number of slides
make-slides --slides 15

# Custom dev server URL
make-slides --url http://localhost:3000

# Custom selectors
make-slides --slide-selector ".my-slide" --nav-selector ".my-dots"

# Keep screenshots after generation
make-slides --keep-screenshots

# Dry run to see detected config
make-slides --detect --dry-run
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `-u, --url` | `http://localhost:5173` | Dev server URL |
| `-s, --slides` | auto-detect | Number of slides |
| `-o, --output` | `presentation.pdf` | Output filename |
| `-f, --format` | `pdf` | Output format: `pdf`, `pptx-image`, `pptx-editable` |
| `-e, --editable` | | Shorthand for `--format pptx-editable` |
| `-w, --width` | `1920` | Viewport width |
| `--height` | `1080` | Viewport height |
| `--slide-selector` | auto-detect | CSS selector for slide container |
| `--nav-selector` | auto-detect | CSS selector for navigation dots |
| `--nav-method` | `dots` | Navigation: `dots`, `keyboard`, `url` |
| `--wait` | `500` | Wait time between slides (ms) |
| `--keep-screenshots` | `false` | Keep PNGs after generation |
| `--screenshots-dir` | `./screenshots` | Screenshots directory |
| `--config` | `make-slides.config.json` | Config file path |
| `--detect` | | Force auto-detection |
| `--dry-run` | | Show config without capturing |

## Editable PPTX Details

The `--editable` mode uses [dom-to-pptx](https://github.com/atharva9167j/dom-to-pptx) to convert DOM elements to native PowerPoint shapes:

**Supported:**
- Text boxes with styling (font, color, size)
- CSS gradients (linear-gradient)
- Box shadows
- Border radius
- Flexbox/Grid layouts (converted to absolute positioning)
- Mixed-style text (bold/italic within paragraphs)

**Limitations:**
- **System fonts only** - Web fonts fallback to Arial
- **CORS for images** - Cross-origin images may fail; use same-origin hosting
- **Static DOM** - Captures current state, no animations
- **Layout approximation** - Minor differences possible vs browser render

## Config File

Create `make-slides.config.json` in your project:

```json
{
  "totalSlides": 13,
  "slideSelector": ".aspect-\\[16\\/9\\]",
  "navSelector": ".w-3.h-3.rounded-full",
  "navMethod": "dots"
}
```

## Navigation Methods

### dots (default)
Clicks on navigation dot buttons. Best for most React slide decks.

```bash
make-slides --nav-method dots --nav-selector ".slide-dot"
```

### keyboard
Uses arrow keys to navigate. Good for reveal.js-style decks.

```bash
make-slides --nav-method keyboard
```

### url
Navigates via URL hash. Good for URL-routed presentations.

```bash
make-slides --nav-method url
```

## Programmatic API

```javascript
import { capturePDF, captureEditablePptx, detectConfig } from 'make-slides';

// Auto-detect configuration
const detected = await detectConfig('http://localhost:5173');

// Capture PDF
await capturePDF({
  url: 'http://localhost:5173',
  totalSlides: detected.totalSlides,
  output: 'slides.pdf',
  format: 'pdf', // or 'pptx-image'
  viewport: { width: 1920, height: 1080 },
  slideSelector: detected.slideSelector,
  navSelector: detected.navSelector,
  navMethod: 'dots',
  waitTime: 500,
  keepScreenshots: false,
  screenshotsDir: './screenshots'
});

// Capture Editable PPTX
await captureEditablePptx({
  url: 'http://localhost:5173',
  totalSlides: detected.totalSlides,
  output: 'slides.pptx',
  viewport: { width: 1920, height: 1080 },
  slideSelector: detected.slideSelector,
  navSelector: detected.navSelector,
  navMethod: 'dots',
  waitTime: 500
});
```

## Works With

- **Figma Make** - Export Make projects to GitHub, then PDF/PPTX
- **React slide decks** - Any React-based presentation
- **Vite projects** - Optimized for Vite dev server
- **reveal.js** - Use keyboard navigation
- **Any web-based slides** - If it runs in a browser, it works

## Pipeline: Figma Make to PDF/PPTX

1. Create slides in Figma Make
2. Push to GitHub (creates React/Vite code)
3. Clone and install:
   ```bash
   git clone <repo>
   cd <repo>
   npm install
   ```
4. Capture:
   ```bash
   npm run dev &
   make-slides -o slides.pdf           # PDF
   make-slides --editable -o slides.pptx  # Editable PPTX
   ```

## Troubleshooting

### All slides are the same
- Navigation selector is wrong
- Try: `make-slides --detect --dry-run` to see what's detected
- Increase wait time: `--wait 1000`
- Try keyboard navigation: `--nav-method keyboard`

### Cannot detect slide count
- Specify manually: `--slides 15`

### Poor PDF quality
- Install img2pdf: `pip install img2pdf`
- Increase resolution: `--width 2560 --height 1440`

### Editable PPTX has wrong fonts
- Web fonts are not supported; slides will use system fonts (Arial, etc.)
- For exact fonts, use `--format pptx-image` instead

### Images missing in editable PPTX
- Cross-origin images may be blocked due to CORS
- Host images on same domain or use screenshot mode

## How It Works

### PDF / PPTX-Image Mode
1. **Launch** - Starts headless Chrome via Puppeteer
2. **Navigate** - Opens dev server URL
3. **Detect** - Finds slide container and navigation elements
4. **Capture** - Screenshots each slide at full resolution
5. **Generate** - Combines PNGs into PDF or PPTX

### Editable PPTX Mode
1. **Launch** - Starts headless Chrome via Puppeteer
2. **Inject** - Loads dom-to-pptx library into page
3. **Navigate** - Captures each slide's DOM state
4. **Convert** - Transforms DOM elements to PowerPoint shapes
5. **Generate** - Outputs native PPTX with editable elements

## License

MIT
