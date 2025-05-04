// api/proxy.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  
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
    Object.entries(req.headers).forEach(([key, value]) => {
      // Skip headers that might cause issues
      if (!['host', 'connection', 'origin', 'referer'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });
    
    // Handle the request to the target URL
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
    });
    
    // Get response headers
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      // Skip headers that might cause issues
      if (!['content-encoding', 'content-length', 'connection', 'access-control-allow-origin'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });
    
    // Set response headers
    Object.entries(responseHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    // Return the response
    const data = await response.text();
    return res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
};