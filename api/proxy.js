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

    // Prepare fetch options by cloning the request
    const fetchOptions = {
      method: req.method,
      headers: {}
    };

    // Forward headers except those that could cause issues
    const excludeHeaders = ['host', 'connection', 'origin', 'referer', 'x-api-key', 'content-encoding'];
    for (const [key, value] of Object.entries(req.headers)) {
      if (!excludeHeaders.includes(key.toLowerCase())) {
        fetchOptions.headers[key] = value;
      }
    }

    // Forward the request body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (req.body) {
        if (typeof req.body === 'object') {
          fetchOptions.body = JSON.stringify(req.body);
          if (!fetchOptions.headers['content-type']) {
            fetchOptions.headers['content-type'] = 'application/json';
          }
        } else if (req.rawBody) {
          fetchOptions.body = req.rawBody;
        } else {
          fetchOptions.body = req.body;
        }
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Create response object
    const responseData = {
      status: response.status,
      statusText: response.statusText
    };

    // IMPORTANT: Never forward content-encoding headers
    // as they can cause ERR_CONTENT_DECODING_FAILED
    for (const [key, value] of Object.entries(response.headers.raw())) {
      if (!key.toLowerCase().startsWith('access-control-') && 
          key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    }

    // Explicitly remove content-encoding header if it was set somehow
    res.removeHeader('content-encoding');

    // Handle based on content type
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const jsonData = await response.json();
        return res.status(response.status).json(jsonData);
      } catch (parseError) {
        const text = await response.text();
        return res.status(response.status).send(text);
      }
    } else if (contentType.includes('text')) {
      const text = await response.text();
      return res.status(response.status).send(text);
    } else {
      // Handle binary data (e.g., images, PDFs)
      const buffer = await response.buffer();
      return res.status(response.status).send(buffer);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
};