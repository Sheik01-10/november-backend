const User = require("../models/User");

// Get all users (Customers list)
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Sync/Save user from Firebase
exports.syncUser = async (req, res) => {
  try {
    const { uid, name, email, phone, photo, isAdmin } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ message: "Firebase UID and email are required" });
    }

    let user = await User.findOne({ uid });
    if (user) {
      // Update existing customer profile
      user.name = name || user.name;
      user.phone = phone || user.phone;
      user.photo = photo || user.photo;
      if (isAdmin !== undefined) user.isAdmin = isAdmin;
      const updatedUser = await user.save();

      // Emit socket event
      const io = req.app.get("io");
      if (io) {
        io.emit("user_changed", { action: "update", data: updatedUser });
      }

      return res.json(updatedUser);
    } else {
      // Create new customer profile
      user = new User({ uid, name, email, phone, photo, isAdmin: isAdmin || false });
      const newUser = await user.save();

      // Emit socket event
      const io = req.app.get("io");
      if (io) {
        io.emit("user_changed", { action: "create", data: newUser });
      }

      return res.status(201).json(newUser);
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.deleteOne();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("user_changed", { action: "delete", data: { _id: req.params.id } });
    }

    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Check if email already exists
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    res.json({ exists: !!user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get detailed user profile by Firebase UID
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update user profile fields (name, phone, photo)
exports.updateUserProfile = async (req, res) => {
  try {
    const { name, phone, photo } = req.body;
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (photo !== undefined) user.photo = photo;

    const updatedUser = await user.save();

    // Emit socket event if configured
    const io = req.app.get("io");
    if (io) {
      io.emit("user_changed", { action: "update", data: updatedUser });
    }

    res.json(updatedUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Add new address
exports.addUserAddress = async (req, res) => {
  try {
    const { name, phone, street, city, state, pincode, landmark, isDefault } = req.body;
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // If setting as default, unset existing default addresses
    if (isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    // If it's the first address, make it default automatically
    const makeDefault = user.addresses.length === 0 ? true : !!isDefault;

    user.addresses.push({
      name,
      phone,
      street,
      city,
      state,
      pincode,
      landmark,
      isDefault: makeDefault
    });

    const updatedUser = await user.save();
    res.status(201).json(updatedUser.addresses);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update existing address
exports.updateUserAddress = async (req, res) => {
  try {
    const { name, phone, street, city, state, pincode, landmark, isDefault } = req.body;
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    // If setting as default, unset other default addresses
    if (isDefault) {
      user.addresses.forEach((addr) => {
        if (addr._id.toString() !== req.params.addressId) {
          addr.isDefault = false;
        }
      });
    }

    if (name !== undefined) address.name = name;
    if (phone !== undefined) address.phone = phone;
    if (street !== undefined) address.street = street;
    if (city !== undefined) address.city = city;
    if (state !== undefined) address.state = state;
    if (pincode !== undefined) address.pincode = pincode;
    if (landmark !== undefined) address.landmark = landmark;
    if (isDefault !== undefined) address.isDefault = isDefault;

    const updatedUser = await user.save();
    res.json(updatedUser.addresses);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete address
exports.deleteUserAddress = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const address = user.addresses.id(req.params.addressId);
    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    const wasDefault = address.isDefault;
    user.addresses.pull(req.params.addressId);

    // If the deleted address was default and we still have other addresses, make the first one default
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    const updatedUser = await user.save();
    res.json(updatedUser.addresses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Set default address
exports.setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let addressFound = false;
    user.addresses.forEach((addr) => {
      if (addr._id.toString() === req.params.addressId) {
        addr.isDefault = true;
        addressFound = true;
      } else {
        addr.isDefault = false;
      }
    });

    if (!addressFound) {
      return res.status(404).json({ message: "Address not found" });
    }

    const updatedUser = await user.save();
    res.json(updatedUser.addresses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
