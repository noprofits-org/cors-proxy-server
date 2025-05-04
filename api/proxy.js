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
    
    // Make the request to the target URL
    const response = await fetch(targetUrl);
    
    // Set the status code
    res.status(response.status);
    
    // Get the content type
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    // For JSONPlaceholder specifically, force JSON content type
    if (targetUrl.includes('jsonplaceholder.typicode.com')) {
      res.setHeader('Content-Type', 'application/json');
      const text = await response.text();
      return res.send(text);
    }
    
    // Read the response as text
    const text = await response.text();
    
    // Send the response
    return res.send(text);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message 
    });
  }
};