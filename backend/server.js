const express = require('express');
const cors = require('cors');
const path = require('path');
const { buildPrompt } = require('./prompt');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Load static data
const rubricData = require('./data/rubric.json');
const sampleTranscripts = require('./data/sample-transcripts.json');

// ─── Config ──────────────────────────────────────────────────────────────────
const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const MAX_RETRIES = 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function callOllama(prompt, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 600000); // 10 min timeout

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama returned ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.response;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJSON(raw) {
  // Strategy 1: direct parse
  try {
    return JSON.parse(raw.trim());
  } catch (_) {}

  // Strategy 2: find first { ... } block
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (_) {}
  }

  // Strategy 3: strip markdown fences
  const stripped = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  try {
    return JSON.parse(stripped);
  } catch (_) {}

  return null;
}

function validateAnalysis(parsed) {
  const required = ['score', 'evidence', 'kpiMapping', 'gaps', 'followUpQuestions'];
  for (const field of required) {
    if (!parsed[field]) return { valid: false, missing: field };
  }
  if (typeof parsed.score.value !== 'number') {
    parsed.score.value = parseInt(parsed.score.value, 10);
  }
  if (isNaN(parsed.score.value) || parsed.score.value < 1 || parsed.score.value > 10) {
    return { valid: false, missing: 'score.value out of range' };
  }
  return { valid: true };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`);
    const data = await r.json();
    const models = (data.models || []).map(m => m.name);
    res.json({ status: 'ok', ollama: 'connected', models, activeModel: MODEL });
  } catch (e) {
    res.status(503).json({ status: 'error', ollama: 'unreachable', message: e.message });
  }
});

app.get('/api/rubric', (req, res) => res.json(rubricData));
app.get('/api/samples', (req, res) => res.json(sampleTranscripts));

app.post('/api/analyze', async (req, res) => {
  const { transcript, fellowMeta } = req.body;

  if (!transcript || transcript.trim().length < 50) {
    return res.status(400).json({ error: 'Transcript too short or missing.' });
  }

  const prompt = buildPrompt(transcript.trim(), fellowMeta || {});

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[analyze] Attempt ${attempt}/${MAX_RETRIES} — sending to Ollama (${MODEL})...`);
      const raw = await callOllama(prompt, attempt);
      console.log(`[analyze] Response received (${raw.length} chars)`);

      const parsed = extractJSON(raw);
      if (!parsed) {
        lastError = 'Could not extract valid JSON from model response.';
        console.warn(`[analyze] Attempt ${attempt}: JSON extraction failed`);
        continue;
      }

      const validation = validateAnalysis(parsed);
      if (!validation.valid) {
        lastError = `Incomplete response — missing field: ${validation.missing}`;
        console.warn(`[analyze] Attempt ${attempt}: validation failed — ${validation.missing}`);
        continue;
      }

      // Enrich with metadata
      parsed._meta = {
        model: MODEL,
        attempt,
        transcriptLength: transcript.length,
        timestamp: new Date().toISOString()
      };

      return res.json({ success: true, analysis: parsed });

    } catch (err) {
      lastError = err.message;
      console.error(`[analyze] Attempt ${attempt} error:`, err.message);
    }
  }

  return res.status(500).json({
    error: 'Analysis failed after retries.',
    detail: lastError,
    suggestion: 'Make sure Ollama is running: ollama serve'
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🔷 Trinethra backend running at http://localhost:${PORT}`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Ollama: ${OLLAMA_BASE}\n`);
});