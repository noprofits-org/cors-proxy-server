const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Set CORS headers - always allow all origins for a proxy
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
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

    // Create a new request with minimal options
    const fetchOptions = {
      method: req.method,
      headers: {}
    };

    // Only add essential headers for the target request
    if (req.headers['content-type']) {
      fetchOptions.headers['content-type'] = req.headers['content-type'];
    }
    if (req.headers['accept']) {
      fetchOptions.headers['accept'] = req.headers['accept'];
    }

    // Add body ONLY for POST, PUT, PATCH requests
    // And ONLY if content-type is application/json
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && 
        req.headers['content-type']?.includes('application/json') && 
        typeof req.body === 'object') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // Make the request
    console.log(`Fetching ${targetUrl} with method ${req.method}`);
    const response = await fetch(targetUrl, fetchOptions);

    // Get response data based on content-type
    const contentType = response.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await response.json();
      return res.status(response.status).json(data);
    } else if (contentType.includes('image/')) {
      data = await response.buffer();
      res.setHeader('Content-Type', contentType);
      return res.status(response.status).send(data);
    } else {
      data = await response.text();
      res.setHeader('Content-Type', contentType);
      return res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
};