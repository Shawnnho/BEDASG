const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const token = req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: no token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .json({ error: "Forbidden: invalid or expired token" });
    }
    req.user = decoded; // { userId, email, role }
    next();
  });
}

// Like verifyToken, but never rejects a missing/invalid token — it just
// leaves req.user unset. For routes that must support anonymous/guest use
// (e.g. guest checkout) while still identifying a caller who IS logged in.
function optionalAuth(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) return next();

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (!err) req.user = decoded;
    next();
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole, optionalAuth };
