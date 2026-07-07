const Banner = require("../models/Banner");

// Get all banners
exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.find();
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create banner
exports.createBanner = async (req, res) => {
  try {
    const banner = new Banner(req.body);
    const newBanner = await banner.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("banner_changed", { action: "create", data: newBanner });
    }

    res.status(201).json(newBanner);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update banner
exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    Object.assign(banner, req.body);
    const updatedBanner = await banner.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("banner_changed", { action: "update", data: updatedBanner });
    }

    res.json(updatedBanner);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete banner
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    await banner.deleteOne();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("banner_changed", { action: "delete", data: { _id: req.params.id } });
    }

    res.json({ message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
