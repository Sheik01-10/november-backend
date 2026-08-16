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

    const Product = require("../models/Product");
    const populatedItems = [];
    if (req.body.items && Array.isArray(req.body.items)) {
      for (const item of req.body.items) {
        const prod = await Product.findOne({ name: item.name });
        populatedItems.push({
          ...item,
          purchasePrice: prod ? (prod.purchasePrice || 0) : 0
        });

        // Verify stock for this item
        if (prod) {
          if (prod.sizesStock && prod.sizesStock.length > 0 && item.size) {
            const szStock = prod.sizesStock.find(s => s.size === item.size);
            const available = szStock ? szStock.balance : 0;
            if (available < item.quantity) {
              return res.status(400).json({ message: `Insufficient stock for ${item.name} (Size ${item.size}). Available: ${available}, Requested: ${item.quantity}` });
            }
          } else {
            if (prod.stockQuantity < item.quantity) {
              return res.status(400).json({ message: `Insufficient stock for ${item.name}. Available: ${prod.stockQuantity}, Requested: ${item.quantity}` });
            }
          }
        }
      }
    }

    const orderData = {
      ...req.body,
      items: populatedItems,
      orderId,
      date: new Date()
    };

    const order = new Order(orderData);
    const newOrder = await order.save();

    // Log stock movements and recalculate stock balances
    const StockMovement = require("../models/StockMovement");
    const { recalculateStock } = require("../utils/stockHelper");
    for (const item of newOrder.items) {
      const prod = await Product.findOne({ name: item.name });
      if (prod) {
        const previousStock = prod.stockQuantity || 0;
        await StockMovement.create({
          productId: prod._id,
          productName: prod.name,
          sku: prod.sku || "",
          type: "Stock Sold",
          quantity: item.quantity,
          size: item.size || "",
          previousStock: previousStock,
          updatedStock: Math.max(0, previousStock - item.quantity),
          reason: `Order placed: ${newOrder.orderId}`,
          updatedBy: "Customer",
          orderId: newOrder.orderId
        });
        await recalculateStock(prod._id);
      }
    }

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

    const oldStatus = order.status;
    const newStatus = req.body.status;

    if (req.body.status) order.status = req.body.status;
    if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;
    if (req.body.paymentMethod) order.paymentMethod = req.body.paymentMethod;
    if (req.body.cancellationReason !== undefined) order.cancellationReason = req.body.cancellationReason;
    const updatedOrder = await order.save();

    // Adjust stock when status changes to/from Cancelled
    if (newStatus && oldStatus !== newStatus) {
      const StockMovement = require("../models/StockMovement");
      const Product = require("../models/Product");
      const { recalculateStock } = require("../utils/stockHelper");

      if (newStatus === "Cancelled" && oldStatus !== "Cancelled") {
        // Restoring stock (subtracting from Total Sold)
        for (const item of updatedOrder.items) {
          const prod = await Product.findOne({ name: item.name });
          if (prod) {
            const previousStock = prod.stockQuantity || 0;
            await StockMovement.create({
              productId: prod._id,
              productName: prod.name,
              sku: prod.sku || "",
              type: "Stock Cancelled",
              quantity: item.quantity,
              size: item.size || "",
              previousStock: previousStock,
              updatedStock: previousStock + item.quantity,
              reason: `Order Cancelled: ${updatedOrder.orderId}`,
              updatedBy: req.body.updatedBy || "Admin/System",
              orderId: updatedOrder.orderId
            });
            await recalculateStock(prod._id);
          }
        }
      } else if (oldStatus === "Cancelled" && newStatus !== "Cancelled") {
        // Rededucting stock (adding back to Total Sold)
        for (const item of updatedOrder.items) {
          const prod = await Product.findOne({ name: item.name });
          if (prod) {
            const previousStock = prod.stockQuantity || 0;
            await StockMovement.create({
              productId: prod._id,
              productName: prod.name,
              sku: prod.sku || "",
              type: "Stock Sold",
              quantity: item.quantity,
              size: item.size || "",
              previousStock: previousStock,
              updatedStock: Math.max(0, previousStock - item.quantity),
              reason: `Order Restored: ${updatedOrder.orderId}`,
              updatedBy: req.body.updatedBy || "Admin/System",
              orderId: updatedOrder.orderId
            });
            await recalculateStock(prod._id);
          }
        }
      }
    }

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

    const items = order.items;
    const orderId = order.orderId;
    const status = order.status;

    await order.deleteOne();

    // Restore stock if the order was active (not Cancelled) when deleted
    if (status !== "Cancelled") {
      const StockMovement = require("../models/StockMovement");
      const Product = require("../models/Product");
      const { recalculateStock } = require("../utils/stockHelper");

      for (const item of items) {
        const prod = await Product.findOne({ name: item.name });
        if (prod) {
          const previousStock = prod.stockQuantity || 0;
          await StockMovement.create({
            productId: prod._id,
            productName: prod.name,
            sku: prod.sku || "",
            type: "Stock Cancelled",
            quantity: item.quantity,
            size: item.size || "",
            previousStock: previousStock,
            updatedStock: previousStock + item.quantity,
            reason: `Order Deleted: ${orderId}`,
            updatedBy: "Admin/System",
            orderId: orderId
          });
          await recalculateStock(prod._id);
        }
      }
    }

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

