const security = require('./security');

// Lightweight connectivity/liveness check the client can ping. No upstream
// call — just confirms the proxy is reachable and reports its allowlist config.
module.exports = async (req, res) => {
  if (!security.applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(200).end();

  return res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    targetsLocked: !security.TARGETS_OPEN,
    originsLocked: !security.ORIGINS_OPEN,
    allowedTargets: security.ALLOWED_TARGETS,
  });
};
