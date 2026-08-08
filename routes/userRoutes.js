const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const User = require("../models/User");
const mongoose = require("mongoose");

// Helper to check ownership
const profileOwnerMiddleware = async (req, res, next) => {
  try {
    const uid = req.params.uid;
    const query = mongoose.isValidObjectId(uid)
      ? { $or: [{ _id: uid }, { uid: uid }] }
      : { uid: uid };
    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Authenticated user's email must match profile's email
    if (user.email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ message: "Forbidden: You do not own this profile" });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

router.get("/", userController.getUsers);
router.get("/check-email", userController.checkEmail);
router.post("/sync", userController.syncUser);
router.delete("/:id", userController.deleteUser);

// Login and Logout success tracking endpoints
router.post("/login-success", authMiddleware, userController.loginSuccess);
router.post("/logout-success", authMiddleware, userController.logoutSuccess);

// Staff management endpoints (Admin only)
router.get("/staff", authMiddleware, authMiddleware.requireAdmin, userController.getStaff);
router.post("/staff", authMiddleware, authMiddleware.requireAdmin, userController.createStaff);
router.put("/staff/:id/toggle", authMiddleware, authMiddleware.requireAdmin, userController.toggleStaffStatus);
router.delete("/staff/:id", authMiddleware, authMiddleware.requireAdmin, userController.deleteStaff);
router.get("/staff/activity", authMiddleware, authMiddleware.requireAdmin, userController.getStaffActivity);

// Profile and Address routes (Protected by session & owner validation)
router.get("/profile/:uid", authMiddleware, profileOwnerMiddleware, userController.getUserProfile);
router.put("/profile/:uid", authMiddleware, profileOwnerMiddleware, userController.updateUserProfile);
router.post("/profile/:uid/address", authMiddleware, profileOwnerMiddleware, userController.addUserAddress);
router.put("/profile/:uid/address/:addressId", authMiddleware, profileOwnerMiddleware, userController.updateUserAddress);
router.delete("/profile/:uid/address/:addressId", authMiddleware, profileOwnerMiddleware, userController.deleteUserAddress);
router.put("/profile/:uid/address/:addressId/default", authMiddleware, profileOwnerMiddleware, userController.setDefaultAddress);

module.exports = router;
