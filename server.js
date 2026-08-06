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
  "https://novemberxix.duckdns.org"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isLocal = origin.startsWith("http://localhost:") || 
                    origin.startsWith("http://127.0.0.1:") || 
                    origin.startsWith("http://10.") || 
                    origin.startsWith("http://192.168.");
    if (isLocal || allowedOrigins.indexOf(origin) !== -1) {
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
app.all("/api/auth/*splat", (req, res, next) => {
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


app.get("/", (req, res) => {
  res.send("The November API Running with WebSockets Enabled");
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});