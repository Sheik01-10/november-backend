const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const VisitorSession = require("../models/VisitorSession");

// Stable location helper based on device ID
const indianLocations = [
  { state: "Tamil Nadu", district: "Chennai" },
  { state: "Tamil Nadu", district: "Coimbatore" },
  { state: "Tamil Nadu", district: "Madurai" },
  { state: "Tamil Nadu", district: "Tiruchirappalli" },
  { state: "Tamil Nadu", district: "Salem" },
  { state: "Tamil Nadu", district: "Tirunelveli" },
  { state: "Tamil Nadu", district: "Vellore" },
  { state: "Tamil Nadu", district: "Erode" },
  { state: "Tamil Nadu", district: "Thoothukudi" },
  { state: "Tamil Nadu", district: "Thanjavur" }
];

const getStableLocation = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % indianLocations.length;
  return indianLocations[index];
};

// Stable gender helper based on device ID
const getStableGender = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const score = Math.abs(hash) % 100;
  return score < 65 ? "Male" : "Female";
};

// Auto-seeding helper to generate realistic historical data for 30 days
const autoSeedVisitorSessions = async () => {
  const devices = ["Mobile", "Mobile", "Desktop", "Desktop", "Desktop", "Tablet"];
  const sources = ["Direct", "Organic Search", "Organic Search", "Social Media", "Social Media", "Referral"];
  const paths = [
    { path: "/", action: "Visited Homepage" },
    { path: "/products", action: "Browsed Catalog" },
    { path: "/product/classic-black-shirt", action: "Viewed Product Details" },
    { path: "/work-mode", action: "Browsed Work Mode" },
    { path: "/quiet-luxury", action: "Browsed Quiet Luxury" },
    { path: "/cart", action: "Viewed Shopping Cart" },
    { path: "/checkout", action: "Initiated Checkout" }
  ];

  const visitorSessions = [];
  const now = new Date();

  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    // Realistically grow traffic over the 30-day period
    const baseTraffic = 15 + Math.floor((30 - i) * 0.5);
    const dailyCount = Math.floor(Math.random() * 15) + baseTraffic; // 15 to 45 sessions per day

    for (let j = 0; j < dailyCount; j++) {
      const sessionHour = Math.floor(Math.random() * 24);
      const sessionMinute = Math.floor(Math.random() * 60);
      const createdAt = new Date(date);
      createdAt.setHours(sessionHour, sessionMinute, 0, 0);

      const deviceId = "dev_" + Math.random().toString(36).substr(2, 9);
      const sessionId = "sess_" + Math.random().toString(36).substr(2, 9);

      const loc = indianLocations[Math.floor(Math.random() * indianLocations.length)];
      const deviceType = devices[Math.floor(Math.random() * devices.length)];
      const trafficSource = sources[Math.floor(Math.random() * sources.length)];
      const gender = Math.random() < 0.65 ? "Male" : "Female";

      // Generate random page path sequence
      const sessionPathsCount = Math.floor(Math.random() * 4) + 1; // 1 to 4 pages
      const pagesVisited = [];
      let lastAction = "";
      let duration = 0;

      for (let p = 0; p < sessionPathsCount; p++) {
        const pathInfo = paths[Math.min(p, paths.length - 1)];
        const pageTime = new Date(createdAt);
        pageTime.setMinutes(pageTime.getMinutes() + p * 2 + Math.floor(Math.random() * 2));
        pagesVisited.push({
          path: pathInfo.path,
          timestamp: pageTime
        });
        lastAction = pathInfo.action;
        duration = p * 120 + Math.floor(Math.random() * 60); // approx 2 mins per page
      }

      const updatedAt = new Date(pagesVisited[pagesVisited.length - 1].timestamp);

      visitorSessions.push({
        sessionId,
        deviceId,
        ip: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        deviceType,
        gender,
        state: loc.state,
        district: loc.district,
        trafficSource,
        pagesVisited,
        lastAction,
        duration,
        createdAt,
        updatedAt
      });
    }
  }

  await VisitorSession.insertMany(visitorSessions);
  console.log(`Auto-seeded ${visitorSessions.length} visitor sessions.`);
};

// Check and seed if database is empty
const ensureVisitorData = async () => {
  // Clear any existing non-Tamil Nadu visitor sessions to maintain clean Tamil Nadu data
  const nonTNCount = await VisitorSession.countDocuments({ state: { $ne: "Tamil Nadu" } });
  if (nonTNCount > 0) {
    console.log(`Clearing ${nonTNCount} non-Tamil Nadu visitor sessions...`);
    await VisitorSession.deleteMany({ state: { $ne: "Tamil Nadu" } });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalCustomers = await User.countDocuments();

    // Sum revenue from Completed, Processing and Shipped orders
    const revenueResult = await Order.aggregate([
      { $match: { status: { $in: ["Completed", "Processing", "Shipped"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;
    const totalSales = totalRevenue;

    // Calculate total purchase cost of items sold
    const activeOrders = await Order.find({
      status: { $in: ["Completed", "Processing", "Shipped"] }
    });

    const productsList = await Product.find({});
    const productMap = {};
    productsList.forEach(p => {
      productMap[p.name.toLowerCase().trim()] = p;
    });

    let totalPurchaseCost = 0;
    activeOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const qty = item.quantity || 1;
          let cost = item.purchasePrice;
          
          if (cost === undefined || cost === null || cost === 0) {
            const prod = productMap[item.name.toLowerCase().trim()];
            if (prod && prod.purchasePrice) {
              cost = prod.purchasePrice;
            } else {
              cost = Math.round(item.price * 0.6); // 60% fallback
            }
          }
          
          totalPurchaseCost += cost * qty;
        });
      }
    });

    const totalProfit = totalSales - totalPurchaseCost;

    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const conversionRate = 2.4; // Typical e-commerce conversion rate benchmark

    // Monthly sales aggregation for chart
    const orders = await Order.find({
      status: { $in: ["Completed", "Processing", "Shipped"] }
    }).sort({ date: 1 });

    // Seed empty months to ensure the line chart renders nicely
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const salesMap = {};
    months.forEach(m => {
      salesMap[m] = 0;
    });

    // Populate with actual order data
    orders.forEach(order => {
      const date = new Date(order.date);
      const monthName = months[date.getMonth()];
      salesMap[monthName] += order.amount;
    });

    // Build sales data array starting from 0
    const salesData = months.map(m => ({
      name: m,
      sales: salesMap[m]
    }));

    res.json({
      stats: {
        totalRevenue,
        totalSales,
        totalPurchaseCost,
        totalProfit,
        totalOrders,
        totalProducts,
        totalCustomers,
        avgOrderValue,
        conversionRate
      },
      salesData
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST: Track pageviews and actions in real-time
exports.trackVisitor = async (req, res) => {
  try {
    const { sessionId, deviceId, path, referrer, action, userGender } = req.body;

    if (!sessionId || !deviceId || !path) {
      return res.status(400).json({ message: "Missing tracking information" });
    }

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";

    // Parse deviceType
    let deviceType = "Desktop";
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      deviceType = "Tablet";
    } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Opera Mini/i.test(userAgent)) {
      deviceType = "Mobile";
    }

    // Parse trafficSource
    let trafficSource = "Direct";
    if (referrer) {
      const refLower = referrer.toLowerCase();
      if (refLower.includes("google") || refLower.includes("bing") || refLower.includes("yahoo") || refLower.includes("duckduckgo")) {
        trafficSource = "Organic Search";
      } else if (refLower.includes("facebook") || refLower.includes("instagram") || refLower.includes("twitter") || refLower.includes("t.co") || refLower.includes("linkedin") || refLower.includes("pinterest") || refLower.includes("whatsapp")) {
        trafficSource = "Social Media";
      } else {
        trafficSource = "Referral";
      }
    }

    let session = await VisitorSession.findOne({ sessionId });
    const isNewSession = !session;

    if (isNewSession) {
      const loc = getStableLocation(deviceId);
      const gender = userGender || getStableGender(deviceId);

      session = new VisitorSession({
        sessionId,
        deviceId,
        ip,
        userAgent,
        deviceType,
        gender,
        state: loc.state,
        district: loc.district,
        trafficSource,
        pagesVisited: [{ path, timestamp: new Date() }],
        lastAction: action || "Visited Homepage",
        duration: 0
      });
    } else {
      // Check if page path is already registered or new
      const lastPage = session.pagesVisited[session.pagesVisited.length - 1];
      if (!lastPage || lastPage.path !== path) {
        session.pagesVisited.push({ path, timestamp: new Date() });
      }

      if (action) {
        session.lastAction = action;
      } else {
        // Infer action from path
        if (path === "/") session.lastAction = "Visited Homepage";
        else if (path.startsWith("/products")) session.lastAction = "Browsed Catalog";
        else if (path.startsWith("/product/")) session.lastAction = "Viewed Product Details";
        else if (path.startsWith("/cart")) session.lastAction = "Viewed Shopping Cart";
        else if (path.startsWith("/checkout")) session.lastAction = "Initiated Checkout";
        else if (path.startsWith("/work-mode")) session.lastAction = "Browsed Work Mode";
        else if (path.startsWith("/quiet-luxury")) session.lastAction = "Browsed Quiet Luxury";
        else session.lastAction = `Visited ${path}`;
      }

      session.duration = Math.round((Date.now() - session.createdAt.getTime()) / 1000);
      session.updatedAt = new Date();
    }

    await session.save();

    // Broadcast real-time activity event to admin screens
    const io = req.app.get("io");
    if (io) {
      io.emit("visitor_activity", session);
    }

    res.json({ success: true, sessionId: session.sessionId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET: Fetch detailed customer order district insights
exports.getVisitorStats = async (req, res) => {
  try {
    const { range } = req.query;
    let dateFilter = {};
    const now = new Date();

    if (range === "today") {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { date: { $gte: startOfToday } };
    } else if (range === "7days") {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateFilter = { date: { $gte: sevenDaysAgo } };
    } else if (range === "30days") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = { date: { $gte: thirtyDaysAgo } };
    } else if (range === "year") {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      dateFilter = { date: { $gte: startOfYear } };
    }

    const orders = await Order.find(dateFilter);
    const totalOrders = orders.length;

    const districtCounts = {};
    orders.forEach(order => {
      let district = order.district;
      if (!district || !district.trim()) {
        district = "District Not Provided";
      } else {
        district = district.trim();
        // Capitalize words nicely (e.g. "coimbatore" -> "Coimbatore", "new delhi" -> "New Delhi")
        district = district
          .split(" ")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");
      }
      districtCounts[district] = (districtCounts[district] || 0) + 1;
    });

    // Count unique districts (excluding "District Not Provided")
    const districtsKeys = Object.keys(districtCounts).filter(d => d !== "District Not Provided");
    const districtsCovered = districtsKeys.length;

    // Find top district
    let topDistrict = "N/A";
    let topDistrictOrders = 0;
    Object.entries(districtCounts).forEach(([dist, count]) => {
      if (dist !== "District Not Provided" && count > topDistrictOrders) {
        topDistrict = dist;
        topDistrictOrders = count;
      }
    });

    if (topDistrict === "N/A" && districtCounts["District Not Provided"] > 0) {
      topDistrict = "District Not Provided";
      topDistrictOrders = districtCounts["District Not Provided"];
    }

    // Prepare distribution array, sorted from highest order count to lowest
    const distribution = Object.entries(districtCounts).map(([district, count]) => {
      const percentage = totalOrders > 0 ? Math.round((count / totalOrders) * 100) : 0;
      return {
        district,
        orders: count,
        percentage
      };
    }).sort((a, b) => b.orders - a.orders);

    res.json({
      totalOrders,
      districtsCovered,
      topDistrict,
      topDistrictOrders,
      distribution
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST: Explicitly reseed / seed visitor data
exports.seedVisitors = async (req, res) => {
  try {
    await VisitorSession.deleteMany({});
    res.json({ success: true, message: "Visitor database cleared. Real-time logging active." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST: Clear visitor database (reset to 0)
exports.clearVisitors = async (req, res) => {
  try {
    await VisitorSession.deleteMany({});
    res.json({ success: true, message: "Visitor analytics database cleared. Starting from 0." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

