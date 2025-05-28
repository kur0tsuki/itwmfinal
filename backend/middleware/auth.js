const jwt = require("jsonwebtoken");

// Authentication middleware
const auth = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret"
    );
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token." });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (token) {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "fallback_secret"
      );
      req.user = decoded;
    }
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Admin role middleware
const adminAuth = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Access denied. Admin privileges required." });
  }
  next();
};

// Manager or Admin role middleware
const managerAuth = (req, res, next) => {
  if (!req.user || !["admin", "manager"].includes(req.user.role)) {
    return res
      .status(403)
      .json({ error: "Access denied. Manager privileges required." });
  }
  next();
};

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
};

module.exports = {
  auth,
  optionalAuth,
  adminAuth,
  managerAuth,
  generateToken,
  verifyToken,
};
