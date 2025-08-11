// api/debug-proxy.js
// A modified version of proxy.js with extra logging

const logger = require('./logger');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('Debug Proxy: Request received');
  
  // Record start time for performance monitoring
  const startTime = Date.now();
  let targetUrl = '';

  try {
    // Get the target URL from the query parameter
    targetUrl = req.query.url;
    console.log(`Debug Proxy: Target URL: ${targetUrl}`);
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Create fetch options
    const fetchOptions = {
      method: req.method,
      headers: {}
    };

    // Add headers
    if (req.headers['content-type']) {
      fetchOptions.headers['content-type'] = req.headers['content-type'];
    }
    if (req.headers['accept']) {
      fetchOptions.headers['accept'] = req.headers['accept'];
    }

    // Add body for appropriate methods
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && 
        req.headers['content-type']?.includes('application/json') && 
        typeof req.body === 'object') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // Make the request
    console.log(`Debug Proxy: Fetching ${targetUrl} with method ${req.method}`);
    const response = await fetch(targetUrl, fetchOptions);
    console.log(`Debug Proxy: Response status: ${response.status}`);

    // Process based on content type
    const contentType = response.headers.get('content-type') || '';
    let data;
    let responseSize = 0;

    if (contentType.includes('application/json')) {
      data = await response.json();
      const responseJson = JSON.stringify(data);
      responseSize = responseJson.length;
      
      // Log before returning
      console.log(`Debug Proxy: Logging JSON request, size ${responseSize} bytes`);
      try {
        const logResult = await logger.logRequest(req, targetUrl, startTime, response.status, responseSize);
        console.log(`Debug Proxy: Log result: ${logResult ? 'Success' : 'Failed'}`);
      } catch (logError) {
        console.error('Debug Proxy: Logging error:', logError);
      }
      
      return res.status(response.status).json(data);
    } else if (contentType.includes('image/')) {
      const arrayBuffer = await response.arrayBuffer();
      data = Buffer.from(arrayBuffer);
      responseSize = data.length;
      
      // Log before returning
      console.log(`Debug Proxy: Logging image request, size ${responseSize} bytes`);
      try {
        const logResult = await logger.logRequest(req, targetUrl, startTime, response.status, responseSize);
        console.log(`Debug Proxy: Log result: ${logResult ? 'Success' : 'Failed'}`);
      } catch (logError) {
        console.error('Debug Proxy: Logging error:', logError);
      }
      
      res.setHeader('Content-Type', contentType);
      return res.status(response.status).send(data);
    } else {
      data = await response.text();
      responseSize = data.length;
      
      // Log before returning
      console.log(`Debug Proxy: Logging text request, size ${responseSize} bytes`);
      try {
        const logResult = await logger.logRequest(req, targetUrl, startTime, response.status, responseSize);
        console.log(`Debug Proxy: Log result: ${logResult ? 'Success' : 'Failed'}`);
      } catch (logError) {
        console.error('Debug Proxy: Logging error:', logError);
      }
      
      res.setHeader('Content-Type', contentType);
      return res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Debug Proxy error:', error);
    
    // Attempt to log failure
    if (targetUrl) {
      try {
        await logger.logRequest(req, targetUrl, startTime, 500, 0);
      } catch (logError) {
        console.error('Debug Proxy: Error logging failed request:', logError);
      }
    }
    
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
};