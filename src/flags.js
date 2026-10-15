// Feature flags per market, shaped like a flag provider so OpenFeature + LaunchDarkly
// can replace this module later without touching routes or views.
const FLAG_DEFAULTS = {
  NL: { vatBreakdown: true,  aiAnalyzer: true,  vendorQuestions: true,  deadlineExtension: true  },
  BE: { vatBreakdown: false, aiAnalyzer: false, vendorQuestions: true,  deadlineExtension: false },
  DK: { vatBreakdown: true,  aiAnalyzer: true,  vendorQuestions: false, deadlineExtension: true  },
  DE: { vatBreakdown: true,  aiAnalyzer: false, vendorQuestions: false, deadlineExtension: false },
};
const FLAG_NAMES = Object.keys(FLAG_DEFAULTS.NL);

function envOverrides() {
  if (!process.env.FLAG_OVERRIDES) return {};
  try { return JSON.parse(process.env.FLAG_OVERRIDES); } catch { return {}; }
}

const resolveFlags = (marketCode, sessionOverrides = {}) => ({ ...FLAG_DEFAULTS[marketCode], ...envOverrides(), ...sessionOverrides });

// ?ff_<flag>=on|off sets a session override; ?ff_reset=1 clears all overrides.
function parseFlagQuery(query) {
  if (query.ff_reset) return { reset: true, overrides: {} };
  const overrides = {};
  for (const name of FLAG_NAMES) {
    const v = query['ff_' + name];
    if (v === 'on' || v === 'true') overrides[name] = true;
    if (v === 'off' || v === 'false') overrides[name] = false;
  }
  return { reset: false, overrides };
}

module.exports = { FLAG_DEFAULTS, FLAG_NAMES, resolveFlags, parseFlagQuery };
