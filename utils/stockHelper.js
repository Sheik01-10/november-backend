const Product = require("../models/Product");
const Order = require("../models/Order");
const StockMovement = require("../models/StockMovement");

/**
 * Recalculates the stock for a given product ID based on its initial stock,
 * stock addition movements, and sold quantities from orders.
 *
 * Balance Stock = Initial Stock + Stock Added - Total Sold
 *
 * @param {string} productId 
 */
const recalculateStock = async (productId) => {
  try {
    const product = await Product.findById(productId);
    if (!product) return null;

    // 1. Calculate Total Sold from orders (where status !== "Cancelled")
    const orders = await Order.find({
      status: { $ne: "Cancelled" },
      "items.name": product.name
    });

    let totalSold = 0;
    const sizeSoldMap = {};
    for (const order of orders) {
      for (const item of order.items) {
        if (item.name === product.name) {
          totalSold += item.quantity;
          const sz = item.size || "NO_SIZE";
          sizeSoldMap[sz] = (sizeSoldMap[sz] || 0) + item.quantity;
        }
      }
    }

    // 2. Calculate manual additions from StockMovement of types: "Stock Added", "Stock Adjustment", "Stock Returned"
    const movements = await StockMovement.find({
      productId: product._id,
      type: { $in: ["Stock Added", "Stock Adjustment", "Stock Returned"] }
    });

    let totalAdded = 0;
    const sizeAddedMap = {};
    for (const move of movements) {
      // Calculate delta to support both positive additions and negative reductions
      const delta = move.updatedStock - move.previousStock;
      totalAdded += delta;
      const sz = move.size || "NO_SIZE";
      sizeAddedMap[sz] = (sizeAddedMap[sz] || 0) + delta;
    }

    // Update product overall initial/added/sold
    const calculatedBalance = Math.max(0, product.initialStock + totalAdded - totalSold);

    // 3. Recalculate sizesStock
    if (product.sizesStock && product.sizesStock.length > 0) {
      product.sizesStock = product.sizesStock.map(ss => {
        const sz = ss.size;
        const szSold = sizeSoldMap[sz] || 0;
        const szAdded = sizeAddedMap[sz] || 0;
        const szBalance = Math.max(0, ss.initial + szAdded - szSold);
        return {
          size: ss.size,
          initial: ss.initial,
          added: szAdded,
          balance: szBalance
        };
      });

      // Overall balance is sum of size balances
      product.stockQuantity = product.sizesStock.reduce((acc, curr) => acc + (curr.balance || 0), 0);
      
      // Synchronize overall initialStock with the sum of size-wise initial stocks
      product.initialStock = product.sizesStock.reduce((acc, curr) => acc + (curr.initial || 0), 0);
    } else {
      product.stockQuantity = calculatedBalance;
    }

    product.inStock = product.stockQuantity > 0;
    product.stockAdded = totalAdded;
    await product.save();

    console.log(`[stockHelper] Recalculated stock for "${product.name}". Balance: ${product.stockQuantity}, In Stock: ${product.inStock}`);
    return {
      product,
      totalSold,
      totalAdded,
      balance: product.stockQuantity
    };
  } catch (err) {
    console.error(`[stockHelper] Error recalculating stock for product ${productId}:`, err);
    throw err;
  }
};

/**
 * Bulk recalculates stock for all products.
 */
const recalculateAllStock = async () => {
  try {
    const products = await Product.find({});
    console.log(`[stockHelper] Starting bulk stock recalculation for ${products.length} products...`);
    const results = [];
    for (const prod of products) {
      const res = await recalculateStock(prod._id);
      results.push(res);
    }
    console.log("[stockHelper] Bulk stock recalculation complete.");
    return results;
  } catch (err) {
    console.error("[stockHelper] Bulk stock recalculation failed:", err);
    throw err;
  }
};

module.exports = {
  recalculateStock,
  recalculateAllStock
};
