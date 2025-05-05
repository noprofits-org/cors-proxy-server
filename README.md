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

You can configure the proxy using environment variables in your Vercel deployment:

- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins for CORS (default: '*')

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

1. This proxy has no built-in authentication, so it's open for public use
2. Consider deploying your own instance if you need more security
3. Be aware that Vercel logs may contain information from proxied requests
4. Use for development and testing purposes, not for sensitive production data

## License

MIT