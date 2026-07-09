const Razorpay = require("razorpay");
const crypto = require("crypto");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");

// Initialize Razorpay
// For testing purposes, we provide fallbacks if env vars are missing,
// but warn the developer.
const key_id = process.env.RAZORPAY_KEY_ID || "";
const key_secret = process.env.RAZORPAY_KEY_SECRET || "";

if (!key_id || !key_secret) {
  console.warn("WARNING: Razorpay credentials are not fully configured in backend/.env!");
}

const razorpay = new Razorpay({
  key_id: key_id,
  key_secret: key_secret
});

// Create a Razorpay Order
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { items, email } = req.body;
    if (!email) {
      return res.status(401).json({ message: "Unauthorized. Email is required to create a payment order." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized. You must have a registered account to create a payment order." });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items array is required to calculate total" });
    }

    // Securely calculate amount from database to prevent price tampering
    let totalAmount = 0;
    for (const item of items) {
      // Find product by id (the item has an 'id' field matching product._id)
      const productId = item.id || item._id;
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.name || productId}` });
      }
      totalAmount += product.price * (item.quantity || 1);
    }

    // Razorpay requires amount in minor units (paisa). So INR * 100
    const amountInPaisa = Math.round(totalAmount * 100);

    const options = {
      amount: amountInPaisa,
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`
    };

    const rzpOrder = await razorpay.orders.create(options);

    res.status(200).json({
      id: rzpOrder.id,
      currency: rzpOrder.currency,
      amount: rzpOrder.amount,
      keyId: key_id
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    res.status(500).json({ message: err.message || "Failed to create payment order" });
  }
};

// Verify Razorpay Payment Signature and Save Order
exports.verifyPaymentSignature = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderData } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderData) {
      return res.status(400).json({ message: "Missing required payment verification details" });
    }

    // Verify user existence before creating the order
    const user = await User.findOne({ email: orderData.customerEmail?.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized. You must have a registered account to place an order." });
    }

    // Verify payment signature
    const hmac = crypto.createHmac("sha256", key_secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature !== razorpay_signature) {
      console.error("Invalid payment signature mismatch!");
      return res.status(400).json({ message: "Payment verification failed. Invalid signature." });
    }

    // Generate unique November Order ID
    const count = await Order.countDocuments();
    const uniqueOrderId = `ORD-${1000 + count + 1}`;

    // Create and save the order in MongoDB
    const newOrder = new Order({
      orderId: uniqueOrderId,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      customerPhoto: orderData.customerPhoto || "",
      phone: orderData.phone || "",
      address: orderData.address || "",
      city: orderData.city || "",
      state: orderData.state || "",
      pincode: orderData.pincode || "",
      landmark: orderData.landmark || "",
      amount: orderData.amount, // in INR
      status: "Processing", // Paid order starts as Processing
      paymentMethod: "Online Payment",
      paymentStatus: "Paid",
      items: orderData.items,
      date: new Date()
    });

    const savedOrder = await newOrder.save();

    // Update User order history (user already found)
    if (!user.orders) {
      user.orders = [];
    }
    user.orders.push(savedOrder._id);
    await user.save();

    // Emit socket event for real-time admin updates
    const io = req.app.get("io");
    if (io) {
      io.emit("order_changed", { action: "create", data: savedOrder });
    }

    res.status(201).json({
      success: true,
      message: "Order placed and payment verified successfully",
      order: savedOrder
    });
  } catch (err) {
    console.error("Payment verification and order saving failed:", err);
    res.status(500).json({ message: err.message || "Failed to verify payment and place order" });
  }
};
