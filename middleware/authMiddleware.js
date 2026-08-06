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

module.exports = authMiddleware;
