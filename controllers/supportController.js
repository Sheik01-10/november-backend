const SupportMessage = require("../models/SupportMessage");

// Create support message
exports.createMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newMessage = new SupportMessage({
      name,
      email,
      subject,
      message
    });

    const savedMessage = await newMessage.save();

    // Emit socket event if config exists
    const io = req.app.get("io");
    if (io) {
      io.emit("support_message", { action: "create", data: savedMessage });
    }

    res.status(201).json(savedMessage);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get all support messages
exports.getMessages = async (req, res) => {
  try {
    const messages = await SupportMessage.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mark support message as Read
exports.markAsRead = async (req, res) => {
  try {
    const message = await SupportMessage.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    message.status = "Read";
    const updatedMessage = await message.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("support_message", { action: "update", data: updatedMessage });
    }

    res.json(updatedMessage);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete support message
exports.deleteMessage = async (req, res) => {
  try {
    const message = await SupportMessage.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    await message.deleteOne();

    const io = req.app.get("io");
    if (io) {
      io.emit("support_message", { action: "delete", data: { _id: req.params.id } });
    }

    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
