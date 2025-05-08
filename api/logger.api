// logger.js - Simple logging for CORS proxy monitoring
// This file should be placed in the /api directory alongside proxy.js

// We'll use a simple in-memory cache to avoid excessive writes
// and stay within Vercel's free tier limitations
let requestCache = [];
const MAX_CACHE_SIZE = 100; // Adjust based on memory constraints

// Function to log proxy requests
async function logRequest(req, targetUrl, startTime, responseStatus, responseSize) {
  try {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Extract relevant information
    const requestData = {
      timestamp: new Date().toISOString(),
      sourceIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      targetUrl: targetUrl,
      method: req.method,
      userAgent: req.headers['user-agent'] || 'Unknown',
      referer: req.headers['referer'] || 'Unknown',
      responseTime: responseTime,
      responseStatus: responseStatus,
      responseSize: responseSize || 0
    };

    // Add to in-memory cache
    requestCache.push(requestData);
    
    // If cache exceeds maximum size, remove oldest entries
    if (requestCache.length > MAX_CACHE_SIZE) {
      requestCache = requestCache.slice(requestCache.length - MAX_CACHE_SIZE);
    }
    
    return true;
  } catch (error) {
    console.error('Error logging request:', error);
    return false;
  }
}

// Function to retrieve logged data
function getRequestLogs() {
  return [...requestCache]; // Return a copy of the cache
}

// Function to clear logs (for maintenance)
function clearLogs() {
  requestCache = [];
  return true;
}

module.exports = {
  logRequest,
  getRequestLogs,
  clearLogs
};