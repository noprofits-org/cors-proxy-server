const dns = require('dns').promises;
const net = require('net');

// Hard limits to keep requests cheap and abuse-resistant.
const MAX_URL_LENGTH = 2048;
const FETCH_TIMEOUT_MS = 9000; // Stay just under Vercel's maxDuration (10s).

// Apply CORS headers. Origins can be restricted via the ALLOWED_ORIGINS env var
// (comma-separated list). Defaults to '*' to keep the proxy openly usable.
function applyCors(req, res) {
  const allowed = (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const origin = req.headers.origin;
  if (allowed.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIPv6(ip) {
  const addr = ip.toLowerCase();
  if (addr === '::1' || addr === '::') return true; // loopback / unspecified
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // unique-local fc00::/7
  if (/^fe[89ab]/.test(addr)) return true; // link-local fe80::/10
  return false;
}

// Block addresses that point at the proxy host itself or internal networks,
// which is the core SSRF defense for an open proxy.
function isPrivateAddress(ip) {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true; // unknown format -> refuse
}

// Validate the user-supplied target URL and ensure it does not resolve to a
// private/internal address. Returns { url } on success or { status, error }.
async function validateTargetUrl(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { status: 400, error: 'URL parameter is required' };
  }
  if (raw.length > MAX_URL_LENGTH) {
    return { status: 400, error: 'URL is too long' };
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { status: 400, error: 'Invalid URL' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { status: 400, error: 'Only http and https protocols are allowed' };
  }

  let hostname = url.hostname;
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1); // strip IPv6 brackets for lookup
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    return { status: 502, error: 'Unable to resolve target host' };
  }

  if (addresses.some((a) => isPrivateAddress(a.address))) {
    return { status: 403, error: 'Requests to private or internal addresses are not allowed' };
  }

  return { url };
}

// Only forward a curated set of request headers to the target.
function buildForwardHeaders(req) {
  const headers = {};
  for (const name of ['content-type', 'accept', 'authorization']) {
    if (req.headers[name]) headers[name] = req.headers[name];
  }
  return headers;
}

// Reconstruct a request body suitable for fetch, preserving the original
// content type where possible.
function buildBody(req) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return undefined;

  const body = req.body;
  if (body === undefined || body === null) return undefined;
  if (Buffer.isBuffer(body) || typeof body === 'string') return body;

  // Vercel parses some content types into objects; re-serialize them.
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return new URLSearchParams(body).toString();
  }
  return JSON.stringify(body);
}

module.exports = async (req, res) => {
  applyCors(req, res);

  // Handle preflight requests.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const validation = await validateTargetUrl(req.query.url);
  if (validation.error) {
    return res.status(validation.status).json({ error: validation.error });
  }
  const targetUrl = validation.url.toString();

  try {
    const fetchOptions = {
      method: req.method,
      headers: buildForwardHeaders(req),
      body: buildBody(req),
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    };

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    res.status(response.status);
    if (contentType) res.setHeader('Content-Type', contentType);

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.json(data);
    }

    const isText =
      contentType.startsWith('text/') ||
      contentType.includes('xml') ||
      contentType.includes('javascript');

    if (isText) {
      const text = await response.text();
      return res.send(text);
    }

    // Everything else (images, PDFs, octet-stream, ...) is treated as binary.
    const buffer = Buffer.from(await response.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    const isTimeout = error.name === 'TimeoutError' || error.name === 'AbortError';
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'Target request timed out' : 'Proxy request failed',
      message: error.message,
    });
  }
};
