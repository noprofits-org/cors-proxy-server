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
    
    console.log(`Proxying request to: ${targetUrl}`);
    
    // Make the request to the target URL
    const response = await fetch(targetUrl);
    
    // Get response status and headers
    const status = response.status;
    const headers = {};
    
    // Forward response headers except problematic ones
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type') || '';
    
    // Handle different content types
    let responseData;
    
    if (contentType.includes('application/json')) {
      responseData = await response.json();
      res.status(status).json(responseData);
    } else {
      // For text responses
      responseData = await response.text();
      
      // Set content type explicitly
      res.setHeader('Content-Type', contentType || 'text/plain');
      
      // Set all other headers
      Object.entries(headers).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'content-type') {
          res.setHeader(key, value);
        }
      });
      
      res.status(status).send(responseData);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message
    });
  }
};