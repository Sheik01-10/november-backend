const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      "MongoDB Connected"
    );

    // Auto-migration for free shipping threshold
    try {
      const Settings = require("../models/Settings");
      const settings = await Settings.findOne();
      if (settings && settings.freeShippingThreshold !== 999) {
        settings.freeShippingThreshold = 999;
        if (settings.announcementBarText === "FREE SHIPPING ON ORDERS OVER ₹5,000") {
          settings.announcementBarText = "FREE SHIPPING ON ORDERS OVER ₹999";
        }
        settings.announcements = settings.announcements.map(ann => {
          if (ann.text === "FREE SHIPPING ON ORDERS OVER ₹5,000") {
            return { text: "FREE SHIPPING ON ORDERS OVER ₹999", active: ann.active };
          }
          return ann;
        });
        await settings.save();
        console.log("Migrated database settings freeShippingThreshold to 999");
      }
    } catch (migrateErr) {
      console.warn("Settings auto-migration skipped/failed:", migrateErr.message);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

module.exports = connectDB;