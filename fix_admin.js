require("dotenv").config();
const mongoose = require("mongoose");

const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/november";

async function run() {
  try {
    console.log("Connecting to MongoDB at:", mongoUri);
    // Explicitly disable retryWrites if it's set to true and causes issues
    let cleanUri = mongoUri;
    if (!cleanUri.includes("retryWrites=")) {
      const separator = cleanUri.includes("?") ? "&" : "?";
      cleanUri = `${cleanUri}${separator}retryWrites=false`;
    }
    
    await mongoose.connect(cleanUri);
    console.log("Mongoose connected.");

    const db = mongoose.connection.db;
    const usersCol = db.collection("users");
    const accountsCol = db.collection("accounts");

    const email = "admin@thenovember.in";
    const adminUser = await usersCol.findOne({ email: email.toLowerCase() });

    if (adminUser) {
      console.log("Found admin user in users collection:", adminUser);
      // Better Auth ids can be strings or ObjectIds. Check both.
      const account = await accountsCol.findOne({ 
        $or: [
          { userId: adminUser._id },
          { userId: adminUser._id.toString() },
          { userId: adminUser.id },
          { userId: adminUser.uid }
        ]
      });

      if (!account) {
        console.log("Admin user has NO entry in accounts collection! Deleting mismatched record to trigger proper seeding...");
        await usersCol.deleteOne({ _id: adminUser._id });
        console.log("Deleted mismatched admin user from users collection.");
      } else {
        console.log("Admin user already has a valid account entry:", account);
      }
    } else {
      console.log("No admin user found in users collection.");
    }

    // Now initialize Better Auth and seed correctly
    const { getAuthInstance } = require("./config/auth");
    const auth = getAuthInstance();

    // Check again if it was deleted
    const finalAdmin = await usersCol.findOne({ email: email.toLowerCase() });
    if (!finalAdmin) {
      console.log("Creating default admin account via Better Auth...");
      const signUpResult = await auth.api.signUpEmail({
        body: {
          email,
          password: "November@123",
          name: "Admin November"
        }
      });
      console.log("Sign up result:", signUpResult);
      
      await usersCol.updateOne(
        { _id: signUpResult.user.id },
        { $set: { role: "admin", isAdmin: true } }
      );
      console.log("Admin user created and role set successfully!");
    } else {
      console.log("Admin user already exists with account credentials.");
      await usersCol.updateOne(
        { _id: finalAdmin._id },
        { $set: { role: "admin", isAdmin: true } }
      );
      console.log("Ensured admin role and status is correct.");
    }

    console.log("Database repair complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error repairing admin user:", err);
    process.exit(1);
  }
}

run();
