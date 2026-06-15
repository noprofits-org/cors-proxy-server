// resilience.js - timeout, retry/backoff, response cache, and rate limiting.
//
// NOTE on scope: Vercel serverless instances are ephemeral and not shared, so
// the cache and rate-limit state below are PER WARM INSTANCE (module-level),
// not globally shared. This still beats the grants client's per-browser-session
// Map (one warm instance serves many users) and needs zero external infra.
// A globally-shared cache/limit would require Vercel KV / Upstash — deferred.

// --- Tunables (env-overridable) -------------------------------------------
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 8000); // < maxDuration 10s
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 3);            // initial try + retries
const OVERALL_BUDGET_MS = Number(process.env.OVERALL_BUDGET_MS || 9000);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 3600_000);    // 1h for deterministic GETs
const CACHE_MAX = Number(process.env.CACHE_MAX || 200);
const RATE_LIMIT = Number(process.env.RATE_LIMIT || 60);              // requests / window / IP
const RATE_WINDOW_MS = Number(process.env.RATE_WINDOW_MS || 60_000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Response cache (GET, 2xx only) ---------------------------------------
// key -> { status, contentType, body: Buffer, expiry }
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiry <= Date.now()) {
    cache.delete(key);
    return null;
  }
  // refresh LRU recency
  cache.delete(key);
  cache.set(key, hit);
  return hit;
}

function cacheSet(key, entry) {
  cache.set(key, { ...entry, expiry: Date.now() + CACHE_TTL_MS });
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value; // Map preserves insertion order
    cache.delete(oldest);
  }
}

// --- Per-IP fixed-window rate limiter -------------------------------------
// ip -> { count, windowStart }
const buckets = new Map();

function rateLimit(ip) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now - b.windowStart >= RATE_WINDOW_MS) {
    b = { count: 0, windowStart: now };
    buckets.set(ip, b);
  }
  b.count += 1;
  // opportunistic cleanup so the map can't grow unbounded
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now - v.windowStart >= RATE_WINDOW_MS) buckets.delete(k);
    }
  }
  const allowed = b.count <= RATE_LIMIT;
  const retryAfter = Math.ceil((b.windowStart + RATE_WINDOW_MS - now) / 1000);
  return { allowed, retryAfter, remaining: Math.max(0, RATE_LIMIT - b.count) };
}

// --- fetch with per-attempt timeout + retry/backoff -----------------------
// Retries transient failures (network error, 429, 5xx) within an overall time
// budget. Returns { status, contentType, body: Buffer }. Non-transient
// responses (incl. 4xx) are returned as-is without retry.
async function resilientFetch(targetUrl, fetchOptions, startTime) {
  const deadline = startTime + OVERALL_BUDGET_MS;
  let lastErr;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const controller = new AbortController();
    const perAttempt = Math.min(FETCH_TIMEOUT_MS, remaining);
    const timer = setTimeout(() => controller.abort(), perAttempt);

    try {
      const response = await fetch(targetUrl, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timer);

      const transient = response.status === 429 || response.status >= 500;
      if (transient && attempt < MAX_ATTEMPTS && Date.now() < deadline) {
        const backoff = backoffDelay(attempt, response);
        if (Date.now() + backoff < deadline) {
          await sleep(backoff);
          continue;
        }
      }

      const contentType = response.headers.get('content-type') || '';
      const body = Buffer.from(await response.arrayBuffer());
      return { status: response.status, contentType, body };
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < MAX_ATTEMPTS && Date.now() < deadline) {
        const backoff = backoffDelay(attempt);
        if (Date.now() + backoff < deadline) {
          await sleep(backoff);
          continue;
        }
      }
      break;
    }
  }

  const e = lastErr || new Error('Upstream request exhausted time budget');
  e.exhausted = true;
  throw e;
}

// Exponential backoff with jitter; honors a small Retry-After on 429.
function backoffDelay(attempt, response) {
  if (response) {
    const ra = Number(response.headers.get('retry-after'));
    if (Number.isFinite(ra) && ra > 0 && ra <= 5) return ra * 1000;
  }
  const base = 250 * Math.pow(2, attempt - 1); // 250, 500, 1000...
  return base + Math.floor(Math.random() * 150);
}

module.exports = {
  FETCH_TIMEOUT_MS,
  cacheGet,
  cacheSet,
  rateLimit,
  resilientFetch,
  _cache: cache,
  _buckets: buckets,
};
