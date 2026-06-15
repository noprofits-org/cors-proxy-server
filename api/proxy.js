const security = require('./security');
const resilience = require('./resilience');

module.exports = async (req, res) => {
  // CORS + origin allowlist gate (rejects disallowed browser origins).
  if (!security.applyCors(req, res)) return;

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Per-IP rate limiting (a backstop on top of the target allowlist).
  const ip = (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown')
    .toString().split(',')[0].trim();
  const limit = resilience.rateLimit(ip);
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: limit.retryAfter });
  }

  // Record start time for performance monitoring
  const startTime = Date.now();
  let targetUrl = '';

  try {
    // Get and validate the target URL against the allowlist.
    targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    const check = security.validateTarget(targetUrl);
    if (!check.ok) {
      const { status, ...rest } = check;
      return res.status(status).json(rest);
    }

    // Serve deterministic GETs from the per-instance cache when fresh.
    const cacheKey = `GET ${targetUrl}`;
    const cacheable = req.method === 'GET';
    if (cacheable) {
      const hit = resilience.cacheGet(cacheKey);
      if (hit) {
        res.setHeader('X-Proxy-Cache', 'HIT');
        if (hit.contentType) res.setHeader('Content-Type', hit.contentType);
        return res.status(hit.status).send(hit.body);
      }
      res.setHeader('X-Proxy-Cache', 'MISS');
    }

    // Build the upstream request (minimal, essential headers only).
    const fetchOptions = { method: req.method, headers: {} };
    if (req.headers['content-type']) fetchOptions.headers['content-type'] = req.headers['content-type'];
    if (req.headers['accept']) fetchOptions.headers['accept'] = req.headers['accept'];

    // Add body ONLY for POST/PUT/PATCH with a JSON content-type.
    if (['POST', 'PUT', 'PATCH'].includes(req.method) &&
        req.headers['content-type']?.includes('application/json') &&
        typeof req.body === 'object') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // Fetch with timeout + retry/backoff inside the function time budget.
    console.log(`Fetching ${targetUrl} with method ${req.method}`);
    const { status, contentType, body } = await resilience.resilientFetch(
      targetUrl, fetchOptions, startTime
    );

    // Cache only deterministic, successful GET responses (never failures).
    if (cacheable && status >= 200 && status < 300) {
      resilience.cacheSet(cacheKey, { status, contentType, body });
    }

    if (contentType) res.setHeader('Content-Type', contentType);
    return res.status(status).send(body);
  } catch (error) {
    console.error('Proxy error:', error);
    // Timeout / budget-exhaustion -> 504 so the client gets a clean, retryable
    // signal instead of a hard function cut-off or a misleading 500.
    const timedOut = error.exhausted || error.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Upstream request timed out' : 'Proxy request failed',
      message: error.message,
    });
  }
};
