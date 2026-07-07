const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.get("/", userController.getUsers);
router.get("/check-email", userController.checkEmail);
router.post("/sync", userController.syncUser);
router.delete("/:id", userController.deleteUser);

// Profile and Address routes
router.get("/profile/:uid", userController.getUserProfile);
router.put("/profile/:uid", userController.updateUserProfile);
router.post("/profile/:uid/address", userController.addUserAddress);
router.put("/profile/:uid/address/:addressId", userController.updateUserAddress);
router.delete("/profile/:uid/address/:addressId", userController.deleteUserAddress);
router.put("/profile/:uid/address/:addressId/default", userController.setDefaultAddress);

module.exports = router;
