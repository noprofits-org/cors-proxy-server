# CORS Proxy Server

A simple, general-purpose CORS proxy using Vercel serverless functions. This proxy allows you to make requests to APIs that don't support CORS from your frontend applications.

## Demo

A live version of this proxy is available at: [https://cors-proxy-server-umber.vercel.app/](https://cors-proxy-server-umber.vercel.app/)

## How It Works

This proxy acts as a middleware between your frontend application and the target API:

1. Your frontend makes a request to this proxy server
2. The proxy server validates your API key for security
3. The proxy server forwards your request to the target API
4. The proxy server receives the response and adds CORS headers
5. The proxy server sends the response back to your frontend

## Usage

### Basic Usage

To make a GET request through the proxy:

```javascript
const PROXY_URL = 'https://cors-proxy-server-umber.vercel.app/api/proxy';
const TARGET_API = 'https://api.example.com/data';
const API_KEY = 'your-api-key'; // Set this in Vercel environment variables

fetch(`${PROXY_URL}?url=${encodeURIComponent(TARGET_API)}&apiKey=${API_KEY}`)
  .then(response => response.json())
  .then(data => {
    console.log('Data:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  });
```

Alternatively, you can pass the API key in the header:

```javascript
const PROXY_URL = 'https://cors-proxy-server-umber.vercel.app/api/proxy';
const TARGET_API = 'https://api.example.com/data';
const API_KEY = 'your-api-key';

fetch(`${PROXY_URL}?url=${encodeURIComponent(TARGET_API)}`, {
  headers: {
    'X-API-Key': API_KEY
  }
})
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
const PROXY_URL = 'https://cors-proxy-server-umber.vercel.app/api/proxy';
const TARGET_API = 'https://api.example.com/data';
const API_KEY = 'your-api-key';

fetch(`${PROXY_URL}?url=${encodeURIComponent(TARGET_API)}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
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

The proxy supports all standard HTTP methods (GET, POST, PUT, PATCH, DELETE, etc.).

### Content Type Handling

The proxy correctly handles various content types:

- JSON data (application/json)
- Text content (text/plain, text/html, etc.)
- Binary data (images, PDFs, etc.)

### Passing Headers

Headers from your request will be forwarded to the target API, except for headers that could cause issues (host, connection, origin, referer, x-api-key).

## Configuration Options

You can configure the proxy using environment variables in your Vercel deployment:

- `PROXY_API_KEY` - Required API key for authentication (must be set in Vercel environment variables)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins for CORS (default: '*')

## Deploy Your Own

### Prerequisites

- GitHub account
- Vercel account

### Deployment Steps

1. Fork this repository
2. Connect your Vercel account to your GitHub account
3. Import the forked repository as a new project in Vercel
4. Set your `PROXY_API_KEY` environment variable in Vercel:
   - Go to your project settings
   - Navigate to the Environment Variables section
   - Add a variable with name `PROXY_API_KEY` and a secure value of your choice
5. Deploy the project
6. Use your new deployment URL as the CORS proxy

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

1. Check that your API key matches the one set in your Vercel environment variables
2. Verify that the target URL is correctly encoded
3. Ensure you're using the correct content type headers
4. Check your browser console for detailed error messages
5. Test the endpoint directly in your browser or with cURL to isolate browser CORS issues

Example cURL command for testing:
```bash
curl "https://your-proxy-url.vercel.app/api/proxy?url=https://api.example.com/data&apiKey=your-api-key"
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

- This is a general-purpose proxy and doesn't include advanced security features beyond API key authentication
- Rate limiting is based on Vercel's free tier limits
- Some APIs may still reject requests from the proxy server (due to server-side CORS checks or IP filtering)
- Very large responses might hit Vercel's serverless function size limits

## Security Considerations

This proxy includes basic API key authentication. Make sure to:

1. Set a strong, unique `PROXY_API_KEY` in your Vercel environment variables
2. Keep your API key secure and don't expose it in client-side code
3. Consider restricting allowed origins with the `ALLOWED_ORIGINS` environment variable
4. Monitor your proxy usage for unexpected traffic patterns
5. Be aware that Vercel logs may contain sensitive information from proxied requests

## License

MIT