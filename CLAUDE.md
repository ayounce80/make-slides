# Magic Slides - Claude Code Context

## Project Overview

A slide generation system that produces professional PPTX presentations from JSON schema, reverse-engineered from Z.AI's Magic Slides to achieve feature parity.

## Current Status: Phase 1 - Slide Parity (94% Shapes)

### Parity Metrics (vs Z.AI Colts Reference)
| Metric | Ours | Z.AI | Parity |
|--------|------|------|--------|
| **Total Shapes** | **917** | **975** | **94%** ✓ |
| rect | 636 | 685 | 93% |
| roundRect | 187 | 232 | 81% |
| round2SameRect | 94 | 58 | 162% ↑ |

### Completed
- [x] Font size px→pt conversion (0.598 factor validated against Z.AI)
- [x] Typography scale matching Z.AI (72px→43.05pt, 40px→23.92pt, etc.)
- [x] Icon pipeline with Google Material Icons → MDI mapping
- [x] Basic slide types: title, section, content, agenda, closing
- [x] Icon-cards with colored PNG embedding + icon background + title bg + bottom accent
- [x] Comparison table with card layout, row striping, round2SameRect accents
- [x] Callouts with left-border accent (round2SameRect, rotated 270°)
- [x] Header bar sizing (0.85" matching Z.AI) with gradient overlay, bottom accent, left bar
- [x] Title slides with gradient overlay, divider, side decorations, footer
- [x] Section divider slides with decorative bands, title container, accent lines
- [x] round2SameRect shape support with 270° rotation
- [x] Numbered items with background, left accent bar, badge depth
- [x] Text blocks with size-specific backgrounds (heading, subheading, body)
- [x] Content slide footer area with accent line and background
- [x] **94% shape parity achieved** (target was 85%)

### Upcoming (Phase 2)
- [ ] Z.AI API integration for differential testing
- [ ] Oracle harness for automated comparison
- [ ] Process/timeline slides
- [ ] KPI cards (big number + label)
- [ ] Chart primitives (bar charts using shapes)

---

## Z.AI Reverse Engineering Roadmap

### Phase 1: Slide Parity ✓ COMPLETE (94%)
Shape parity achieved - local renderer matches Z.AI output quality.

### Phase 2: Oracle Infrastructure
Build differential testing harness to compare outputs.

```
oracle/
  probes/           # Probe deck JSON files
  runs/             # Timestamped comparison runs
  scripts/          # Analysis tools
    oracle_call.mjs
    analyze_pptx.mjs
    diff_pptx.mjs
    diff_images.mjs
```

### Phase 3: API Exploration
Use $20 Z.AI API credits for systematic capability probing.

**Test dimensions:**
- Thematic styles by domain (business, creative, sports, scientific)
- Slide length and structure control
- Chart/visualization handling
- Photo background integration

---

## Z.AI API Reference

### Endpoints
- **Agent API**: `POST https://api.z.ai/api/v1/agents`
- **Agent ID**: `ppt` (for slides)
- **Pricing**: $0.7/M tokens (~28M tokens for $20)

### Documentation URLs
- Slide Agent Guide: https://docs.z.ai/guides/agents/slide
- API Reference: https://docs.z.ai/api-reference/introduction
- Agent Chat API: https://docs.z.ai/api-reference/agents/agent
- Structured Output: https://docs.z.ai/guides/capabilities/struct-output
- Quick Start: https://docs.z.ai/guides/overview/quick-start

### API Call Format
```bash
curl -X POST "https://api.z.ai/api/v1/agents" \
  -H "Authorization: Bearer $ZAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "ppt",
    "messages": [{"role": "user", "content": [{"type": "text", "text": "PROMPT"}]}],
    "stream": false
  }'
```

---

## Validated Z.AI Design System

### Typography Scale (px → PPTX pt)
| CSS px | PPTX pt | sz attr | Usage |
|--------|---------|---------|-------|
| 72px | 43.05pt | 4305 | Title |
| 40px | 23.92pt | 2392 | Header bar |
| 24px | 14.35pt | 1435 | Subheading |
| 22px | 13.15pt | 1315 | Body |
| 20px | 11.96pt | 1196 | Card title |
| 18px | 10.76pt | 1076 | Card body |
| 16px | 9.56pt | 956 | Caption/footer |

**Conversion formula:** `PPTX_pt = floor(px * 59.8) / 100`

### Shape Types (Only 3)
- `rect` - Basic rectangles
- `roundRect` - Rounded corners (8px radius)
- `round2SameRect` - Top corners rounded only

### Color System
- **Grayscale always present:** #000, #333, #555, #666, #E0E0E0, #F5F5F5, #FFF
- **Primary accent:** Topic-semantically derived
- **Transparency levels:** 5%, 8%, 10%, 15%, 85%

### Font Pairings by Domain
| Domain | Heading Font | Body Font | Special |
|--------|-------------|-----------|---------|
| Business/Technical | Roboto | Roboto | — |
| Fashion/Editorial | Playfair Display | Source Sans Pro | — |
| Sports/Athletic | Source Sans Pro | Source Sans Pro | — |
| Comedy/Playful | Impact | Roboto | Courier New (equations) |

### Slide Dimensions
- **HTML:** 1280×720px
- **PPTX EMUs:** 12,191,695×6,858,000
- **Conversion:** 9525 EMUs = 1px

---

## Key Files

### Source Code
- `src/renderers/pptx.ts` - PPTX generation with pptxgenjs
- `src/icons/renderer.ts` - Material Icons → colored PNG pipeline
- `src/schema/slide.ts` - TypeScript interfaces for slide model
- `src/theme/generator.ts` - Semantic theme generation

### Research Data
- `data/z-ai-research/Z-AI-RESEARCH-SUMMARY.md` - Full research findings
- `data/z-ai-research/HTML-TO-PPTX-MAPPING.md` - Element mapping spec
- `data/z-ai-research/colts-reference-pptx/` - Business deck reference (35 slides)
- `data/z-ai-research/nadal-pptx/` - Sports deck reference (6 slides)
- `data/z-ai-research/bigbang-pptx/` - Entertainment deck reference (7 slides)

### Scripts
- `scripts/test-generate.ts` - Generate PPTX from slides.json
- `scripts/convert-slides-json.ts` - Convert Z.AI JSON format to our schema

---

## Google Slides Compatibility

### Safe Fonts (Native)
Roboto, Open Sans, Lato, Source Sans Pro, Arial

### Unsafe Fonts (May Substitute)
Playfair Display, Impact, Courier New

### Layout Safety Rules
- +4% width buffer on text boxes (prevents wrapping drift)
- Max lines clamp per text role
- Icons always PNG (never SVG)
- Render icons at 3x, display at target size

---

## Commands

```bash
# Build
npm run build

# Generate timestamped test PPTX
npx tsx scripts/test-generate.ts
# Output: data/z-ai-research/runs/{timestamp}/output.pptx

# Analyze PPTX structure
npx tsx oracle/scripts/analyze_pptx.ts path/to/file.pptx

# Call Z.AI oracle (requires ZAI_API_KEY)
ZAI_API_KEY=xxx npx tsx oracle/scripts/oracle_call.ts --probe probe-baseline
```

---

## Oracle Infrastructure

### Directory Structure
```
oracle/
  probes/                    # Probe deck definitions
    probe-baseline.json      # Typography/spacing test
    probe-cards.json         # Icon card layouts
    probe-comparison.json    # Feature matrix tables
    probe-process.json       # Timeline/process flows
    probe-charts.json        # Data visualization
    probe-themes.json        # Dynamic theme by domain
  scripts/
    oracle_call.ts           # Z.AI API client
    analyze_pptx.ts          # PPTX structure extractor
  runs/                      # Timestamped experiment results
  PARITY-GAP-ANALYSIS.md     # Current gap assessment
  API-INTEGRATION-PLAN.md    # Detailed API strategy
```

### Parity Gap Summary (as of 2025-12-26, 20:53)
| Metric | Our Output | Z.AI Reference | Parity |
|--------|------------|----------------|--------|
| Shapes | 429 | 786 | 54.6% ✓ |
| Images | 68 | 189 | 36.0% |
| Font sizes | Matched | Matched | 100% |

**Shape breakdown:**
- `rect`: 363 vs 685 (53%)
- `roundRect`: 134 vs 232 (58%)
- `round2SameRect`: 0 vs 58 (0%)

**Completed parity fixes (Phase 1):**
- [x] Title slide decorative elements (gradient overlay, divider, footer, "Prepared for" attribution)
- [x] Header bar on content slides (0.85" height matching Z.AI)
- [x] Callout left-border accent and icon
- [x] Comparison table row striping and boolean icons
- [x] Icon background roundRect for icon-cards
- [x] Numbered items using roundRect (not ellipse)
- [x] Section divider slides with centered title + decorative line

**Remaining gaps to close:**
1. `round2SameRect` shapes (tab-like elements, 0 vs 58)
2. More icon usage in slides (68 vs 189 images)
3. Additional decorative shapes per slide
