// api/proxy.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle OPTIONS requests (preflight)
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    const url = req.query.url;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Simple fetch request to the target URL
    const response = await fetch(url);
    
    // Special handling for JSONPlaceholder
    if (url.includes('jsonplaceholder.typicode.com')) {
      const json = await response.json();
      return res.status(200).json(json);
    }
    
    // Get content type
    const contentType = response.headers.get('content-type');
    
    // Set content type for the response
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    // Choose processing based on content type
    if (contentType && contentType.includes('application/json')) {
      const json = await response.json();
      return res.status(response.status).json(json);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message 
    });
  }
};