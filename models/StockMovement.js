const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    sku: {
      type: String,
      default: ""
    },
    type: {
      type: String,
      enum: ["Stock Added", "Stock Sold", "Stock Adjustment", "Stock Returned", "Stock Cancelled"],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    size: {
      type: String,
      default: ""
    },
    previousStock: {
      type: Number,
      required: true
    },
    updatedStock: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      default: ""
    },
    updatedBy: {
      type: String,
      default: "System"
    },
    orderId: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("StockMovement", stockMovementSchema);
