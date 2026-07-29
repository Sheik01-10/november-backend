const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

router.post("/create-order", paymentController.createCashfreeOrder);
router.post("/verify", paymentController.verifyCashfreePayment);
router.post("/verify-payment", paymentController.verifyCashfreePayment);
router.post("/webhook", paymentController.handleCashfreeWebhook);

module.exports = router;
