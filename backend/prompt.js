function buildPrompt(transcript, fellowMeta = {}) {
  const fellowContext = fellowMeta.name
    ? `Fellow: ${fellowMeta.name}, Tenure: ${fellowMeta.tenure || 'unknown'}`
    : '';

  return `You are a performance analyst. Analyze this supervisor transcript and return ONLY a JSON object. No text before or after. No markdown fences.

${fellowContext}

SCORING RULES:
- Score 6: Fellow reliably does tasks the supervisor assigns. High trust but supervisor defines the scope.
- Score 7: Fellow spots problems the supervisor never asked about. Expands scope independently.
- Layer 1 = execution tasks only (caps score at 6)
- Layer 2 = systems/SOPs that keep working after Fellow leaves (needed for score 7+)
- Dependency trap: Fellow doing manager job personally = score 5-6 not 8-9
- Presence bias: always on floor is NOT a sign of systems thinking

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY this JSON with real values filled in:
{"score":{"value":6,"label":"Reliable and Productive","band":"Productivity","justification":"2-3 sentences citing transcript evidence","confidence":"medium","biasesDetected":["presence_bias"]},"evidence":[{"quote":"exact words from transcript","signal":"positive","dimension":"execution","layer":"layer1","interpretation":"one sentence"},{"quote":"exact words from transcript","signal":"negative","dimension":"systems_building","layer":"layer1","interpretation":"one sentence"}],"kpiMapping":[{"kpi":"Quality","kpiId":"quality","evidence":"what supervisor said","systemOrPersonal":"personal"}],"gaps":[{"dimension":"systems_building","dimensionLabel":"Building Systems","detail":"what is missing"}],"followUpQuestions":[{"question":"specific question to ask","targetGap":"systems_building","lookingFor":"what a good answer looks like"},{"question":"another question","targetGap":"change_management","lookingFor":"what to listen for"}],"supervisorBiasSummary":"1-2 sentences about bias detected"}

ONLY the JSON. Nothing else.`;
}

module.exports = { buildPrompt };