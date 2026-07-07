const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary if credentials are provided
const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log("Cloudinary configured successfully.");
} else {
  console.warn("Cloudinary credentials not found in .env. Falling back to local storage uploads.");
}

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // If Cloudinary is configured, upload to Cloudinary
    if (isCloudinaryConfigured) {
      // Create a promise to handle the stream upload
      const uploadToCloudinary = () => {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: "menswear",
              resource_type: "auto",
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          uploadStream.end(req.file.buffer);
        });
      };

      const result = await uploadToCloudinary();
      return res.status(200).json({
        message: "Image uploaded successfully to Cloudinary",
        url: result.secure_url,
      });
    } else {
      // Fallback: Save file locally in backend/uploads
      const uploadsDir = path.join(__dirname, "../uploads");
      
      // Ensure the uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate a unique filename
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(req.file.originalname) || ".jpg";
      const filename = `img-${uniqueSuffix}${ext}`;
      const filePath = path.join(uploadsDir, filename);

      // Write the buffer to the file
      await fs.promises.writeFile(filePath, req.file.buffer);

      // Return local URL (assumes server runs on port 5000)
      const localUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
      
      return res.status(200).json({
        message: "Image uploaded successfully to local storage (Cloudinary fallback)",
        url: localUrl,
      });
    }
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Failed to upload image", error: err.message });
  }
};
