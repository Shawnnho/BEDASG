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

module.exports = { verifyToken };
