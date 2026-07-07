const mongoose = require("mongoose");

const wishlistProductSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: String,
      required: true
    },
    compare: {
      type: String,
      default: ""
    },
    pct: {
      type: String,
      default: ""
    },
    front: {
      type: String,
      required: true
    },
    back: {
      type: String,
      default: ""
    },
    category: {
      type: String,
      required: true
    }
  },
  { _id: false, id: false }
);

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    products: [wishlistProductSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Wishlist", wishlistSchema);
