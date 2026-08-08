const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/november";
    if (!mongoUri.includes("retryWrites=")) {
      const separator = mongoUri.includes("?") ? "&" : "?";
      mongoUri = `${mongoUri}${separator}retryWrites=false`;
    }
    await mongoose.connect(mongoUri);

    console.log(
      "MongoDB Connected"
    );

    // Seed default admin user if it does not exist
    try {
      const User = require("../models/User");
      const adminEmail = "admin@thenovember.in";
      const adminPassword = "November@123";
      
      const adminUser = await User.findOne({ email: adminEmail });
      if (!adminUser) {
        console.log("Seeding default admin user...");
        const { getAuthInstance } = require("./auth");
        const auth = getAuthInstance();
        const signUpResult = await auth.api.signUpEmail({
          body: {
            email: adminEmail,
            password: adminPassword,
            name: "Admin November"
          }
        });
        
        const seeded = await User.findById(signUpResult.user.id);
        if (seeded) {
          seeded.role = "admin";
          seeded.isAdmin = true;
          await seeded.save();
        }
        console.log("Admin user seeded successfully!");
      } else {
        if (adminUser.role !== "admin" || !adminUser.isAdmin) {
          adminUser.role = "admin";
          adminUser.isAdmin = true;
          await adminUser.save();
          console.log("Updated admin user role to admin");
        }
      }
    } catch (seedErr) {
      console.error("Admin seeding failed:", seedErr.message);
    }

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