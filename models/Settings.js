const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      default: "The November Menswear"
    },
    contactEmail: {
      type: String,
      default: "contact@novemberxix.com"
    },
    contactPhone: {
      type: String,
      default: "+91 98765 43210"
    },
    address: {
      type: String,
      default: "12, Luxury Lane, Mumbai, India"
    },
    announcementBarText: {
      type: String,
      default: "FREE SHIPPING ON ORDERS OVER ₹999"
    },
    announcementBarActive: {
      type: Boolean,
      default: true
    },
    announcements: {
      type: [
        {
          text: { type: String, required: true },
          active: { type: Boolean, default: true }
        }
      ],
      default: [
        { text: "FREE SHIPPING ON ORDERS OVER ₹999", active: true },
        { text: "Free returns within 7 days", active: true },
        { text: "Premium Luxury Menswear Collection", active: true },
        { text: "Flat 20% Off On New Arrivals", active: true }
      ]
    },
    freeShippingThreshold: {
      type: Number,
      default: 999
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Settings", settingsSchema);
