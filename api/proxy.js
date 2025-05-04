const fetch = require('node-fetch');

module.exports = async (req, res) => {
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
      // Read as text, then manually parse and stringify for safety
      const rawText = await response.text();
      try {
        const jsonData = JSON.parse(rawText);
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(JSON.stringify(jsonData));
      } catch (e) {
        // If parsing fails, return as plain text
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