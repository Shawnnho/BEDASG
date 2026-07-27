const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const userModel = require("../models/userModel");
const refreshTokenModel = require("../models/refreshTokenModel");
const stallModel = require("../models/stallModel");

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const isProd = process.env.NODE_ENV === "production";

function toPublicUser(user) {
  return {
    id: user.UserId,
    name: user.Name,
    email: user.Email,
    phone: user.Phone,
    role: user.UserRole,
  };
}

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.UserId, email: user.Email, role: user.UserRole },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000,
    path: "/",
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_TTL_MS,
    path: "/api/auth",
  });
}

function clearAuthCookies(res) {
  res.clearCookie("accessToken", { path: "/" });
  res.clearCookie("refreshToken", { path: "/api/auth" });
}

async function issueTokens(res, user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await refreshTokenModel.createRefreshToken(user.UserId, hashToken(refreshToken), expiresAt);
  setAuthCookies(res, accessToken, refreshToken);
}

async function register(req, res) {
  try {
    const { name, email, phone, password, role, stallCentreId, stallName, stallCuisine } = req.body;

    const existing = await userModel.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({
        error: "Validation failed",
        fields: { email: "An account with this email already exists." },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await userModel.createUser({ name, email, phone, passwordHash, role });

    let stall = null;
    if (role === "storeholder") {
      try {
        stall = await stallModel.createStall({
          ownerUid: user.UserId,
          centreId: stallCentreId,
          stallName,
          cuisine: stallCuisine,
          phone,
        });
      } catch (stallErr) {
        // The user account was already created successfully at this point.
        // Rather than leave them with no account at all, surface the stall
        // failure specifically so the front-end can explain what to do next.
        console.error("stall creation failed after user was created:", stallErr);
        await issueTokens(res, user);
        return res.status(201).json({
          user: toPublicUser(user),
          warning: "Account created, but stall setup failed. You can finish setting up your stall from your dashboard.",
        });
      }
    }

    await issueTokens(res, user);
    res.status(201).json({ user: toPublicUser(user), stall });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ error: "Failed to register" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await userModel.getUserWithCredentialsByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Account has been deactivated (stallholder or customer) — refuse to
    // issue tokens and tell the front-end to show the "contact support" popup.
    if (user.IsDeactivated) {
      return res.status(403).json({
        error: "This account has been deactivated.",
        deactivated: true,
        role: user.UserRole,
      });
    }

    await issueTokens(res, user);
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Failed to log in" });
  }
}

async function refresh(req, res) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: "No refresh token" });
    }

    const tokenHash = hashToken(token);
    const record = await refreshTokenModel.claimRefreshToken(tokenHash);
    if (!record) {
      clearAuthCookies(res);
      return res.status(403).json({ error: "Invalid or expired refresh token" });
    }

    const user = await userModel.getUserById(record.UserId);
    if (!user) {
      clearAuthCookies(res);
      return res.status(403).json({ error: "User no longer exists" });
    }

    await issueTokens(res, user);
    res.json({ message: "Token refreshed" });
  } catch (err) {
    console.error("refresh error:", err);
    res.status(500).json({ error: "Failed to refresh token" });
  }
}

async function me(req, res) {
  try {
    const user = await userModel.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error("me error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
}

async function logout(req, res) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await refreshTokenModel.revokeRefreshToken(hashToken(token));
    }
    clearAuthCookies(res);
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("logout error:", err);
    res.status(500).json({ error: "Failed to log out" });
  }
}

module.exports = { register, login, refresh, me, logout };