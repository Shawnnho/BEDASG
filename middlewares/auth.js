const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Guest sessions: a JWT carrying a random guestSessionId, delivered as a
// SESSION cookie (no maxAge) so it dies when the browser session ends —
// which is what makes a guest's in-session order history "disappear". The
// short TTL is just a backstop against a cookie that somehow lingers.
const GUEST_TOKEN_TTL = "3h";

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

// For guest-capable routes: if the caller is a logged-in user (req.user set
// by optionalAuth), do nothing. Otherwise ensure a guest token exists —
// reading its guestSessionId if valid, or minting a fresh one — and expose
// it as req.guestSessionId for the checkout model to stamp onto orders.
function guestSession(req, res, next) {
  if (req.user) return next(); // logged-in users don't need a guest id

  const existing = req.cookies?.guestToken;
  if (existing) {
    try {
      const decoded = jwt.verify(existing, process.env.JWT_SECRET);
      if (decoded?.guest && decoded.guestSessionId) {
        req.guestSessionId = decoded.guestSessionId;
        return next();
      }
    } catch {
      // fall through and mint a new one
    }
  }

  const guestSessionId = "GS_" + crypto.randomBytes(16).toString("hex");
  const token = jwt.sign(
    { guest: true, guestSessionId },
    process.env.JWT_SECRET,
    { expiresIn: GUEST_TOKEN_TTL },
  );

  // No maxAge/expires → session cookie → cleared on browser close.
  res.cookie("guestToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  req.guestSessionId = guestSessionId;
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole, optionalAuth, guestSession };
