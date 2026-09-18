// Heuristic virality scoring: programmatic proxies for the 6-criterion rubric
// validated against DOAC's real top Shorts. Pure offline scoring, no API spend.
export const WINDOW_S = 60;
export const STEP_S = 30;
export const MIN_UNIQUE_CHARS = 180;

const CLUSTERS = {
  hiddenDanger: /\b(cancer|poison|toxic|kills?|killing|danger(ous)?|harmful?|damage[sd]?|starv\w+|die[sd]?|death|dead|disease)\b/i,
  insiderSecret: /\b(secrets?|lying to you|they'?re (lying|hiding)|hidden|truth about|inside(r)? information|exposed?|nobody (knows|tells|talks)|what shall we tell|cover.?up|reluctant to (tell|be more transparent))\b/i,
  chemicals: /\b(bpa|phthalates?|chemicals?|pesticides?|microplastics?|flame retardants?|hormone\w*)\b/i,
  doom: /\b(greatest threat|destroy everything|end of the world|extinction|wipe out|destroy humanity|collapse of civilization)\b/i,
  powerStructures: /\b(cia|fbi|government|white house|pentagon|big pharma|mainstream media)\b/i,
  contrarian: /\b(everything you (know|thought)|wrong about|not (true|how it works)|myth|stop (doing|buying|eating|touching)|never (eat|say|do|buy|touch|wear))\b/i,
  prediction: /\b(will (be gone|disappear|collapse|change|happen)|in (five|5|ten|10|twenty|20) years|is coming|going to (destroy|collapse|replace)|greatest threat|destroy (everything|humanity|the world)|end of (the world|humanity)|wipe out|existential)\b/i,
  actionable: /\b(how to|here'?s how|fastest way|best way|easiest way|hack|do this|wear|avoid|protect you|spot a)\b/i,
  controversy: /\b(scam|lies?|corrupt\w*|accountability|wake up|fraud|banned?|censored)\b/i,
  moneyPower: /\b(billion(are|aire)?s?|million(are|aire)?s?|rich|wealthy|powerful people|elite)\b/i,
};
const CHARGE = /\b(extremely|really|literally|terrified|terrifying|shocking|insane|crazy|worst|best|greatest|destroy\w*|devastat\w*|hate|love|obsessed|massive|huge|unbelievable|incredible|amazing|extraordinary)\b/gi;
const CONTINUATION_OPENER = /^(but|so|and|yeah|yes|uh|um|well|like|or|the|a|an|it|that|this|he|she|they|i'?m|you know|we)\b/i;
const IMPERATIVE = /^(never|always|stop|wear|avoid|don'?t|please|beware|watch)\b/i;
const stripLead = u => u.trim().replace(/^(really|very|please|so|and|but|i mean|you know)\b[\s,]*/i, '').replace(/^(really|very|please)\b[\s,]*/i, '');

export function dedupeWords(text) {
  const words = text.toLowerCase().replace(/\s+/g, ' ').trim().split(' ');
  const out = [];
  for (const w of words) if (out[out.length - 1] !== w) out.push(w);
  return out.join(' ');
}

function properNounCount(text) {
  // mid-sentence capitalized tokens (transcripts are often proper-cased)
  const m = text.replace(/^\S+\s+/, '').match(/\b[A-Z][a-z]{2,}\b/g);
  return m ? new Set(m).size : 0;
}

export function scoreWindow(rawText, t, weights = {}) {
  const text = dedupeWords(rawText);
  if (text.length < MIN_UNIQUE_CHARS) return null;
  const reasons = [];
  let score = 0;
  const opener = text.slice(0, 160);

  // 1. Hook opening (0-2)
  let hook = 0;
  if (opener.includes('?')) { hook += 1; reasons.push('question opener'); }
  if (t < 45) { hook += 1; reasons.push('episode cold open'); }
  if (!CONTINUATION_OPENER.test(text)) { hook += 1; reasons.push('declarative opener'); }
  score += Math.min(2, hook);

  // 2. Viral pattern family (0-2)
  const famHits = Object.entries(CLUSTERS).filter(([, re]) => re.test(text)).map(([k]) => k);
  // Outcome feedback re-weights pattern families (see mark_posted.mjs); default weight 1.
  const famPoints = Math.min(2, famHits.reduce((sum, k) => sum + (weights[k] ?? 1), 0));
  score += famPoints;
  if (famHits.length) reasons.push(`patterns: ${famHits.join(',')}`);

  // 3. Standalone completeness (0-2)
  let stand = 0;
  if (!CONTINUATION_OPENER.test(text)) stand += 1;
  if (/\d/.test(text) || /percent|billion|million|years?\b/i.test(text) || properNounCount(rawText) >= 2) {
    stand += 1; reasons.push('concrete specifics');
  }
  score += Math.min(2, stand);

  // 4. Emotional charge (0-2)
  let chargeCount = (text.match(CHARGE) || []).length;
  if (CLUSTERS.doom.test(text)) chargeCount += 2;
  const charge = chargeCount >= 4 ? 2 : chargeCount >= 2 ? 1 : 0;
  score += charge;
  if (charge) reasons.push(`charge words x${chargeCount}`);

  // 5. Quotable (0-1)
  const utts = text.split(/(?<=[.!?])\s+|\s*>>\s*/);
  const punchy = utts.some(u => {
    if (/protect you|will (protect|save|change|destroy)/i.test(u)) return true;
    const wc = u.trim().split(/\s+/).length;
    return wc >= 4 && wc <= 16 && (/\b(extremely|greatest|never|always|most likely|destroy\w*)\b/i.test(u) || /\d/.test(u) || IMPERATIVE.test(u.trim()) || /^(i|we) (have|know|was|did)\b/i.test(u.trim()) && /secret|inside|truth|bet money/i.test(u));
  });
  if (punchy) { score += 1; reasons.push('punchy quotable line'); }

  // 6. Clip-length fit (0-1)
  const qPos = text.indexOf('?');
  if ((qPos > -1 && text.length - qPos > 80) || IMPERATIVE.test(stripLead(opener)) || t < 45) {
    score += 1; reasons.push('self-contained beat');
  }

  return { score, reasons, text };
}
