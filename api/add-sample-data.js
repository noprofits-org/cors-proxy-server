// api/add-sample-data.js
// Adds sample data to the logger for testing purposes

const logger = require('./logger');

module.exports = (req, res) => {
  try {
    // Create sample data
    const domains = [
      'collectionapi.metmuseum.org',
      'images.metmuseum.org',
      'api.example.com',
      'data.service.com',
      'cdn.images.net'
    ];
    
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    const statuses = [200, 200, 200, 201, 404, 500];
    
    // Generate sample logs
    for (let i = 0; i < 20; i++) {
      const method = methods[Math.floor(Math.random() * methods.length)];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const targetUrl = `https://${domain}/api/resource/${i}`;
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const responseTime = 50 + Math.floor(Math.random() * 500);
      const responseSize = 1024 + Math.floor(Math.random() * 10240);
      
      // Fake request object
      const fakeReq = {
        method,
        headers: {
          'user-agent': 'Mozilla/5.0 Test Browser',
          'referer': 'https://test-app.com'
        },
        connection: {
          remoteAddress: '192.168.1.1'
        }
      };
      
      // Log with timestamp spread out over the last hour
      const startTime = Date.now() - (i * 3 * 60 * 1000) - responseTime; // Spread over last hour, 3 min intervals
      logger.logRequest(fakeReq, targetUrl, startTime, status, responseSize);
    }
    
    // Get current logs count
    const logs = logger.getRequestLogs();
    
    // Return success
    return res.status(200).json({
      success: true,
      message: 'Sample data added',
      logsCount: logs.length,
      sampleLog: logs[0]
    });
  } catch (error) {
    console.error('Error adding sample data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add sample data',
      error: error.message
    });
  }
};