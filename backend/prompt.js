const rubricData = require('./data/rubric.json');

function buildPrompt(transcript, fellowMeta = {}) {
  const rubricLevels = rubricData.rubric.bands
    .flatMap(b => b.levels)
    .map(l => `  Score ${l.score} — ${l.label}: ${l.description}\n    Signals: ${l.signals.join(', ')}`)
    .join('\n');

  const kpiList = rubricData.kpis
    .map(k => `  - ${k.label} (${k.id}): ${k.description}`)
    .join('\n');

  const dimensions = rubricData.assessmentDimensions
    .map(d => `  - ${d.label} (${d.id}): ${d.description}`)
    .join('\n');

  const fellowContext = fellowMeta.name
    ? `Fellow: ${fellowMeta.name} | Tenure: ${fellowMeta.tenure || 'unknown'} | Placement goal: ${fellowMeta.placement || 'unknown'}`
    : 'Fellow context not provided.';

  return `You are a senior assessment analyst at DeepThought, evaluating a DT Fellow's performance based on a supervisor's verbal feedback transcript.

CONTEXT:
${fellowContext}

---

RUBRIC (1–10 scale):
${rubricLevels}

CRITICAL BOUNDARY — 6 vs 7:
- Score 6: Fellow executes tasks assigned by others with high reliability. Supervisor defines the scope.
- Score 7: Fellow independently identifies problems the supervisor hadn't articulated. Fellow expands the scope.
- The difference is INITIATIVE DIRECTION, not effort level.

---

FELLOW MANDATE LAYERS:
- Layer 1 (Execution): Attending meetings, tracking output, coordinating, being present. NECESSARY but not sufficient.
- Layer 2 (Systems Building): SOPs, trackers, dashboards, workflows that CONTINUE WORKING after the Fellow leaves. This is THE JOB.
- SURVIVABILITY TEST: "If the Fellow left tomorrow, would any system they built continue running?" If NO → Layer 1 only.

---

ASSESSMENT DIMENSIONS (check all 4 in transcript):
${dimensions}

---

KPIs TO MAP:
${kpiList}

---

SUPERVISOR BIAS PATTERNS TO DETECT:
1. Helpfulness bias: "She handles all my calls now" sounds like an 8 but is actually a 5-6 (task absorption, not systems building).
2. Presence bias: "He's always on the floor" rated higher than "She builds trackers" — floor presence ≠ systems thinking.
3. Halo effect: One impressive story coloring the full score.
4. Recency bias: Supervisor remembers last 2 weeks, not full tenure.
5. Dependency trap: Fellow absorbs a manager's work personally — when Fellow leaves, that work stops. This caps the score at 5-6.

---

TRANSCRIPT TO ANALYZE:
"""
${transcript}
"""

---

INSTRUCTIONS:
Analyze the transcript and return ONLY a valid JSON object. No explanation before or after. No markdown code fences. Just the raw JSON.

The JSON must follow this exact structure:

{
  "score": {
    "value": <integer 1-10>,
    "label": "<score label from rubric>",
    "band": "<Need Attention | Productivity | Performance>",
    "justification": "<2-3 sentences citing specific evidence from transcript. Explain why this score and not one above or below.>",
    "confidence": "<high | medium | low>",
    "biasesDetected": ["<list any supervisor biases detected, e.g. helpfulness_bias, presence_bias, halo_effect, recency_bias, dependency_trap>"]
  },
  "evidence": [
    {
      "quote": "<exact quote from transcript>",
      "signal": "<positive | negative | neutral>",
      "dimension": "<execution | systems_building | kpi_impact | change_management>",
      "layer": "<layer1 | layer2>",
      "interpretation": "<1 sentence: what this quote reveals about the Fellow's behavior>"
    }
  ],
  "kpiMapping": [
    {
      "kpi": "<kpi label>",
      "kpiId": "<kpi id>",
      "evidence": "<brief description of what the supervisor said that connects to this KPI>",
      "systemOrPersonal": "<system | personal — is this impact sustained by a system or by the Fellow personally?>"
    }
  ],
  "gaps": [
    {
      "dimension": "<execution | systems_building | kpi_impact | change_management>",
      "dimensionLabel": "<human-readable label>",
      "detail": "<what is missing from the transcript and why it matters for assessment>"
    }
  ],
  "followUpQuestions": [
    {
      "question": "<specific question the intern should ask in the next call>",
      "targetGap": "<dimension id this question addresses>",
      "lookingFor": "<what answer would move the score up vs. what would confirm the current score>"
    }
  ],
  "supervisorBiasSummary": "<1-2 sentences: overall assessment of how supervisor biases may be inflating or deflating the score, and what the intern should watch for>"
}

Rules:
- evidence array: extract 4-7 quotes. Cover all dimensions present in the transcript.
- kpiMapping: only include KPIs with actual evidence in transcript. Omit if not mentioned.
- gaps: only include dimensions with NO or INSUFFICIENT evidence. If a dimension is well-covered, omit it from gaps.
- followUpQuestions: 3-5 questions, each targeting a specific gap.
- All quotes must be verbatim from the transcript.
- score.value must be an integer, not a string.
- Return ONLY the JSON. Nothing else.`;
}

module.exports = { buildPrompt };
