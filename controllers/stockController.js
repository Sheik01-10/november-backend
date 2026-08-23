const Product = require("../models/Product");
const Order = require("../models/Order");
const StockMovement = require("../models/StockMovement");
const Settings = require("../models/Settings");
const { recalculateStock, recalculateAllStock } = require("../utils/stockHelper");

// 1. Get stock summary metrics
exports.getStockSummary = async (req, res) => {
  try {
    const products = await Product.find({});
    
    let totalStock = 0; // initialStock + stockAdded
    let stockAdded = 0; // stockAdded
    let availableBalance = 0; // stockQuantity
    let totalStockValue = 0; // sum of price * stockQuantity
    
    // Get low-stock threshold
    const settings = await Settings.findOne() || { lowStockThreshold: 5 };
    const threshold = settings.lowStockThreshold || 5;
    
    let lowStockCount = 0;
    let outOfStockCount = 0;
    
    for (const prod of products) {
      let initial = 0;
      let added = 0;
      
      if (prod.sizesStock && prod.sizesStock.length > 0) {
        initial = prod.sizesStock.reduce((acc, curr) => acc + (curr.initial || 0), 0);
        added = prod.sizesStock.reduce((acc, curr) => acc + (curr.added || 0), 0);
      } else {
        initial = prod.initialStock || 0;
        added = prod.stockAdded || 0;
      }
      
      totalStock += (initial + added);
      stockAdded += added;
      
      const balance = prod.stockQuantity || 0;
      availableBalance += balance;
      
      totalStockValue += (prod.price * balance);
      
      if (balance === 0) {
        outOfStockCount++;
      } else if (balance <= threshold) {
        lowStockCount++;
      }
    }
    
    // Calculate total sold dynamically from active orders matching active products
    const productNames = products.map(p => p.name);
    const orders = await Order.find({ status: { $ne: "Cancelled" }, "items.name": { $in: productNames } });
    let totalSold = 0;
    for (const order of orders) {
      for (const item of order.items) {
        if (productNames.includes(item.name)) {
          totalSold += item.quantity;
        }
      }
    }
    
    res.json({
      totalStock,
      stockAdded,
      totalSold,
      availableBalance,
      lowStockCount,
      outOfStockCount,
      totalStockValue
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 2. Get list of products with stock details
exports.getStockProducts = async (req, res) => {
  try {
    const { search, category, status, sortBy, order, page = 1, limit = 10 } = req.query;
    
    // Build query filter
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } }
      ];
    }
    
    if (category && category !== "all") {
      filter.category = category.toLowerCase();
    }
    
    const settings = await Settings.findOne() || { lowStockThreshold: 5 };
    const threshold = settings.lowStockThreshold || 5;
    
    if (status) {
      if (status === "low_stock") {
        filter.stockQuantity = { $gt: 0, $lte: threshold };
      } else if (status === "out_of_stock") {
        filter.stockQuantity = 0;
      } else if (status === "in_stock") {
        filter.stockQuantity = { $gt: threshold };
      }
    }
    
    // Determine sort options
    let sortOptions = { name: 1 }; // default
    
    if (sortBy) {
      const sortOrder = order === "desc" ? -1 : 1;
      if (sortBy === "stockQuantity" || sortBy === "balanceStock") {
        sortOptions = { stockQuantity: sortOrder };
      } else if (sortBy === "price") {
        sortOptions = { price: sortOrder };
      } else if (sortBy === "initialStock") {
        sortOptions = { initialStock: sortOrder };
      } else if (sortBy === "stockAdded") {
        sortOptions = { stockAdded: sortOrder };
      } else if (sortBy === "name") {
        sortOptions = { name: sortOrder };
      }
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const productsCount = await Product.countDocuments(filter);
    
    // Find products
    const products = await Product.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Fetch sold counts for all these products from orders
    const productNames = products.map(p => p.name);
    const activeOrders = await Order.find({
      status: { $ne: "Cancelled" },
      "items.name": { $in: productNames }
    });
    
    const soldCounts = {};
    for (const ord of activeOrders) {
      for (const item of ord.items) {
        soldCounts[item.name] = (soldCounts[item.name] || 0) + item.quantity;
      }
    }
    
    let productsWithSold = products.map(prod => {
      const prodJson = prod.toJSON();
      
      if (prod.sizesStock && prod.sizesStock.length > 0) {
        prodJson.initialStock = prod.sizesStock.reduce((acc, curr) => acc + (curr.initial || 0), 0);
        prodJson.stockAdded = prod.sizesStock.reduce((acc, curr) => acc + (curr.added || 0), 0);
      }
      
      prodJson.totalSold = soldCounts[prod.name] || 0;
      prodJson.stockStatus = prodJson.stockQuantity === 0 
        ? "Out of Stock" 
        : prodJson.stockQuantity <= threshold 
          ? "Low Stock" 
          : "In Stock";
      prodJson.stockValue = prodJson.price * prodJson.stockQuantity;
      return prodJson;
    });
    
    // Handle "sortBy === sales" (Total Sold sorting)
    if (sortBy === "sales") {
      const sortOrder = order === "desc" ? -1 : 1;
      productsWithSold.sort((a, b) => (a.totalSold - b.totalSold) * sortOrder);
    }
    
    res.json({
      products: productsWithSold,
      totalProducts: productsCount,
      totalPages: Math.ceil(productsCount / parseInt(limit)),
      currentPage: parseInt(page),
      lowStockThreshold: threshold
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 3. Adjust/Add Stock manually
exports.adjustStock = async (req, res) => {
  try {
    const { productId, size, quantity, type, reason, updatedBy } = req.body;
    
    if (!productId || quantity === undefined) {
      return res.status(400).json({ message: "Product ID and Quantity are required" });
    }
    
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    
    const adjustmentQty = Number(quantity);
    const prevStock = product.stockQuantity || 0;
    
    // Update sizesStock or overall stock
    if (product.sizes && product.sizes.length > 0 && size) {
      // Find or create size entry in sizesStock
      let sizeEntry = product.sizesStock.find(s => s.size === size);
      if (!sizeEntry) {
        product.sizesStock.push({
          size: size,
          initial: 0,
          added: adjustmentQty,
          balance: adjustmentQty
        });
      } else {
        sizeEntry.added = (sizeEntry.added || 0) + adjustmentQty;
        sizeEntry.balance = Math.max(0, (sizeEntry.balance || 0) + adjustmentQty);
      }
    } else {
      product.stockAdded = (product.stockAdded || 0) + adjustmentQty;
    }
    
    await product.save();
    
    // Log Stock Movement
    const movement = await StockMovement.create({
      productId: product._id,
      productName: product.name,
      sku: product.sku || "",
      type: type || "Stock Added",
      quantity: Math.abs(adjustmentQty),
      size: size || "",
      previousStock: prevStock,
      updatedStock: Math.max(0, prevStock + adjustmentQty),
      reason: reason || "Manual Stock Adjustment",
      updatedBy: updatedBy || "Admin"
    });
    
    // Recalculate stock
    const recalculated = await recalculateStock(product._id);
    
    // Emit socket events
    const io = req.app.get("io");
    if (io) {
      io.emit("product_changed", { action: "update", data: recalculated.product });
      io.emit("stock_changed", { action: "adjust", data: movement });
    }
    
    res.json({
      success: true,
      message: "Stock adjusted successfully",
      product: recalculated.product,
      movement
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// 4. Get stock movement history
exports.getStockMovements = async (req, res) => {
  try {
    const { search, type, page = 1, limit = 10 } = req.query;
    const filter = {};
    
    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } }
      ];
    }
    
    if (type && type !== "all") {
      filter.type = type;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const movementsCount = await StockMovement.countDocuments(filter);
    const movements = await StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    res.json({
      movements,
      totalMovements: movementsCount,
      totalPages: Math.ceil(movementsCount / parseInt(limit)),
      currentPage: parseInt(page)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 5. Bulk refresh stock data
exports.refreshStockData = async (req, res) => {
  try {
    await recalculateAllStock();
    res.json({ success: true, message: "Inventory data successfully refreshed and re-synchronized." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 6. Delete stock movement log and recalculate product stock
exports.deleteStockMovement = async (req, res) => {
  try {
    const { id } = req.params;
    const movement = await StockMovement.findById(id);
    if (!movement) {
      return res.status(404).json({ message: "Stock movement not found" });
    }
    
    const productId = movement.productId;
    await movement.deleteOne();
    
    let recalculated = null;
    if (productId) {
      const Product = require("../models/Product");
      const product = await Product.findById(productId);
      if (product) {
        recalculated = await recalculateStock(productId);
      }
    }
    
    // Emit socket events
    const io = req.app.get("io");
    if (io) {
      if (recalculated) {
        io.emit("product_changed", { action: "update", data: recalculated.product });
      }
      io.emit("stock_changed", { action: "delete", data: { _id: id } });
    }
    
    res.json({
      success: true,
      message: "Stock movement log deleted and inventory recalculated.",
      product: recalculated ? recalculated.product : null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
