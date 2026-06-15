const logger = require('./logger');

// --- Security config -------------------------------------------------------
// Locked-by-default allowlists. Override per-deployment with env vars
// (comma-separated). A fork that wants a general-purpose open proxy can set
// ALLOWED_TARGETS=* and ALLOWED_ORIGINS=* explicitly.
//
// Production (noprofits) targets — the only upstreams our consumers proxy:
//   projects.propublica.org   -> grants + search (ProPublica Nonprofit API)
//   collectionapi.metmuseum.org -> random-art-generator (Met Museum API)
const DEFAULT_TARGETS = ['projects.propublica.org', 'collectionapi.metmuseum.org'];
// Origins are our own deployed sites; matched as exact host or subdomain.
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
  // RFC1918 / loopback / link-local literals
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

module.exports = async (req, res) => {
  // CORS: echo the request origin only if it's on our allowlist.
  const okOrigin = allowedOrigin(req);
  res.setHeader('Vary', 'Origin');
  if (okOrigin) {
    res.setHeader('Access-Control-Allow-Origin', okOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // A browser request carrying a disallowed Origin is rejected outright.
  if (req.headers.origin && !okOrigin) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Record start time for performance monitoring
  const startTime = Date.now();
  let targetUrl = '';

  try {
    // Get the target URL from the query parameter
    targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // --- Validate the target against the allowlist ---
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (_) {
      return res.status(400).json({ error: 'Invalid url parameter' });
    }
    if (parsed.protocol !== 'https:') {
      return res.status(403).json({ error: 'Only https: targets are allowed' });
    }
    if (isBlockedHost(parsed.hostname)) {
      return res.status(403).json({ error: 'Target host is not allowed' });
    }
    if (!TARGETS_OPEN && !hostMatches(parsed.hostname, ALLOWED_TARGETS)) {
      return res.status(403).json({
        error: 'Target host is not allowed',
        host: parsed.hostname
      });
    }

    // Create a new request with minimal options
    const fetchOptions = {
      method: req.method,
      headers: {}
    };

    // Only add essential headers for the target request
    if (req.headers['content-type']) {
      fetchOptions.headers['content-type'] = req.headers['content-type'];
    }
    if (req.headers['accept']) {
      fetchOptions.headers['accept'] = req.headers['accept'];
    }

    // Add body ONLY for POST, PUT, PATCH requests
    // And ONLY if content-type is application/json
    if (['POST', 'PUT', 'PATCH'].includes(req.method) &&
        req.headers['content-type']?.includes('application/json') &&
        typeof req.body === 'object') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // Make the request
    console.log(`Fetching ${targetUrl} with method ${req.method}`);
    const response = await fetch(targetUrl, fetchOptions);

    // Get response data based on content-type
    const contentType = response.headers.get('content-type') || '';
    let data;
    let responseSize = 0;

    if (contentType.includes('application/json')) {
      data = await response.json();
      const responseJson = JSON.stringify(data);
      responseSize = responseJson.length;

      // Log the completed request
      await logger.logRequest(req, targetUrl, startTime, response.status, responseSize);

      return res.status(response.status).json(data);
    } else if (contentType.includes('image/')) {
      const arrayBuffer = await response.arrayBuffer();
      data = Buffer.from(arrayBuffer);
      responseSize = data.length;

      // Log the completed request
      await logger.logRequest(req, targetUrl, startTime, response.status, responseSize);

      res.setHeader('Content-Type', contentType);
      return res.status(response.status).send(data);
    } else {
      data = await response.text();
      responseSize = data.length;

      // Log the completed request
      await logger.logRequest(req, targetUrl, startTime, response.status, responseSize);

      res.setHeader('Content-Type', contentType);
      return res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);

    // Log failed request
    if (targetUrl) {
      await logger.logRequest(req, targetUrl, startTime, 500, 0);
    }

    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
};
