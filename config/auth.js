const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");
const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");

let authInstance = null;
let betterAuthClient = null;

const getAuthInstance = () => {
  if (!authInstance) {
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("Mongoose is not connected to MongoDB yet. Cannot initialize Better Auth.");
    }

    let mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/november";
    if (!mongoUri.includes("retryWrites=")) {
      const separator = mongoUri.includes("?") ? "&" : "?";
      mongoUri = `${mongoUri}${separator}retryWrites=false`;
    }

    // Initialize dedicated MongoClient with retryWrites=false explicitly defined
    if (!betterAuthClient) {
      betterAuthClient = new MongoClient(mongoUri);
      betterAuthClient.connect().catch(err => {
        console.error("Better Auth MongoClient failed to connect:", err);
      });
    }

    const dbName = db.databaseName;
    const betterAuthDb = betterAuthClient.db(dbName);

    authInstance = betterAuth({
      database: mongodbAdapter(betterAuthDb, {
        client: betterAuthClient,
        usePlural: true
      }),
      socialProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }
      },
      trustedOrigins: [
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://10.143.118.163:*",
        "https://novemberxix.duckdns.org",
        "https://thenovember.in",
        "http://thenovember.in"
      ]
    });
  }
  return authInstance;
};

module.exports = { getAuthInstance };
