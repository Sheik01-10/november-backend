const mongoose = require("mongoose");

const staffLoginActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    loginAt: {
      type: Date,
      default: Date.now
    },
    logoutAt: {
      type: Date
    },
    status: {
      type: String,
      enum: ["online", "offline"],
      default: "online"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("StaffLoginActivity", staffLoginActivitySchema);
