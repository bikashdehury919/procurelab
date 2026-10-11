// AI Proposal Analyzer.
// 1) Rule-based scoring: deterministic, so Playwright can assert exact values.
// 2) Optional LLM summary via the Anthropic API (only if ANTHROPIC_API_KEY is set). Its output is
//    non-deterministic on purpose: this is what the platform's LLM-as-judge checks evaluate.

const WEIGHTS = { price: 0.5, delivery: 0.3, rating: 0.2 };

// rows: [{ proposalId, vendorName, priceNet, deliveryMonths, rating, documents }]
function analyzeProposals(rows) {
  if (!rows.length) return [];
  const minPrice = Math.min(...rows.map((r) => r.priceNet));
  const minMonths = Math.min(...rows.map((r) => r.deliveryMonths));
  const scored = rows.map((r) => {
    const score = Math.round(
      WEIGHTS.price * (minPrice / r.priceNet) * 100
      + WEIGHTS.delivery * (minMonths / r.deliveryMonths) * 100
      + WEIGHTS.rating * (r.rating / 5) * 100,
    );
    const missing = [];
    if (!r.documents) missing.push('document');
    let risk = 'low';
    if (r.rating < 4.0 || r.deliveryMonths > minMonths * 1.5) risk = 'high';
    else if (r.rating < 4.5 || r.priceNet > minPrice * 1.15 || missing.length) risk = 'medium';
    return { ...r, score, risk, missing };
  });
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
  return scored.map((r) => ({ ...r, recommended: r.proposalId === best.proposalId }));
}

const LANG_NAMES = { en: 'English', nl: 'Dutch', da: 'Danish', de: 'German' };

async function aiSummary({ rfpTitle, currency, lang, analysis }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: 'not_configured' };
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
  const facts = analysis.map((r) => `- ${r.vendorName}: price ${r.priceNet} ${currency} excl. VAT, delivery ${r.deliveryMonths} months, rating ${r.rating}/5, score ${r.score}, risk ${r.risk}${r.missing.length ? `, missing: ${r.missing.join(', ')}` : ''}`).join('\n');
  const prompt = `You help an IT procurement manager compare vendor proposals for "${rfpTitle}".
Write a neutral summary of at most 90 words in ${LANG_NAMES[lang] || 'English'}.
Use only the facts below. Do not invent numbers, vendors or certifications. Name the trade-off between price and delivery time, mention any missing information, and say which vendor the score recommends.
Facts:
${facts}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}`, detail: (await res.text()).slice(0, 300) };
    const data = await res.json();
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    return { ok: true, text, model, usage: data.usage || null };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'network', detail: e.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { WEIGHTS, analyzeProposals, aiSummary };
