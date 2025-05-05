const fetch = require('node-fetch');

// API key for basic authentication (set in Vercel environment variables)
const API_KEY = process.env.PROXY_API_KEY;

// Define allowed origins (can be customized via environment variables)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?
  process.env.ALLOWED_ORIGINS.split(',') :
  ['*'];

module.exports = async (req, res) => {
  // Log the incoming request for debugging
  console.log("Incoming request:", {
    method: req.method,
    url: req.url,
    query: req.query,
    headers: req.headers
  });
  
// Check for API key in headers only (not in query)
const apiKey = req.headers['x-api-key'];
console.log("API Key validation check - Received key:", apiKey ? "Key present (not shown in logs)" : "No key");
console.log("API Key validation check - Environment variable exists:", !!process.env.PROXY_API_KEY);
if (!apiKey || apiKey !== API_KEY) {
  console.log("API key check failed");
  return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
}

  // Set CORS headers - use configured origins or default to '*'
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, x-api-key, X-Requested-With');  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get the target URL from the query parameter
    const targetUrl = req.query.url;

    if (!targetUrl) {
      console.log("Missing URL parameter");
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Prepare fetch options by cloning the request
    const fetchOptions = {
      method: req.method,
      headers: {}
    };

    // Forward headers except those that could cause issues
    const excludeHeaders = ['host', 'connection', 'origin', 'referer', 'x-api-key'];
    for (const [key, value] of Object.entries(req.headers)) {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        fetchOptions.headers[key] = value;
      }
    }

    // Forward the request body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (req.body) {
        // Make sure Content-Type is set for JSON body
        if (typeof req.body === 'object') {
          fetchOptions.body = JSON.stringify(req.body);
          if (!fetchOptions.headers['content-type']) {
            fetchOptions.headers['content-type'] = 'application/json';
          }
        } else if (req.rawBody) {
          // For raw body data
          fetchOptions.body = req.rawBody;
        } else {
          // For string body
          fetchOptions.body = req.body;
        }
      }
    }

    console.log("Fetching from target URL:", targetUrl);
    console.log("Fetch options:", JSON.stringify(fetchOptions, null, 2));

    const response = await fetch(targetUrl, fetchOptions);

    // Create response object
    const responseData = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    };
    console.log("Response metadata:", responseData);

    // Forward all response headers except for CORS headers
    for (const [key, value] of Object.entries(response.headers.raw())) {
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, value);
      }
    }

    // Handle based on content type
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const jsonData = await response.json();
        console.log("Returning JSON data");
        return res.status(response.status).json(jsonData);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        const text = await response.text();
        return res.status(response.status).send(text);
      }
    } else if (contentType.includes('text')) {
      const text = await response.text();
      console.log("Returning text data, length:", text.length);
      return res.status(response.status).send(text);
    } else {
      // Handle binary data (e.g., images, PDFs)
      const buffer = await response.buffer();
      console.log("Returning binary data, size:", buffer.length);
      return res.status(response.status).send(buffer);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};