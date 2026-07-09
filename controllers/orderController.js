const Order = require("../models/Order");

// Get all orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create new order
exports.createOrder = async (req, res) => {
  try {
    const { customerEmail } = req.body;
    if (!customerEmail) {
      return res.status(401).json({ message: "Unauthorized. Email is required to place an order." });
    }

    const User = require("../models/User");
    const user = await User.findOne({ email: customerEmail.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Unauthorized. You must have a registered account to place an order." });
    }

    // Generate a unique order ID
    const count = await Order.countDocuments();
    const orderId = `ORD-${1000 + count + 1}`;

    const orderData = {
      ...req.body,
      orderId,
      date: new Date()
    };

    const order = new Order(orderData);
    const newOrder = await order.save();

    // Update User order history
    if (!user.orders) user.orders = [];
    user.orders.push(newOrder._id);
    await user.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("order_changed", { action: "create", data: newOrder });
    }

    res.status(201).json(newOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (req.body.status) order.status = req.body.status;
    if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;
    if (req.body.paymentMethod) order.paymentMethod = req.body.paymentMethod;
    const updatedOrder = await order.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("order_changed", { action: "update", data: updatedOrder });
    }

    res.json(updatedOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete order
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    await order.deleteOne();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("order_changed", { action: "delete", data: { _id: req.params.id } });
    }

    res.json({ message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get orders by user email
exports.getUserOrders = async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ message: "Email parameter is required" });
    }
    const orders = await Order.find({ customerEmail: email.toLowerCase() }).sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

