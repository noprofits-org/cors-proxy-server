module.exports = (req, res) => {
  res.status(200).json({
    message: "Test endpoint working correctly",
    timestamp: new Date().toISOString()
  });
};