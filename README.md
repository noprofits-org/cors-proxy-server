# CORS Proxy Server

A simple, general-purpose CORS proxy using Vercel serverless functions. This proxy allows you to make requests to APIs that don't support CORS from your frontend applications.

## Demo

A live version of this proxy is available at: [https://cors-proxy-xi-ten.vercel.app/](https://cors-proxy-xi-ten.vercel.app/)

## How It Works

This proxy acts as a middleware between your frontend application and the target API:

1. Your frontend makes a request to this proxy server
2. The proxy server forwards your request to the target API
3. The proxy server receives the response and adds CORS headers
4. The proxy server sends the response back to your frontend

## Usage

### Basic Usage

To make a GET request through the proxy:

```javascript
const PROXY_URL = 'https://cors-proxy-xi-ten.vercel.app/api/proxy';
const TARGET_API = 'https://api.example.com/data';

fetch(`${PROXY_URL}?url=${encodeURIComponent(TARGET_API)}`)
  .then(response => response.json())
  .then(data => {
    console.log('Data:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### POST Requests

To make a POST request through the proxy:

```javascript
const PROXY_URL = 'https://cors-proxy-xi-ten.vercel.app/api/proxy';
const TARGET_API = 'https://api.example.com/data';

fetch(`${PROXY_URL}?url=${encodeURIComponent(TARGET_API)}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ key: 'value' }),
})
  .then(response => response.json())
  .then(data => {
    console.log('Data:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

### Other HTTP Methods

The proxy supports all standard HTTP methods (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD).

### Content Type Handling

The proxy correctly handles various content types:

- JSON data (application/json)
- Text content (text/plain, text/html, etc.)
- Binary data (images, PDFs, etc.)

### Passing Headers

Headers from your request will be forwarded to the target API, except for headers that could cause issues (host, connection, origin, referer, content-encoding, content-length, transfer-encoding).

## Configuration Options

This proxy is **locked down by default** — it only forwards to an allowlisted set of
target hosts and only serves an allowlisted set of browser origins. Everything else
gets a `403`. Configure it with environment variables in your Vercel deployment
(comma-separated lists):

- `ALLOWED_TARGETS` — host allowlist for the `?url=` target. A request's host must
  equal an entry or be a subdomain of one. Default:
  `projects.propublica.org,collectionapi.metmuseum.org`. Set to `*` for an open
  (general-purpose) proxy.
- `ALLOWED_ORIGINS` — host allowlist for the browser `Origin`. Matched as exact host
  or subdomain; `localhost`/`127.0.0.1` are always allowed for local dev. The matching
  origin is echoed back in `Access-Control-Allow-Origin` (never a blanket `*`).
  Default: `noprofits.org` (covers `*.noprofits.org`). Set to `*` to allow any origin.

Additional hardening that is always on, regardless of config:

- Only `https:` targets are accepted.
- Internal / cloud-metadata targets are always blocked (`localhost`, loopback,
  RFC1918 ranges, `169.254.169.254`, `metadata.google.internal`) as SSRF
  defense-in-depth, even if an allowlist entry is too broad.

## Resilience

The proxy adds a reliability layer around the upstream request (tunable via env vars):

- **Explicit fetch timeout** — `FETCH_TIMEOUT_MS` (default `8000`), kept under Vercel's
  `maxDuration` 10s so the client gets a clean `504` rather than a hard function cut-off.
- **Retry with backoff** — transient upstream failures (network error, `429`, `5xx`) are
  retried up to `MAX_ATTEMPTS` (default `3`) with exponential backoff + jitter, bounded by
  `OVERALL_BUDGET_MS` (default `9000`). Honors a small upstream `Retry-After` on `429`.
  Non-transient responses (incl. `4xx`) are returned immediately, never retried.
- **Response cache** — deterministic `GET` responses with a `2xx` status are cached for
  `CACHE_TTL_MS` (default 1h), up to `CACHE_MAX` entries (LRU). Failures are never cached.
  `X-Proxy-Cache: HIT|MISS` reports cache status. **Per warm instance, not global** —
  Vercel functions are ephemeral; a globally-shared cache would need Vercel KV / Upstash.
- **Rate limiting** — fixed-window `RATE_LIMIT` requests (default `60`) per `RATE_WINDOW_MS`
  (default 60s) per client IP; over-limit returns `429` + `Retry-After`. Also per warm
  instance. `X-RateLimit-Remaining` is reported on every response.

### Health check

`GET /api/health` returns `200` with `{ status: "ok", uptimeSeconds, targetsLocked,
originsLocked, allowedTargets }` — no upstream call, for connectivity/liveness pings.

## Deploy Your Own

### Prerequisites

- GitHub account
- Vercel account

### Deployment Steps

1. Fork this repository
2. Connect your Vercel account to your GitHub account
3. Import the forked repository as a new project in Vercel
4. Deploy the project
5. Use your new deployment URL as the CORS proxy

Alternatively, you can clone this repository and deploy using the Vercel CLI:

```bash
# Clone the repository
git clone https://github.com/your-username/cors-proxy-server.git
cd cors-proxy-server

# Install Vercel CLI if you haven't already
npm install -g vercel

# Deploy to Vercel
vercel
```

## Troubleshooting

If you're experiencing issues with the proxy, try these steps:

1. Verify that the target URL is correctly encoded
2. Ensure you're using the correct content type headers
3. Check your browser console for detailed error messages
4. Test the endpoint directly in your browser or with cURL to isolate browser CORS issues

Example cURL command for testing:
```bash
curl "https://your-proxy-url.vercel.app/api/proxy?url=https://api.example.com/data"
```

## Local Development

To run the proxy locally:

1. Clone the repository:
```bash
git clone https://github.com/your-username/cors-proxy-server.git
cd cors-proxy-server
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
vercel dev
```

## Limitations

- This is a general-purpose proxy without authentication
- Rate limiting is based on Vercel's free tier limits
- Some APIs may still reject requests from the proxy server (due to server-side CORS checks or IP filtering)
- Very large responses might hit Vercel's serverless function size limits

## Security Considerations

When using this proxy, be aware that:

1. This proxy has no per-user authentication; access is controlled by the target and
   origin allowlists (see Configuration Options), not by credentials.
2. The defaults are locked to the noprofits.org sites — fork and set `ALLOWED_TARGETS` /
   `ALLOWED_ORIGINS` for your own deployment.
3. Be aware that Vercel logs may contain information from proxied requests.
4. Opening the allowlists with `*` turns this back into an open relay (SSRF / quota
   abuse risk); do so only for trusted/dev deployments.

## License

MIT