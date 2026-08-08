const { getAuthInstance } = require("../config/auth");
const { fromNodeHeaders } = require("better-auth/node");

const authMiddleware = async (req, res, next) => {
  try {
    const auth = getAuthInstance();
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });

    if (!session || !session.user) {
      return res.status(401).json({ message: "Unauthorized: No active session" });
    }

    req.user = session.user;
    req.session = session.session;
    next();
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
