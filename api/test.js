module.exports = (req, res) => {
  console.log("Test endpoint hit");
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    message: "Test endpoint working correctly",
    timestamp: new Date().toISOString()
  });
};