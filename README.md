# make-pdf

Convert React/Vite slide decks to pixel-perfect PDFs.

```
Git Repo → Dev Server → Puppeteer Screenshots → PDF
```

## Installation

```bash
npm install -g make-pdf
# or
npx make-pdf
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
make-pdf               # Capture and generate PDF
```

## Usage

```bash
# Basic usage (auto-detect everything)
make-pdf

# Specify output file
make-pdf -o my-presentation.pdf

# Specify number of slides
make-pdf --slides 15

# Custom dev server URL
make-pdf --url http://localhost:3000

# Custom selectors
make-pdf --slide-selector ".my-slide" --nav-selector ".my-dots"

# Keep screenshots after PDF generation
make-pdf --keep-screenshots

# Dry run to see detected config
make-pdf --detect --dry-run
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `-u, --url` | `http://localhost:5173` | Dev server URL |
| `-s, --slides` | auto-detect | Number of slides |
| `-o, --output` | `presentation.pdf` | Output filename |
| `-w, --width` | `1920` | Viewport width |
| `-h, --height` | `1080` | Viewport height |
| `--slide-selector` | auto-detect | CSS selector for slide container |
| `--nav-selector` | auto-detect | CSS selector for navigation dots |
| `--nav-method` | `dots` | Navigation: `dots`, `keyboard`, `url` |
| `--wait` | `500` | Wait time between slides (ms) |
| `--keep-screenshots` | `false` | Keep PNGs after PDF generation |
| `--screenshots-dir` | `./screenshots` | Screenshots directory |
| `--config` | `make-pdf.config.json` | Config file path |
| `--detect` | | Force auto-detection |
| `--dry-run` | | Show config without capturing |

## Config File

Create `make-pdf.config.json` in your project:

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
make-pdf --nav-method dots --nav-selector ".slide-dot"
```

### keyboard
Uses arrow keys to navigate. Good for reveal.js-style decks.

```bash
make-pdf --nav-method keyboard
```

### url
Navigates via URL hash. Good for URL-routed presentations.

```bash
make-pdf --nav-method url
# Navigates to #slide-1, #slide-2, etc.
```

## Programmatic API

```javascript
import { capturePDF, detectConfig } from 'make-pdf';

// Auto-detect and capture
const detected = await detectConfig('http://localhost:5173');
await capturePDF({
  url: 'http://localhost:5173',
  totalSlides: detected.totalSlides,
  output: 'my-deck.pdf',
  viewport: { width: 1920, height: 1080 },
  slideSelector: detected.slideSelector,
  navSelector: detected.navSelector,
  navMethod: 'dots',
  waitTime: 500,
  keepScreenshots: false,
  screenshotsDir: './screenshots'
});
```

## Works With

- **Figma Make** - Export Make projects to GitHub, then PDF
- **React slide decks** - Any React-based presentation
- **Vite projects** - Optimized for Vite dev server
- **reveal.js** - Use keyboard navigation
- **Any web-based slides** - If it runs in a browser, it works

## Pipeline: Figma Make to PDF

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
   make-pdf -o my-slides.pdf
   ```

## Troubleshooting

### All slides are the same
- Navigation selector is wrong
- Try: `make-pdf --detect --dry-run` to see what's detected
- Increase wait time: `--wait 1000`
- Try keyboard navigation: `--nav-method keyboard`

### Cannot detect slide count
- Specify manually: `--slides 15`

### Poor PDF quality
- Install img2pdf: `pip install img2pdf`
- Increase resolution: `--width 2560 --height 1440`

### Dev server not detected
- Ensure server is running before running make-pdf
- Check URL: `--url http://localhost:3000`

## How It Works

1. **Launch** - Starts headless Chrome via Puppeteer
2. **Navigate** - Opens dev server URL
3. **Detect** - Finds slide container and navigation elements
4. **Capture** - Screenshots each slide at full resolution
5. **Generate** - Combines PNGs into PDF (via img2pdf, ImageMagick, or Puppeteer)

## License

MIT
