const mongoose = require("mongoose");

const pageVisitSchema = new mongoose.Schema({
  path: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const visitorSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    deviceId: {
      type: String,
      required: true,
      index: true
    },
    ip: {
      type: String,
      default: ""
    },
    userAgent: {
      type: String,
      default: ""
    },
    deviceType: {
      type: String,
      enum: ["Desktop", "Mobile", "Tablet"],
      default: "Desktop"
    },
    gender: {
      type: String,
      enum: ["Male", "Female"],
      default: "Male"
    },
    state: {
      type: String,
      default: "Other"
    },
    district: {
      type: String,
      default: "Other"
    },
    trafficSource: {
      type: String,
      enum: ["Direct", "Organic Search", "Social Media", "Referral"],
      default: "Direct"
    },
    pagesVisited: [pageVisitSchema],
    lastAction: {
      type: String,
      default: "Visited Website"
    },
    duration: {
      type: Number,
      default: 0 // Duration in seconds
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("VisitorSession", visitorSessionSchema);
