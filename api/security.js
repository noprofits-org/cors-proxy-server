// security.js - shared allowlist + target validation for the CORS proxy.
// Sits alongside logger.js as a required helper (not a route handler).
//
// Locked-by-default allowlists. Override per-deployment with env vars
// (comma-separated). A fork that wants a general-purpose open proxy can set
// ALLOWED_TARGETS=* and ALLOWED_ORIGINS=* explicitly.
//
// Production (noprofits) targets — the only upstreams our consumers proxy:
//   projects.propublica.org     -> grants + search (ProPublica Nonprofit API)
//   collectionapi.metmuseum.org -> random-art-generator (Met Museum API)
const DEFAULT_TARGETS = ['projects.propublica.org', 'collectionapi.metmuseum.org'];
const DEFAULT_ORIGIN_HOSTS = ['noprofits.org'];

function parseEnvList(value, fallback) {
  if (value === undefined || value === null || value.trim() === '') return fallback;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

const ALLOWED_TARGETS = parseEnvList(process.env.ALLOWED_TARGETS, DEFAULT_TARGETS);
const ALLOWED_ORIGIN_HOSTS = parseEnvList(process.env.ALLOWED_ORIGINS, DEFAULT_ORIGIN_HOSTS);
const TARGETS_OPEN = ALLOWED_TARGETS.includes('*');
const ORIGINS_OPEN = ALLOWED_ORIGIN_HOSTS.includes('*');

// Internal/metadata hosts that must never be reachable, even via env override
// (defense-in-depth against SSRF if an allowlist entry is ever too loose).
function isBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1' || h.endsWith('.localhost')) return true;
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true; // cloud metadata
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function hostMatches(host, allow) {
  const h = host.toLowerCase();
  return allow.some((a) => {
    const al = a.toLowerCase();
    return h === al || h.endsWith('.' + al);
  });
}

// Returns the origin string to echo in Access-Control-Allow-Origin, or null if
// the request's Origin is not allowed. A missing Origin (non-browser caller)
// returns null — CORS headers are irrelevant there, and target rules still apply.
function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return null;
  if (ORIGINS_OPEN) return origin;
  try {
    const host = new URL(origin).hostname;
    if (host === 'localhost' || host === '127.0.0.1') return origin; // local dev
    return hostMatches(host, ALLOWED_ORIGIN_HOSTS) ? origin : null;
  } catch (_) {
    return null;
  }
}

// Validate a ?url= target. Returns { ok: true, url } or { ok:false, status, error }.
function validateTarget(targetUrl) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (_) {
    return { ok: false, status: 400, error: 'Invalid url parameter' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, status: 403, error: 'Only https: targets are allowed' };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, status: 403, error: 'Target host is not allowed' };
  }
  if (!TARGETS_OPEN && !hostMatches(parsed.hostname, ALLOWED_TARGETS)) {
    return { ok: false, status: 403, error: 'Target host is not allowed', host: parsed.hostname };
  }
  return { ok: true, url: parsed };
}

// Apply the standard CORS + origin gate to a response. Returns true if the
// request may proceed, false if it was rejected (response already finalized).
function applyCors(req, res) {
  const okOrigin = allowedOrigin(req);
  res.setHeader('Vary', 'Origin');
  if (okOrigin) {
    res.setHeader('Access-Control-Allow-Origin', okOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.headers.origin && !okOrigin) {
    res.status(403).json({ error: 'Origin not allowed' });
    return false;
  }
  return true;
}

module.exports = {
  ALLOWED_TARGETS,
  ALLOWED_ORIGIN_HOSTS,
  TARGETS_OPEN,
  ORIGINS_OPEN,
  isBlockedHost,
  hostMatches,
  allowedOrigin,
  validateTarget,
  applyCors,
};
