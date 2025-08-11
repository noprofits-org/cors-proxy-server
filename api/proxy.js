const logger = require('./logger');

module.exports = async (req, res) => {
  // Set CORS headers - always allow all origins for a proxy
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Record start time for performance monitoring
  const startTime = Date.now();
  let targetUrl = '';

  try {
    // Get the target URL from the query parameter
    targetUrl = req.query.url;
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
    let responseSize = 0;

    if (contentType.includes('application/json')) {
      data = await response.json();
      const responseJson = JSON.stringify(data);
      responseSize = responseJson.length;
      
      // Log the completed request
      await logger.logRequest(req, targetUrl, startTime, response.status, responseSize);
      
      return res.status(response.status).json(data);
    } else if (contentType.includes('image/')) {
      const arrayBuffer = await response.arrayBuffer();
      data = Buffer.from(arrayBuffer);
      responseSize = data.length;
      
      // Log the completed request
      await logger.logRequest(req, targetUrl, startTime, response.status, responseSize);
      
      res.setHeader('Content-Type', contentType);
      return res.status(response.status).send(data);
    } else {
      data = await response.text();
      responseSize = data.length;
      
      // Log the completed request
      await logger.logRequest(req, targetUrl, startTime, response.status, responseSize);
      
      res.setHeader('Content-Type', contentType);
      return res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    
    // Log failed request
    if (targetUrl) {
      await logger.logRequest(req, targetUrl, startTime, 500, 0);
    }
    
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
};