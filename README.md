# CORS Proxy Server

A simple, general-purpose CORS proxy using Vercel serverless functions. This proxy allows you to make requests to APIs that don't support CORS from your frontend applications.

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
const PROXY_URL = 'https://cors-proxy-server-4fwyw5bst-peters-projects-2a69edc1.vercel.app/api/proxy';
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
const PROXY_URL = 'https://cors-proxy-server-4fwyw5bst-peters-projects-2a69edc1.vercel.app/api/proxy';
const TARGET_API = 'https://api.example.com/data';

fetch(`${PROXY_URL}?url=${encodeURIComponent(TARGET_API)}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
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

### Passing Headers

Headers from your request will be forwarded to the target API, except for headers that could cause issues (host, connection, origin, referer).

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

- This is a general-purpose proxy and doesn't include advanced security features
- Rate limiting is based on Vercel's free tier limits (currently 100 serverless function invocations per day)
- Some APIs may still reject requests from the proxy server
- Binary data (like images) may not be handled correctly

## Security Considerations

Be aware that this proxy can be used by anyone who has access to the URL. Consider implementing authentication if you need to restrict access.

## License

MIT