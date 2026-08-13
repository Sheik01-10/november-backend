require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");

const path = require("path");

// Routes imports
const productRoutes = require("./routes/productRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const userRoutes = require("./routes/userRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const supportRoutes = require("./routes/supportRoutes");
const staffRoutes = require("./routes/staffRoutes");

const app = express();
const server = http.createServer(app);

// Socket.io configuration
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set("io", io);

connectDB();

// Configure CORS with credentials support
const allowedOrigins = [
  "http://localhost:5173",
  "https://novemberxix.duckdns.org",
  "https://thenovember.in",
  "http://thenovember.in"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isLocal = origin.startsWith("http://localhost:") || 
                    origin.startsWith("http://127.0.0.1:") || 
                    origin.startsWith("http://10.") || 
                    origin.startsWith("http://192.168.");
    const isDomain = origin.endsWith(".thenovember.in") || 
                     origin === "https://thenovember.in" || 
                     origin === "http://thenovember.in";
    if (isLocal || isDomain || allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    const msg = "The CORS policy for this site does not allow access from the specified Origin.";
    return callback(new Error(msg), false);
  },
  credentials: true
}));

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Better Auth API route handler
const { toNodeHandler } = require("better-auth/node");
const mongoose = require("mongoose");
app.all(/^\/api\/auth\/(.*)/, (req, res, next) => {
  if (mongoose.connection.readyState === 2) {
    mongoose.connection.once("connected", () => {
      const { getAuthInstance } = require("./config/auth");
      toNodeHandler(getAuthInstance())(req, res, next);
    });
  } else {
    const { getAuthInstance } = require("./config/auth");
    toNodeHandler(getAuthInstance())(req, res, next);
  }
});

// Static files for local uploads fallback
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes middleware
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/payments", paymentRoutes);
app.post("/api/create-order", require("./controllers/paymentController").createCashfreeOrder);
app.post("/api/verify-payment", require("./controllers/paymentController").verifyCashfreePayment);
app.use("/api/support", supportRoutes);
app.use("/api/staff", staffRoutes);

// Proxy pincode requests to bypass browser CORS policy
const https = require("https");
app.get("/api/pincode/:pin", (req, res) => {
  const { pin } = req.params;
  https.get(`https://api.postalpincode.in/pincode/${pin}`, (apiRes) => {
    let data = "";
    apiRes.on("data", (chunk) => {
      data += chunk;
    });
    apiRes.on("end", () => {
      try {
        const jsonData = JSON.parse(data);
        res.json(jsonData);
      } catch (err) {
        console.error("Failed to parse pincode data:", err);
        res.status(500).json({ message: "Failed to parse pincode data" });
      }
    });
  }).on("error", (err) => {
    console.error("Pincode fetch error:", err);
    res.status(500).json({ message: err.message });
  });
});

app.get("/", (req, res) => {
  res.send("The November API Running with WebSockets Enabled");
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Background cleaner to set inactive staff offline (heartbeat timeout)
setInterval(async () => {
  try {
    const User = require("./models/User");
    const StaffLoginActivity = require("./models/StaffLoginActivity");
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const inactiveStaff = await User.find({
      role: "staff",
      onlineStatus: "online",
      lastActiveAt: { $lt: twoMinutesAgo }
    });

    for (const staff of inactiveStaff) {
      staff.onlineStatus = "offline";
      staff.lastLogoutAt = staff.lastActiveAt || new Date();
      await staff.save();

      const latestActivity = await StaffLoginActivity.findOne({
        userId: staff._id,
        status: "online"
      }).sort({ loginAt: -1 });

      if (latestActivity) {
        latestActivity.status = "offline";
        latestActivity.logoutAt = staff.lastActiveAt || new Date();
        await latestActivity.save();
      }

      console.log(`Auto-marked inactive staff ${staff.email} offline.`);
    }

    if (inactiveStaff.length > 0) {
      const ioInstance = app.get("io");
      if (ioInstance) {
        ioInstance.emit("staff_changed", { action: "heartbeat_timeout" });
      }
    }
  } catch (err) {
    console.error("Heartbeat clean-up check failed:", err.message);
  }
}, 60000); // Check every 60 seconds

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});