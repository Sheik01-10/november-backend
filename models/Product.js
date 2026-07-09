const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
    },

    comparePrice: {
      type: Number,
      default: 0,
    },

    pct: {
      type: String,
      default: "",
    },

    front: {
      type: String,
      default: "",
    },

    back: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    isBestseller: {
      type: Boolean,
      default: false,
    },

    inStock: {
      type: Boolean,
      default: true,
    },

    sizes: {
      type: [String],
      default: [],
    },

    stockQuantity: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

productSchema.pre("save", async function () {
  if (this.comparePrice && this.comparePrice > this.price) {
    const discount = Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
    this.pct = `-${discount}%`;
  } else {
    this.pct = "";
  }
});

module.exports = mongoose.model("Product", productSchema);
