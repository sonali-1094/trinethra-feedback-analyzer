# Trinethra — Supervisor Feedback Analyzer
### DeepThought Software Developer Internship Assignment

A web application that analyzes supervisor transcripts using a local Ollama LLM and produces structured Fellow performance assessments for psychology interns to review and finalize.

---

## Quick Start

### Prerequisites
- Node.js (v18+)
- [Ollama](https://ollama.com) installed and running

### 1. Start Ollama
```bash
# Pull the model (one-time, ~2GB)
ollama pull llama3.2

# Verify it's running
ollama run llama3.2 "hello"
# Ollama runs as a background service after install — no manual start needed
```

### 2. Start the Backend
```bash
cd backend
npm install
node server.js
# Running at http://localhost:3001
```

### 3. Open the Frontend
Open `frontend/public/index.html` in your browser.

Or serve it:
```bash
# From project root
npx serve frontend/public -p 3000
# Open http://localhost:3000
```

---

## Model Choice: `llama3.2` (3B)

**Why:** Balance between reasoning quality and local hardware constraints. Llama 3.2 3B runs on 8GB RAM laptops, handles instruction-following reliably, and produces structured JSON output with acceptable consistency. For higher quality on capable hardware, swap to `mistral` or `llama3.1:8b` by setting `OLLAMA_MODEL=mistral node server.js`.

---

## Architecture

```
┌─────────────────────────────────────┐
│  Browser (frontend/public/index.html) │
│  - Single HTML file, vanilla JS     │
│  - Loads samples from API           │
│  - Sends transcript → displays JSON │
└──────────────────┬──────────────────┘
                   │ HTTP POST /api/analyze
                   ▼
┌─────────────────────────────────────┐
│  Node/Express Backend (port 3001)   │
│  - Builds structured LLM prompt     │
│  - Calls Ollama /api/generate       │
│  - Extracts + validates JSON        │
│  - Retries up to 2x on failure      │
└──────────────────┬──────────────────┘
                   │ HTTP POST /api/generate
                   ▼
┌─────────────────────────────────────┐
│  Ollama (localhost:11434)           │
│  - Runs llama3.2 locally            │
│  - No cloud, no API key             │
└─────────────────────────────────────┘
```

---

## Design Challenges Tackled

### Challenge 2: Structured Output Reliability
LLMs don't reliably return clean JSON. My approach uses a **3-layer extraction strategy**:
1. Direct `JSON.parse()` on the raw response
2. Find first `{` to last `}` and parse that substring
3. Strip markdown fences (` ```json `) and retry

If all three fail, the backend retries the Ollama call up to 2 times with the same prompt. The prompt explicitly says "Return ONLY the JSON. Nothing else." — this reduces preamble/postamble significantly. The validation step checks for all 5 required sections and that `score.value` is a valid 1-10 integer.

### Challenge 4: Showing Uncertainty
The AI's output is explicitly framed as a **draft**. Three mechanisms prevent automation bias:
- Confidence level displayed on every score (`high / medium / low`)
- Score override input — intern can change the score without re-running; it updates the visual in real-time and shows a yellow "⚠ Score overridden by intern" flag
- Evidence cards are interactive — intern clicks to expand the AI's interpretation and can evaluate whether the reasoning holds

### Challenge 5: Gap Detection (Absence Reasoning)
The prompt instructs the model to check all 4 assessment dimensions (Execution, Systems Building, KPI Impact, Change Management) and return **only the dimensions with no or insufficient evidence** in the gaps array. The prompt also provides bias patterns (helpfulness bias, presence bias, dependency trap) so the model learns to distinguish "supervisor didn't mention X" from "Fellow did X but supervisor didn't notice."

### Challenge 1: One Prompt vs. Many
I chose **one structured prompt** for MVP. Rationale: for a 10-minute transcript (~500-800 words), a single well-structured prompt produces acceptable quality without the coordination complexity of chained calls. The prompt is organized in clearly labeled sections (RUBRIC → LAYERS → DIMENSIONS → KPIS → BIASES → TRANSCRIPT → INSTRUCTIONS) which steers the model to address each section systematically. With more time, I'd add a second focused call for gap analysis specifically, since absence-reasoning is the weakest point of a single-prompt approach.

---

## What I'd Improve With More Time

1. **Side-by-side view**: Split panel with transcript on left, analysis on right. Allow intern to highlight a transcript sentence and see which evidence card it maps to — true evidence linking (Challenge 3).
2. **Structured output mode**: Use Ollama's `/api/chat` with `format: "json"` and a JSON schema — eliminates the extraction retry logic entirely. Currently not available on all models.
3. **Session persistence**: Save analyses to `localStorage` so the intern can review past sessions without re-running.
4. **Intern annotation layer**: Let the intern mark each evidence card as "accepted / rejected / edited" and export the finalized assessment as a PDF report.
5. **Multiple prompt strategies**: A/B test single-prompt vs. chained (evidence first, then score, then gaps) and compare output quality against the expected score ranges in `sample-transcripts.json`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama base URL |
| `OLLAMA_MODEL` | `llama3.2` | Model name |
| `PORT` | `3001` | Backend port |

Example: `OLLAMA_MODEL=mistral node server.js`

---

## Project Structure

```
trinethra/
├── backend/
│   ├── server.js          # Express API
│   ├── prompt.js          # LLM prompt builder
│   ├── data/
│   │   ├── rubric.json
│   │   └── sample-transcripts.json
│   └── package.json
├── frontend/
│   └── public/
│       └── index.html     # Single-file frontend
└── README.md
```
