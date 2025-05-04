const fetch = require('node-fetch');

// API key for basic authentication (set in Vercel environment variables)
const API_KEY = process.env.PROXY_API_KEY || 'your-default-api-key';

module.exports = async (req, res) => {
  // Check for API key in query or headers
  const apiKey = req.query.apiKey || req.headers['x-api-key'];
  if (!apiKey || apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get the target URL from the query parameter
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Make the request to the target URL
    const response = await fetch(targetUrl);

    // Explicitly set the content type to JSON for JSONPlaceholder
    if (targetUrl.includes('jsonplaceholder.typicode.com')) {
      const rawText = await response.text();
      try {
        const jsonData = JSON.parse(rawText);
        console.log("Handling JSONPlaceholder response:", jsonData);
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(JSON.stringify(jsonData));
      } catch (e) {
        console.log("JSON parsing failed:", e.message);
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(rawText);
      }
    }

    // Handle based on content type
    const contentType = response.headers.get('content-type') || '';
    res.setHeader('Content-Type', contentType);

    if (contentType.includes('application/json')) {
      const rawText = await response.text();
      return res.status(response.status).send(rawText);
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