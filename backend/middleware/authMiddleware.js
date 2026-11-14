const requireAdminAuth = (req, res, next) => {
  const configuredKey = process.env.ADMIN_API_KEY;

  if (!configuredKey) {
    return res.status(500).json({
      success: false,
      error: 'ADMIN_API_KEY is not configured on the server. Administrative access disabled.'
    });
  }

  const providedKey = req.headers['x-admin-key'] || (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/, ''));

  if (!providedKey || providedKey !== configuredKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Valid administrative key required for catalog modification endpoints.'
    });
  }

  next();
};

module.exports = {
  requireAdminAuth
};
