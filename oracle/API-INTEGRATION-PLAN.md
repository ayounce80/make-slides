# Z.AI API Integration Plan

## Overview

This plan describes how to use the Z.AI Slide Agent API as an "oracle" to systematically test and improve our local renderer. The API will be used **after** achieving basic parity with our reference PPTX files.

## Prerequisites (Must Complete First)

Before API integration, complete these parity fixes:
- [ ] Title slide decorative elements (gradient, divider, footer)
- [ ] Header bar on content slides
- [ ] Callout left-border accent and icon
- [ ] Comparison table row striping and icons
- [ ] Icon usage on all element types

**Budget:** $20 (~28M tokens at $0.7/M)

---

## Phase 0: Oracle Plumbing Validation

### Goal
Confirm API can export PPTX (or fallback to HTML/PDF parsing).

### Deliverables
```
oracle/scripts/
  oracle_call.ts      # Send request to Z.AI API
  oracle_extract.ts   # Download artifacts from response
  oracle_smoke.ts     # End-to-end test with 1 probe
```

### Implementation

#### oracle_call.ts
```typescript
import fs from 'fs';
import path from 'path';

const ZAI_API_KEY = process.env.ZAI_API_KEY;
const ZAI_ENDPOINT = 'https://api.z.ai/api/v1/agents';

interface OracleCallOptions {
  prompt: string;
  runId: string;
  outputDir: string;
}

export async function callOracle(options: OracleCallOptions) {
  const response = await fetch(ZAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ZAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: 'ppt',
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: options.prompt }]
      }],
      stream: false,
    }),
  });

  const data = await response.json();

  // Save raw response
  const outputPath = path.join(options.outputDir, 'response.json');
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  return data;
}
```

#### API Response Analysis
The response will likely contain:
- `choices[0].messages[0].content.text` - HTML slide content
- Possible `file_url` or `attachments` for PPTX/PDF
- Token usage stats

If PPTX not available via API, fallback options:
1. Parse HTML from response, generate PPTX locally
2. Use Playwright to automate chat UI export

---

## Phase 1: Presentation Diff Toolkit

### Goal
Build tools to quantify differences between oracle and local output.

### Deliverables
```
oracle/scripts/
  analyze_pptx.ts     # Extract structure from PPTX
  diff_pptx.ts        # Compare two PPTX structures
  render_pptx.sh      # Convert PPTX to PNG slides
  diff_images.ts      # Pixel-diff slide images
```

### analyze_pptx.ts Output Format
```json
{
  "slides": [
    {
      "index": 0,
      "shapes": 6,
      "pictures": 0,
      "textRuns": 4,
      "fontSizes": [4305, 1435, 1196, 956],
      "fills": ["#13487A", "#FFFFFF"],
      "geometries": ["rect", "roundRect"],
      "boundingBoxes": [
        { "x": 0, "y": 0, "w": 12191695, "h": 6858000 }
      ]
    }
  ],
  "totals": {
    "shapes": 786,
    "pictures": 189,
    "uniqueFonts": ["Roboto", "Roboto Light"]
  }
}
```

### diff_pptx.ts Output
```json
{
  "slideDeltas": [
    {
      "slide": 0,
      "shapesDiff": -4,
      "missingFontSizes": [1196, 956],
      "extraFontSizes": []
    }
  ],
  "severity": "high",
  "topIssues": [
    "Slide 1: missing 4 shapes (gradient overlay, dividers)",
    "Slide 7: missing 3 icons"
  ]
}
```

---

## Phase 2: Capability Probe Matrix

### Goal
Systematically discover Z.AI capabilities with targeted prompts.

### Probe Deck Definitions

#### probe-baseline.json
```json
{
  "name": "baseline",
  "description": "Typography and spacing validation",
  "prompts": [
    "Create a 3-slide presentation about project management basics"
  ],
  "expectedSlides": ["title", "content", "closing"],
  "checkpoints": [
    "title slide has gradient background",
    "content slide has header bar",
    "fonts are Roboto family"
  ]
}
```

#### probe-cards.json
```json
{
  "name": "cards",
  "description": "Icon card layout patterns",
  "prompts": [
    "Create a slide showing 4 key benefits of cloud computing with icons"
  ],
  "expectedElements": ["icon-card"],
  "checkpoints": [
    "4 icon cards in 2x2 grid",
    "each card has icon + title + description",
    "icons are check_circle or similar"
  ]
}
```

#### probe-comparison.json
```json
{
  "name": "comparison",
  "description": "Feature matrix and comparison tables",
  "prompts": [
    "Compare AWS vs Azure vs GCP across 5 criteria: pricing, scalability, security, ease of use, ecosystem"
  ],
  "expectedElements": ["comparison-table"],
  "checkpoints": [
    "3-column table layout",
    "row striping visible",
    "boolean values have icons"
  ]
}
```

#### probe-process.json
```json
{
  "name": "process",
  "description": "Timeline and process flows",
  "prompts": [
    "Show a 5-step onboarding process with phases: Apply, Interview, Offer, Training, Start"
  ],
  "expectedElements": ["process-timeline"],
  "checkpoints": [
    "5 horizontal phases",
    "numbered badges",
    "connecting elements"
  ]
}
```

#### probe-charts.json
```json
{
  "name": "charts",
  "description": "Data visualization handling",
  "prompts": [
    "Show quarterly revenue: Q1=$10M, Q2=$15M, Q3=$12M, Q4=$20M as a bar chart"
  ],
  "expectedElements": ["chart"],
  "checkpoints": [
    "determine if chart is editable shapes or rasterized image",
    "check axis labels and legend"
  ]
}
```

#### probe-themes.json
```json
{
  "name": "themes",
  "description": "Dynamic theme generation by domain",
  "prompts": [
    "Create a pitch deck for a fashion startup",
    "Create a technical architecture overview for a SaaS platform",
    "Create a sports highlights presentation for a basketball team"
  ],
  "checkpoints": [
    "fashion: pink/coral accent, Playfair Display heading",
    "technical: blue accent, Roboto, solid backgrounds",
    "sports: team-appropriate colors, photo backgrounds"
  ]
}
```

---

## Phase 3: Run Experiments

### Experiment Loop
```bash
#!/bin/bash
# run_experiment.sh

PROBE=$1
TIMESTAMP=$(date +%Y-%m-%dT%H%M%S)
RUN_DIR="oracle/runs/${TIMESTAMP}_${PROBE}"

mkdir -p "$RUN_DIR"/{oracle,local,analysis,renders,diffs}

# 1. Call oracle API
npx tsx oracle/scripts/oracle_call.ts \
  --probe "oracle/probes/${PROBE}.json" \
  --output "$RUN_DIR/oracle"

# 2. Generate local output from same content
npx tsx oracle/scripts/local_generate.ts \
  --input "$RUN_DIR/oracle/content.json" \
  --output "$RUN_DIR/local/output.pptx"

# 3. Analyze both PPTXs
npx tsx oracle/scripts/analyze_pptx.ts "$RUN_DIR/oracle/*.pptx" > "$RUN_DIR/analysis/oracle.json"
npx tsx oracle/scripts/analyze_pptx.ts "$RUN_DIR/local/output.pptx" > "$RUN_DIR/analysis/local.json"

# 4. Compute diff
npx tsx oracle/scripts/diff_pptx.ts \
  "$RUN_DIR/analysis/oracle.json" \
  "$RUN_DIR/analysis/local.json" \
  > "$RUN_DIR/diffs/structural.json"

# 5. Render to images and visual diff
./oracle/scripts/render_pptx.sh "$RUN_DIR/oracle" "$RUN_DIR/renders/oracle"
./oracle/scripts/render_pptx.sh "$RUN_DIR/local" "$RUN_DIR/renders/local"
npx tsx oracle/scripts/diff_images.ts "$RUN_DIR/renders" > "$RUN_DIR/diffs/visual.json"

# 6. Generate summary
npx tsx oracle/scripts/summarize_run.ts "$RUN_DIR" > "$RUN_DIR/SUMMARY.md"
```

### Invariant Extraction

After each experiment, update the spec:
```
oracle/spec/
  typography-rules.json    # Font size mappings
  spacing-rules.json       # Padding, margins, gutters
  color-rules.json         # Opacity levels, semantic colors
  icon-rules.json          # When to use which icons
  layout-rules.json        # Grid patterns, breakpoints
```

---

## Phase 4: Continuous Regression Testing

### Nightly Test Suite
```yaml
# .github/workflows/oracle-regression.yml
name: Oracle Regression
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run probe suite
        env:
          ZAI_API_KEY: ${{ secrets.ZAI_API_KEY }}
        run: |
          for probe in oracle/probes/*.json; do
            ./oracle/run_experiment.sh $(basename $probe .json)
          done

      - name: Check regressions
        run: |
          npx tsx oracle/scripts/check_regressions.ts

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: oracle-runs
          path: oracle/runs/
```

---

## API Cost Estimation

| Probe Type | Est. Tokens | Cost | Runs |
|------------|-------------|------|------|
| baseline | 5,000 | $0.0035 | 50 |
| cards | 8,000 | $0.0056 | 30 |
| comparison | 10,000 | $0.007 | 20 |
| process | 8,000 | $0.0056 | 20 |
| charts | 12,000 | $0.0084 | 20 |
| themes | 15,000 | $0.0105 | 30 |

**Total estimated:** ~$2.50 for full initial suite
**Budget remaining:** ~$17.50 for iterations

---

## Success Criteria

### Phase 0 Complete
- [ ] Can call API and save response
- [ ] Can extract/download PPTX or HTML
- [ ] Token usage tracked per call

### Phase 1 Complete
- [ ] analyze_pptx extracts all key metrics
- [ ] diff_pptx identifies structural differences
- [ ] Visual diff produces usable heatmaps

### Phase 2 Complete
- [ ] 6 probe decks defined and tested
- [ ] Invariants documented for each aspect

### Phase 3 Complete
- [ ] 50+ experiments run
- [ ] Spec files capture all discovered rules
- [ ] Local renderer matches oracle within 10% on key metrics

### Ready for Production
- [ ] Nightly regression passing
- [ ] No critical regressions in 7 days
- [ ] Google Slides import verified for all probe types
