const fetch = require('node-fetch');

// API key for basic authentication (set in Vercel environment variables)
const API_KEY = process.env.PROXY_API_KEY || 'your-default-api-key';

// Define allowed origins (can be customized via environment variables)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? 
  process.env.ALLOWED_ORIGINS.split(',') : 
  ['*'];

module.exports = async (req, res) => {
  // Log the incoming request for debugging
  console.log("Incoming request:", req.query, req.headers);

  // Check for API key in query or headers
  const apiKey = req.query.apiKey || req.headers['x-api-key'];
  if (!apiKey || apiKey !== API_KEY) {
    console.log("API key check failed. Provided:", apiKey);
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        fetchOptions.body = JSON.stringify(req.body);
      } else if (req.rawBody) {
        fetchOptions.body = req.rawBody;
      }
    }

    console.log("Fetching from target URL:", targetUrl);
    console.log("Fetch options:", fetchOptions);
    const response = await fetch(targetUrl, fetchOptions);

    // Log the response headers for debugging
    console.log("Response headers:", response.headers.raw());

    // Handle JSONPlaceholder specifically
    if (targetUrl.includes('jsonplaceholder.typicode.com')) {
      const jsonData = await response.json(); // Directly parse as JSON
      console.log("Handling JSONPlaceholder response:", jsonData);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(jsonData); // Use res.json to ensure proper formatting
    }

    // Handle based on content type
    const contentType = response.headers.get('content-type') || '';
    res.setHeader('Content-Type', contentType);

    // Forward all response headers except for CORS headers
    for (const [key, value] of Object.entries(response.headers.raw())) {
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, value);
      }
    }

    if (contentType.includes('application/json')) {
      const jsonData = await response.json();
      return res.status(response.status).json(jsonData);
    } else if (contentType.includes('text')) {
      const text = await response.text();
      return res.status(response.status).send(text);
    } else {
      // Handle binary data (e.g., images, PDFs)
      const buffer = await response.buffer();
      return res.status(response.status).send(buffer);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message 
    });
  }
};