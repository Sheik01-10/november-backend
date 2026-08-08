const Order = require("../models/Order");
const User = require("../models/User");

// GET /api/staff/dashboard-stats
exports.getStaffDashboardStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: "Pending" });
    const processingOrders = await Order.countDocuments({ status: "Processing" });
    const completedOrders = await Order.countDocuments({ status: "Completed" });
    
    // Total customers = users who are not admin/staff
    const totalCustomers = await User.countDocuments({
      role: { $ne: "admin", $ne: "staff" },
      isAdmin: { $ne: true }
    });

    res.json({
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      totalCustomers
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/staff/orders
exports.getStaffOrders = async (req, res) => {
  try {
    const orders = await Order.find({}, "orderId customerName customerEmail phone amount status paymentStatus paymentMethod date address city district state pincode items")
      .sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/staff/customers
exports.getStaffCustomers = async (req, res) => {
  try {
    const customers = await User.find({
      role: { $ne: "admin", $ne: "staff" },
      isAdmin: { $ne: true }
    }).sort({ createdAt: -1 });

    const customerData = await Promise.all(
      customers.map(async (user) => {
        const orders = await Order.find({ customerEmail: user.email.toLowerCase() }).sort({ date: -1 });
        const lastOrder = orders[0];
        const district = lastOrder ? lastOrder.district : (user.addresses?.find(a => a.isDefault)?.city || "—");
        
        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || (lastOrder ? lastOrder.phone : "—"),
          district: district || "—",
          ordersCount: orders.length,
          lastOrderDate: lastOrder ? lastOrder.date : null,
          isActive: user.isActive !== false ? "Active" : "Inactive",
          createdAt: user.createdAt
        };
      })
    );

    res.json(customerData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/staff/analytics/districts
exports.getDistrictInsights = async (req, res) => {
  try {
    const orders = await Order.find({}, "district orderId");
    
    const districtCounts = {};
    let totalOrdersCount = 0;

    orders.forEach((order) => {
      let rawDistrict = order.district;
      if (!rawDistrict) {
        rawDistrict = "Unknown";
      }

      const formattedDistrict = rawDistrict.trim()
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());

      districtCounts[formattedDistrict] = (districtCounts[formattedDistrict] || 0) + 1;
      totalOrdersCount++;
    });

    const rankedDistricts = Object.keys(districtCounts).map((district) => ({
      district,
      ordersCount: districtCounts[district]
    })).sort((a, b) => b.ordersCount - a.ordersCount);

    const totalDistrictsCount = Object.keys(districtCounts).filter(d => d !== "Unknown").length;

    res.json({
      totalDistricts: totalDistrictsCount,
      totalOrders: totalOrdersCount,
      districts: rankedDistricts
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/staff/heartbeat
exports.staffHeartbeat = async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id);
    if (user) {
      user.lastActiveAt = new Date();
      user.onlineStatus = "online";
      await user.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
