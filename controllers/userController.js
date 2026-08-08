const User = require("../models/User");
const mongoose = require("mongoose");

// Helper to find a user by Firebase UID or MongoDB ObjectId (Better Auth id)
const findUserByUidOrId = async (uid) => {
  const query = mongoose.isValidObjectId(uid)
    ? { $or: [{ _id: uid }, { uid: uid }] }
    : { uid: uid };
  return await User.findOne(query);
};

// Get all users (Customers list)
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Sync/Save user from Firebase / Better Auth
exports.syncUser = async (req, res) => {
  try {
    const { uid, name, email, phone, photo, isAdmin } = req.body;
    if (!uid || !email) {
      return res.status(400).json({ message: "UID and email are required" });
    }

    let user = await User.findOne({
      $or: [
        { uid: uid },
        { email: email.toLowerCase() },
        ...(mongoose.isValidObjectId(uid) ? [{ _id: uid }] : [])
      ]
    });

    if (user) {
      // Update existing customer profile
      user.uid = user.uid || uid;
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
      user = new User({ uid, name, email: email.toLowerCase(), phone, photo, isAdmin: isAdmin || false });
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

// Get detailed user profile by Firebase UID or Better Auth ID
exports.getUserProfile = async (req, res) => {
  try {
    const user = await findUserByUidOrId(req.params.uid);
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
    const user = await findUserByUidOrId(req.params.uid);
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
    const user = await findUserByUidOrId(req.params.uid);
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
    const user = await findUserByUidOrId(req.params.uid);
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
    const user = await findUserByUidOrId(req.params.uid);
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
    const user = await findUserByUidOrId(req.params.uid);
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

// Login success handler
exports.loginSuccess = async (req, res) => {
  try {
    const StaffLoginActivity = require("../models/StaffLoginActivity");
    const user = await User.findOne({ email: req.user.email.toLowerCase() });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "admin" && user.role !== "staff" && !user.isAdmin) {
      return res.status(403).json({ message: "Access Denied: Authorized Personnel Only" });
    }

    if (user.role === "staff" && !user.isActive) {
      return res.status(403).json({ message: "Access Denied: Account is deactivated" });
    }

    // Update login status and timestamps
    user.lastLoginAt = new Date();
    user.lastActiveAt = new Date();
    user.onlineStatus = "online";
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    // If staff, create a login activity record
    if (user.role === "staff") {
      const loginActivity = new StaffLoginActivity({
        userId: user._id,
        name: user.name,
        email: user.email,
        loginAt: new Date(),
        status: "online"
      });
      await loginActivity.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("staff_changed", { action: "login", userId: user._id });
    }

    res.json({
      success: true,
      role: user.role,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin
      }
    });
  } catch (err) {
    console.error("Login Success Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Logout success handler
exports.logoutSuccess = async (req, res) => {
  try {
    const StaffLoginActivity = require("../models/StaffLoginActivity");
    const user = await User.findOne({ email: req.user.email.toLowerCase() });

    if (user) {
      user.onlineStatus = "offline";
      user.lastLogoutAt = new Date();
      await user.save();

      if (user.role === "staff") {
        const latestActivity = await StaffLoginActivity.findOne({
          userId: user._id,
          status: "online"
        }).sort({ loginAt: -1 });

        if (latestActivity) {
          latestActivity.status = "offline";
          latestActivity.logoutAt = new Date();
          await latestActivity.save();
        }
      }

      const io = req.app.get("io");
      if (io) {
        io.emit("staff_changed", { action: "logout", userId: user._id });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Logout Success Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Get all staff users (Admin only)
exports.getStaff = async (req, res) => {
  try {
    const staffMembers = await User.find({ role: "staff" }).sort({ createdAt: -1 });
    res.json(staffMembers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create new staff account (Admin only)
exports.createStaff = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // Call Better Auth to create the user account
    const { getAuthInstance } = require("../config/auth");
    const auth = getAuthInstance();

    const signUpResult = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name
      }
    });

    if (!signUpResult || !signUpResult.user) {
      return res.status(400).json({ message: "Failed to create Better Auth credentials" });
    }

    // Update role to staff
    const user = await User.findById(signUpResult.user.id);
    if (!user) {
      return res.status(400).json({ message: "Failed to locate database record" });
    }

    user.role = "staff";
    user.isActive = true;
    await user.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("staff_changed", { action: "create", data: user });
    }

    res.status(201).json(user);
  } catch (err) {
    console.error("Create staff error:", err);
    res.status(400).json({ message: err.message });
  }
};

// Toggle staff active/inactive status (Admin only)
exports.toggleStaffStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "staff") {
      return res.status(404).json({ message: "Staff user not found" });
    }

    user.isActive = !user.isActive;
    // If deactivating, also force them offline
    if (!user.isActive) {
      user.onlineStatus = "offline";
      const StaffLoginActivity = require("../models/StaffLoginActivity");
      const latestActivity = await StaffLoginActivity.findOne({
        userId: user._id,
        status: "online"
      }).sort({ loginAt: -1 });

      if (latestActivity) {
        latestActivity.status = "offline";
        latestActivity.logoutAt = new Date();
        await latestActivity.save();
      }
    }
    
    await user.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("staff_changed", { action: "update", data: user });
    }

    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete staff user (Admin only)
exports.deleteStaff = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "staff") {
      return res.status(404).json({ message: "Staff user not found" });
    }

    await user.deleteOne();

    const io = req.app.get("io");
    if (io) {
      io.emit("staff_changed", { action: "delete", data: { _id: req.params.id } });
    }

    res.json({ message: "Staff account deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get login activity log (Admin only)
exports.getStaffActivity = async (req, res) => {
  try {
    const StaffLoginActivity = require("../models/StaffLoginActivity");
    const activity = await StaffLoginActivity.find().sort({ loginAt: -1 });
    res.json(activity);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
