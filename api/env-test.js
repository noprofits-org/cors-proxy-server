// api/env-test.js
module.exports = (req, res) => {
    res.json({
      envVarExists: !!process.env.PROXY_API_KEY,
      // Don't return the actual key for security reasons
      keyLength: process.env.PROXY_API_KEY ? process.env.PROXY_API_KEY.length : 0
    });
  };