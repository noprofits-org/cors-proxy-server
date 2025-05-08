// api/test-logs.js
const logger = require('./logger');

module.exports = (req, res) => {
  // Add a test entry
  const testRequest = {
    method: 'GET',
    headers: { 'user-agent': 'Test' },
    connection: { remoteAddress: '127.0.0.1' }
  };
  
  logger.logRequest(testRequest, 'https://test.example.com', Date.now() - 100, 200, 1024);
  
  // Return both the test entry and any existing logs
  const logs = logger.getRequestLogs();
  
  res.status(200).json({
    added: 1,
    existingLogs: logs.length,
    sampleLog: logs.length > 0 ? logs[0] : null
  });
};