const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");

router.get("/dashboard", analyticsController.getDashboardStats);
router.post("/track", analyticsController.trackVisitor);
router.get("/visitors", analyticsController.getVisitorStats);
router.post("/seed-visitors", analyticsController.seedVisitors);
router.post("/clear-visitors", analyticsController.clearVisitors);

module.exports = router;
