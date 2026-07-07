const Settings = require("../models/Settings");

// Get settings
exports.getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      // Create defaults if not found
      settings = new Settings({});
      await settings.save();
    } else if (!settings.announcements || settings.announcements.length === 0) {
      settings.announcements = [
        { text: "FREE SHIPPING ON ORDERS OVER ₹5,000", active: true },
        { text: "Free returns within 7 days", active: true },
        { text: "Premium Luxury Menswear Collection", active: true },
        { text: "Flat 20% Off On New Arrivals", active: true }
      ];
      await settings.save();
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
