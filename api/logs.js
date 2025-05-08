// logs.js - API endpoint for retrieving proxy logs
// This file should be placed in the /api directory alongside proxy.js

const logger = require('./logger');

module.exports = async (req, res) => {
  // Set CORS headers to allow dashboard access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Basic authentication (optional but recommended for production)
    // Uncomment and modify if you want to add auth
    /*
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== 'Bearer YOUR_SECRET_TOKEN') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    */

    // Get logs with optional filtering
    const logs = logger.getRequestLogs();
    
    // Apply simple filtering if query parameters are provided
    let filteredLogs = [...logs];
    
    // Filter by target domain if specified
    if (req.query.domain) {
      const domainFilter = req.query.domain.toLowerCase();
      filteredLogs = filteredLogs.filter(log => {
        try {
          const url = new URL(log.targetUrl);
          return url.hostname.includes(domainFilter);
        } catch (e) {
          return false;
        }
      });
    }
    
    // Filter by timeframe if specified (in minutes)
    if (req.query.timeframe) {
      const timeframeMinutes = parseInt(req.query.timeframe, 10);
      if (!isNaN(timeframeMinutes)) {
        const cutoffTime = new Date(Date.now() - timeframeMinutes * 60 * 1000);
        filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= cutoffTime);
      }
    }
    
    // Return the filtered logs
    return res.status(200).json({
      total: filteredLogs.length,
      logs: filteredLogs
    });
  } catch (error) {
    console.error('Error retrieving logs:', error);
    return res.status(500).json({
      error: 'Failed to retrieve logs',
      message: error.message
    });
  }
};