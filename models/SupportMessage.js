const mongoose = require("mongoose");

const supportMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["Unread", "Read"],
      default: "Unread"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupportMessage", supportMessageSchema);
