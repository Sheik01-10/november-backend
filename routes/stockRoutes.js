const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stockController");

router.get("/summary", stockController.getStockSummary);
router.get("/products", stockController.getStockProducts);
router.post("/adjust", stockController.adjustStock);
router.get("/movements", stockController.getStockMovements);
router.post("/refresh", stockController.refreshStockData);

module.exports = router;
