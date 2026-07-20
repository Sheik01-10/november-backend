const Settings = require("../models/Settings");

// Get settings
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      // Create defaults if not found
      settings = new Settings({});
      await settings.save();
    }
    
    // Auto-migration to ₹999 free shipping threshold
    let needsSave = false;
    if (settings.freeShippingThreshold !== 999) {
      settings.freeShippingThreshold = 999;
      needsSave = true;
    }
    if (settings.announcementBarText === "FREE SHIPPING ON ORDERS OVER ₹5,000") {
      settings.announcementBarText = "FREE SHIPPING ON ORDERS OVER ₹999";
      needsSave = true;
    }
    if (settings.announcements && settings.announcements.length > 0) {
      settings.announcements = settings.announcements.map(ann => {
        if (ann.text === "FREE SHIPPING ON ORDERS OVER ₹5,000") {
          needsSave = true;
          return { text: "FREE SHIPPING ON ORDERS OVER ₹999", active: ann.active };
        }
        return ann;
      });
    } else {
      settings.announcements = [
        { text: "FREE SHIPPING ON ORDERS OVER ₹999", active: true },
        { text: "Free returns within 7 days", active: true },
        { text: "Premium Luxury Menswear Collection", active: true },
        { text: "Flat 20% Off On New Arrivals", active: true }
      ];
      needsSave = true;
    }
    
    if (needsSave) {
      await settings.save();
      console.log("Migrated database settings freeShippingThreshold to 999 in settingsController");
    }

    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update settings
exports.updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    const updatedSettings = await settings.save();

    // Emit socket event if settings are updated
    const io = req.app.get("io");
    if (io) {
      io.emit("settings_changed", updatedSettings);
    }

    res.json(updatedSettings);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
