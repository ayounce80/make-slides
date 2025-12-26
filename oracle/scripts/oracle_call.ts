/**
 * Oracle Call - Send request to Z.AI Slide Agent API
 *
 * Usage:
 *   ZAI_API_KEY=xxx npx tsx oracle/scripts/oracle_call.ts --probe probe-baseline
 *
 * Output:
 *   oracle/runs/{timestamp}_{probe}/
 *     response.json    - Raw API response
 *     content.json     - Extracted slide content
 *     artifacts/       - Downloaded files (PPTX/PDF)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// Configuration
// =============================================================================

const ZAI_API_KEY = process.env.ZAI_API_KEY;
const ZAI_ENDPOINT = 'https://api.z.ai/api/v1/agents';
const AGENT_ID = 'slides_glm_agent';

// =============================================================================
// Types
// =============================================================================

interface ProbeConfig {
  name: string;
  description: string;
  prompt?: string;
  prompts?: Array<{ id: string; prompt: string }>;
  expectedSlides?: string[];
  expectedElements?: string[];
  checkpoints: string[];
  maxSlides?: number;
  category: string;
}

interface OracleResponse {
  choices?: Array<{
    messages?: Array<{
      content?: {
        text?: string;
      };
    }>;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  // May include file URLs or attachments
  file_url?: string;
  attachments?: Array<{
    type: string;
    url: string;
    name: string;
  }>;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  const probeArg = args.find((a) => a.startsWith('--probe='))?.split('=')[1]
    || args[args.indexOf('--probe') + 1];

  if (!probeArg) {
    console.error('Usage: npx tsx oracle_call.ts --probe <probe-name>');
    console.error('Example: npx tsx oracle_call.ts --probe probe-baseline');
    process.exit(1);
  }

  if (!ZAI_API_KEY) {
    console.error('Error: ZAI_API_KEY environment variable not set');
    console.error('Set it with: export ZAI_API_KEY=your_api_key');
    process.exit(1);
  }

  // Load probe config
  const probePath = path.join(__dirname, '../probes', `${probeArg}.json`);
  if (!fs.existsSync(probePath)) {
    console.error(`Probe not found: ${probePath}`);
    process.exit(1);
  }

  const probe: ProbeConfig = JSON.parse(fs.readFileSync(probePath, 'utf-8'));
  console.log(`\n=== Oracle Call: ${probe.name} ===`);
  console.log(`Description: ${probe.description}`);

  // Create run directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = path.join(__dirname, '../runs', `${timestamp}_${probe.name}`);
  fs.mkdirSync(path.join(runDir, 'artifacts'), { recursive: true });

  // Get prompt(s) to execute
  const prompts = probe.prompts
    ? probe.prompts.map((p) => ({ id: p.id, prompt: p.prompt }))
    : [{ id: 'main', prompt: probe.prompt! }];

  for (const { id, prompt } of prompts) {
    console.log(`\nCalling API for: ${id}`);
    console.log(`Prompt: ${prompt.slice(0, 100)}...`);

    try {
      const response = await callOracleAPI(prompt);

      // Save response
      const responseFile = path.join(runDir, `response_${id}.json`);
      fs.writeFileSync(responseFile, JSON.stringify(response, null, 2));
      console.log(`Saved: ${responseFile}`);

      // Extract content
      const content = extractContent(response);
      if (content) {
        const contentFile = path.join(runDir, `content_${id}.json`);
        fs.writeFileSync(contentFile, JSON.stringify(content, null, 2));
        console.log(`Content extracted: ${contentFile}`);
      }

      // Download artifacts if available
      await downloadArtifacts(response, runDir, id);

      // Report usage
      if (response.usage) {
        console.log(`\nToken usage:`);
        console.log(`  Prompt: ${response.usage.prompt_tokens}`);
        console.log(`  Completion: ${response.usage.completion_tokens}`);
        console.log(`  Total: ${response.usage.total_tokens}`);
        console.log(`  Est. cost: $${(response.usage.total_tokens * 0.7 / 1_000_000).toFixed(4)}`);
      }

    } catch (error) {
      console.error(`Error calling API:`, error);
      fs.writeFileSync(
        path.join(runDir, `error_${id}.txt`),
        String(error)
      );
    }
  }

  // Save probe config for reference
  fs.writeFileSync(
    path.join(runDir, 'probe.json'),
    JSON.stringify(probe, null, 2)
  );

  console.log(`\n=== Run complete ===`);
  console.log(`Output: ${runDir}`);
}

// =============================================================================
// API Functions
// =============================================================================

async function callOracleAPI(prompt: string): Promise<OracleResponse> {
  const response = await fetch(ZAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ZAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: AGENT_ID,
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: prompt }]
      }],
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json();
}

function extractContent(response: OracleResponse): unknown | null {
  // Try to extract slide content from response
  const text = response.choices?.[0]?.messages?.[0]?.content?.text;
  if (!text) return null;

  // Content might be HTML or JSON - try to parse
  try {
    // If it's JSON, parse it
    if (text.startsWith('{') || text.startsWith('[')) {
      return JSON.parse(text);
    }

    // Otherwise return as HTML string
    return { type: 'html', content: text };
  } catch {
    return { type: 'raw', content: text };
  }
}

async function downloadArtifacts(
  response: OracleResponse,
  runDir: string,
  id: string
): Promise<void> {
  const artifactsDir = path.join(runDir, 'artifacts');

  // Check for file_url
  if (response.file_url) {
    console.log(`Downloading file: ${response.file_url}`);
    await downloadFile(response.file_url, path.join(artifactsDir, `${id}.pptx`));
  }

  // Check for attachments
  if (response.attachments) {
    for (const att of response.attachments) {
      console.log(`Downloading attachment: ${att.name}`);
      await downloadFile(att.url, path.join(artifactsDir, att.name));
    }
  }
}

async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log(`Saved: ${outputPath}`);
}

// =============================================================================
// Run
// =============================================================================

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
