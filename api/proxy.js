const fetch = require('node-fetch');

// Define allowed origins
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?
  process.env.ALLOWED_ORIGINS.split(',') :
  ['*'];

module.exports = async (req, res) => {
  // Set CORS headers
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, x-api-key, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

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

    // Prepare fetch options
    const fetchOptions = {
      method: req.method,
      headers: {}
    };

    // Forward headers except those that could cause issues
    const excludeHeaders = ['host', 'connection', 'origin', 'referer', 'x-api-key', 'content-encoding', 'content-length', 'transfer-encoding'];
    for (const [key, value] of Object.entries(req.headers)) {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        fetchOptions.headers[key] = value;
      }
    }

    // Critical change: Handle body differently based on request method
    // We need to avoid accessing req.body directly which can cause the "body used already" error
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      // Instead of directly using req.body, we'll manually reconstruct it from the raw request
      let bodyData = '';
      
      // For Vercel Edge Functions environment
      if (req.body && typeof req.body !== 'string') {
        if (Buffer.isBuffer(req.body)) {
          bodyData = req.body.toString();
        } else {
          try {
            bodyData = JSON.stringify(req.body);
          } catch (e) {
            console.error('Error stringifying body:', e);
          }
        }
      } else if (req.body) {
        bodyData = req.body;
      }
      
      if (bodyData) {
        fetchOptions.body = bodyData;
      }
    }

    // Make the request to the target URL
    const response = await fetch(targetUrl, fetchOptions);

    // Forward response status
    res.status(response.status);

    // Forward headers, except those related to CORS or encoding
    for (const [key, value] of Object.entries(response.headers.raw())) {
      if (!key.toLowerCase().startsWith('access-control-') && 
          key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    }

    // Explicitly remove content-encoding header
    res.removeHeader('content-encoding');

    // Handle different content types appropriately
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        const jsonData = await response.json();
        return res.json(jsonData);
      } catch (error) {
        const text = await response.text();
        return res.send(text);
      }
    } else if (contentType.includes('text/')) {
      const text = await response.text();
      return res.send(text);
    } else {
      // Handle binary data (e.g., images)
      const buffer = await response.buffer();
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
};