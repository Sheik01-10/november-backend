const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const authMiddleware = require("../middleware/authMiddleware");

// All staff endpoints are protected and require a user with "staff" or "admin" role
router.get("/dashboard-stats", authMiddleware, authMiddleware.requireStaff, staffController.getStaffDashboardStats);
router.get("/orders", authMiddleware, authMiddleware.requireStaff, staffController.getStaffOrders);
router.get("/customers", authMiddleware, authMiddleware.requireStaff, staffController.getStaffCustomers);
router.get("/analytics/districts", authMiddleware, authMiddleware.requireStaff, staffController.getDistrictInsights);
router.post("/heartbeat", authMiddleware, authMiddleware.requireStaff, staffController.staffHeartbeat);

module.exports = router;
