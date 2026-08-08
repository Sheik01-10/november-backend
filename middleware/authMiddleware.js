const mongoose = require("mongoose");
const { getAuthInstance } = require("../config/auth");
const { fromNodeHeaders } = require("better-auth/node");

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Direct database lookup for bearer token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const db = mongoose.connection.db;
      if (db) {
        const sessionsCol = db.collection("sessions");
        const dbSession = await sessionsCol.findOne({
          token,
          expiresAt: { $gt: new Date() }
        });

        if (dbSession) {
          const User = require("../models/User");
          const user = await User.findById(dbSession.userId);
          if (user) {
            req.user = {
              id: user._id.toString(),
              email: user.email,
              name: user.name,
              role: user.role,
              isAdmin: user.isAdmin,
              image: user.image
            };
            req.session = {
              id: dbSession._id.toString(),
              token: dbSession.token,
              expiresAt: dbSession.expiresAt,
              userId: dbSession.userId.toString()
            };
            return next();
          }
        }
      }
    }

    // 2. Fallback to Better Auth session cookies
    const auth = getAuthInstance();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });

    if (session && session.user) {
      req.user = session.user;
      req.session = session.session;
      return next();
    }

    return res.status(401).json({ message: "Unauthorized: No active session" });
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    res.status(500).json({ message: "Internal Server Error in Authentication" });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: No active session" });
    }
    const User = require("../models/User");
    const user = await User.findOne({ email: req.user.email.toLowerCase() });
    if (!user || (user.role !== "admin" && !user.isAdmin)) {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    req.dbUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const requireStaff = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: No active session" });
    }
    const User = require("../models/User");
    const user = await User.findOne({ email: req.user.email.toLowerCase() });
    if (!user || (user.role !== "staff" && user.role !== "admin" && !user.isAdmin)) {
      return res.status(403).json({ message: "Forbidden: Staff or Admins only" });
    }
    if (user.role === "staff" && !user.isActive) {
      return res.status(403).json({ message: "Forbidden: Staff account is deactivated" });
    }
    req.dbUser = user;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

authMiddleware.requireAdmin = requireAdmin;
authMiddleware.requireStaff = requireStaff;

module.exports = authMiddleware;
