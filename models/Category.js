const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true
    },
    img: {
      type: String,
      required: true,
      trim: true
    },
    href: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
