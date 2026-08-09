const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Settings = require("../models/Settings");
const crypto = require("crypto");

// Initialize Cashfree Credentials
const appId = process.env.CASHFREE_APP_ID || "";
const secretKey = process.env.CASHFREE_SECRET_KEY || "";
const cfMode = process.env.CASHFREE_MODE || "production";

if (!appId || !secretKey) {
  console.warn("WARNING: Cashfree credentials are not fully configured in backend/.env!");
}

// Create a Cashfree Order
exports.createCashfreeOrder = async (req, res) => {
  try {
    const { items, email, phone, customerName, amount, currency: reqCurrency } = req.body;
    if (!email) {
      return res.status(401).json({ message: "Unauthorized. Email is required to create a payment order." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized. You must have a registered account to create a payment order." });
    }

    let finalAmountINR;
    let currency = reqCurrency || "INR";

    if (amount !== undefined) {
      finalAmountINR = Number(amount);
    } else {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Items array is required to calculate total" });
      }

      // Securely calculate amount from database to prevent price tampering
      let subtotal = 0;
      let shippingCharge = 0;
      for (const item of items) {
        const productId = item.id || item._id;
        const product = await Product.findById(productId);
        if (!product) {
          return res.status(404).json({ message: `Product not found: ${item.name || productId}` });
        }
        subtotal += product.price * (item.quantity || 1);
        const charge = product.deliveryCharge !== undefined ? product.deliveryCharge : 150;
        shippingCharge += charge * (item.quantity || 1);
      }

      let calculatedAmount = subtotal;
      const settings = await Settings.findOne();
      let threshold = settings && settings.freeShippingThreshold !== undefined ? settings.freeShippingThreshold : 999;
      if (threshold === 5000) {
        threshold = 999;
      }
      if (subtotal < threshold) {
        calculatedAmount += shippingCharge;
      }

      finalAmountINR = calculatedAmount;
    }

    if (!finalAmountINR || isNaN(finalAmountINR) || finalAmountINR < 1) {
      return res.status(400).json({ message: "Amount must be at least 1 INR" });
    }

    const orderId = `cf_order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const customerId = user._id.toString();
    const customerPhone = phone || user.phone || "9999999999";
    const customerNameVal = customerName || user.name || "Customer";

    const origin = req.headers.origin || "http://localhost:5173";
    const returnUrl = `${origin}/checkout?cf_order_id={order_id}`;

    const cfBaseUrl = "https://api.cashfree.com/pg/orders";

    const response = await fetch(cfBaseUrl, {
      method: "POST",
      headers: {
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        order_amount: Number(finalAmountINR.toFixed(2)),
        order_currency: currency,
        order_id: orderId,
        customer_details: {
          customer_id: customerId,
          customer_email: email.toLowerCase(),
          customer_phone: customerPhone,
          customer_name: customerNameVal
        },
        order_meta: {
          return_url: returnUrl
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cashfree API error:", errorText);
      return res.status(400).json({ message: `Cashfree order creation failed: ${errorText}` });
    }

    const cfOrder = await response.json();

    res.status(200).json({
      id: cfOrder.order_id,
      order_id: cfOrder.order_id,
      payment_session_id: cfOrder.payment_session_id,
      currency: cfOrder.order_currency,
      amount: cfOrder.order_amount
    });
  } catch (err) {
    console.error("Cashfree order creation failed:", err);
    res.status(500).json({ message: err.message || "Failed to create payment order" });
  }
};

// Verify Cashfree Payment and Save Order
exports.verifyCashfreePayment = async (req, res) => {
  try {
    const { orderId, orderData } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Missing required orderId" });
    }

    const cfBaseUrl = "https://api.cashfree.com/pg/orders";

    const response = await fetch(`${cfBaseUrl}/${orderId}`, {
      method: "GET",
      headers: {
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2023-08-01",
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cashfree status check failed:", errorText);
      return res.status(400).json({ message: "Failed to verify payment status with Cashfree" });
    }

    const cfOrder = await response.json();

    if (cfOrder.order_status !== "PAID") {
      console.error(`Order status is not PAID. Current status: ${cfOrder.order_status}`);
      return res.status(400).json({ message: `Payment verification failed. Cashfree Status: ${cfOrder.order_status}` });
    }

    if (!orderData) {
      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        orderStatus: cfOrder.order_status
      });
    }

    // Check if order already exists to prevent duplicate creation
    const existingOrder = await Order.findOne({ cfOrderId: orderId });
    if (existingOrder) {
      console.log(`[Verify] Order for Cashfree ID ${orderId} already exists in database: ${existingOrder.orderId}`);
      return res.status(200).json({
        success: true,
        message: "Order placed and payment verified successfully",
        order: existingOrder
      });
    }

    // Verify user existence before creating the order
    const user = await User.findOne({ email: orderData.customerEmail?.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized. You must have a registered account to place an order." });
    }

    // Generate unique November Order ID
    const count = await Order.countDocuments();
    const uniqueOrderId = `ORD-${1000 + count + 1}`;

    // Populate purchasePrice from database
    const populatedItems = [];
    if (orderData.items && Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const prod = await Product.findOne({ name: item.name });
        populatedItems.push({
          ...item,
          purchasePrice: prod ? (prod.purchasePrice || 0) : 0
        });
      }
    }

    // Create and save the order in MongoDB
    const newOrder = new Order({
      orderId: uniqueOrderId,
      cfOrderId: orderId,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      customerPhoto: orderData.customerPhoto || "",
      phone: orderData.phone || "",
      address: orderData.address || "",
      city: orderData.city || "",
      district: orderData.district || "",
      state: orderData.state || "",
      pincode: orderData.pincode || "",
      landmark: orderData.landmark || "",
      amount: orderData.amount, // in INR
      shippingCharge: orderData.shippingCharge || 0,
      status: "Processing", // Paid order starts as Processing
      paymentMethod: "Online Payment",
      paymentStatus: "Paid",
      items: populatedItems,
      date: new Date()
    });

    const savedOrder = await newOrder.save();

    // Update User order history
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

// Webhook handler for Cashfree payment status updates
exports.handleCashfreeWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = req.rawBody;

    if (!signature || !timestamp) {
      console.warn("[Cashfree Webhook] Missing signature or timestamp headers");
      return res.status(400).json({ message: "Missing verification headers" });
    }

    if (!rawBody) {
      console.warn("[Cashfree Webhook] Raw body not available for signature verification");
      return res.status(400).json({ message: "Raw body is required for verification" });
    }

    // Verify signature using the production client secret
    const signedPayload = `${timestamp}${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(signedPayload)
      .digest("base64");

    if (signature !== expectedSignature) {
      console.error("[Cashfree Webhook] Invalid signature verification attempt");
      return res.status(401).json({ message: "Invalid webhook signature" });
    }

    // Parse the validated payload
    const payload = JSON.parse(rawBody);
    console.log("[Cashfree Webhook] Verified payload received:", JSON.stringify(payload));

    const { type, data } = payload;
    
    // We only handle payment success events
    if (type === "PAYMENT_SUCCESS_WEBHOOK") {
      const orderId = data.order?.order_id;
      const cfPaymentId = data.payment?.cf_payment_id;

      if (!orderId) {
        console.warn("[Cashfree Webhook] No order ID found in webhook payload");
        return res.status(400).json({ message: "Missing order ID in payload" });
      }

      console.log(`[Cashfree Webhook] Payment successful for Cashfree Order ID: ${orderId}, Payment ID: ${cfPaymentId}`);

      // Look up the order in MongoDB
      const order = await Order.findOne({ cfOrderId: orderId });

      if (order) {
        if (order.paymentStatus !== "Paid") {
          order.paymentStatus = "Paid";
          order.status = "Processing";
          await order.save();
          console.log(`[Cashfree Webhook] Order ${order.orderId} updated to Paid/Processing via Webhook`);

          // Emit socket event for real-time admin updates
          const io = req.app.get("io");
          if (io) {
            io.emit("order_changed", { action: "update", data: order });
          }
        } else {
          console.log(`[Cashfree Webhook] Order ${order.orderId} is already marked as Paid`);
        }
      } else {
        console.warn(`[Cashfree Webhook] Order with cfOrderId ${orderId} not found in database. The frontend might not have saved it yet.`);
      }
    }

    res.status(200).json({ success: true, message: "Webhook processed successfully" });
  } catch (err) {
    console.error("[Cashfree Webhook] Error processing webhook:", err);
    res.status(500).json({ message: err.message || "Failed to process webhook" });
  }
};
