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

The proxy supports GET, POST, PUT, PATCH, DELETE, OPTIONS, and HEAD.

### Content Type Handling

The proxy returns responses based on their `Content-Type`:

- JSON (`application/json`) is parsed and returned as JSON
- Text-like content (`text/*`, XML, JavaScript) is returned as text
- Everything else (images, PDFs, `application/octet-stream`, etc.) is returned as binary

### Forwarded Headers

Only a curated set of request headers is forwarded to the target API:

- `Content-Type`
- `Accept`
- `Authorization`

Request bodies are forwarded for POST, PUT, PATCH, and DELETE. JSON and
`application/x-www-form-urlencoded` bodies are supported; raw binary request
bodies are not.

## Configuration Options

You can configure the proxy using environment variables in your Vercel deployment:

- `ALLOWED_ORIGINS` - Comma-separated list of origins allowed to use the proxy
  via CORS (default: `*`). When set to specific origins, the proxy echoes the
  request's `Origin` back only if it appears in the list.

## Security

This proxy includes basic Server-Side Request Forgery (SSRF) protection:

- Only `http` and `https` URLs are accepted
- Target hostnames are resolved and requests to private, loopback, and
  link-local addresses (e.g. `127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`,
  `169.254.169.254`) are rejected
- Target URLs longer than 2048 characters are rejected

Requests that hang are aborted after ~9 seconds (just under Vercel's function
timeout) and return a `504`.

> **Note:** DNS rebinding can still defeat resolve-time IP checks in theory.
> If you need stronger guarantees, run this proxy behind an allow-list of
> permitted target hosts.

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

2. Run the development server (the Vercel CLI provides the serverless runtime):
```bash
vercel dev
```

## Limitations

- This is a general-purpose proxy without authentication
- Rate limiting is based on Vercel's plan limits; there is no in-app rate limiting
- Some APIs may still reject requests from the proxy server (due to server-side CORS checks or IP filtering)
- Very large responses might hit Vercel's serverless function size limits
- Raw binary request bodies are not forwarded

## Security Considerations

When using this proxy, be aware that:

1. This proxy has no built-in authentication, so it's open for public use
2. Consider restricting `ALLOWED_ORIGINS`, or deploying your own instance, if you need more control
3. Be aware that Vercel logs may contain information from proxied requests
4. Use for development and testing purposes, not for sensitive production data

## License

MIT
