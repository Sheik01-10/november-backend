const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Firebase UID is now optional and sparse to support Better Auth users natively
    uid: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      default: ""
    },
    photo: {
      type: String,
      default: ""
    },
    // Better Auth fields
    emailVerified: {
      type: Boolean,
      default: false
    },
    image: {
      type: String,
      default: ""
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order"
      }
    ],
    addresses: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        landmark: { type: String, default: "" },
        isDefault: { type: Boolean, default: false }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
