// api/proxy.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  
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
    
    // Prepare headers to forward
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      // Skip headers that might cause issues
      if (!['host', 'connection', 'origin', 'referer'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }
    
    // Handle the request to the target URL
    const fetchOptions = {
      method: req.method,
      headers,
    };
    
    // Add body for non-GET/HEAD requests if present
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    
    // Forward the status code
    res.status(response.status);
    
    // Forward response headers
    for (const [key, value] of response.headers.entries()) {
      // Skip headers that might cause issues
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }
    
    // Check content type to handle response appropriately
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.json(data);
    } else {
      const data = await response.text();
      return res.send(data);
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