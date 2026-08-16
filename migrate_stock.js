require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");
const Order = require("./models/Order");
const StockMovement = require("./models/StockMovement");
const { recalculateStock } = require("./utils/stockHelper");

const migrate = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/november";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for Stock Migration...");

    // Clear existing stock movements
    await StockMovement.deleteMany({});
    console.log("Cleared existing stock movements.");

    const products = await Product.find({});
    console.log(`Found ${products.length} products to migrate.`);

    for (const prod of products) {
      console.log(`Migrating "${prod.name}"...`);

      // 1. Generate SKU if missing
      if (!prod.sku) {
        const cleanName = prod.name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8).toUpperCase();
        prod.sku = `NOV-${cleanName}-${Math.floor(100 + Math.random() * 900)}`;
      }

      // Convert old stock quantity to baseline initialStock
      const totalStock = prod.stockQuantity || 0;
      
      prod.initialStock = totalStock;
      prod.stockAdded = 0;

      // 2. Setup sizesStock baseline
      if (prod.sizes && prod.sizes.length > 0) {
        const sizeCount = prod.sizes.length;
        const baseQty = Math.floor(totalStock / sizeCount);
        const remainder = totalStock % sizeCount;

        prod.sizesStock = prod.sizes.map((sz, idx) => {
          const szInitial = baseQty + (idx === 0 ? remainder : 0);
          return {
            size: sz,
            initial: szInitial,
            added: 0,
            balance: szInitial
          };
        });
      } else {
        prod.sizesStock = [];
      }

      await prod.save();
      // Recalculate based on active orders (subtracts sales from baseline)
      await recalculateStock(prod._id);
    }

    console.log("Stock migration complete! All products updated successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

migrate();
