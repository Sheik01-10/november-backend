const Wishlist = require("../models/Wishlist");

// Get wishlist for a user
exports.getWishlist = async (req, res) => {
  try {
    const { userId } = req.params;
    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.json([]);
    }
    res.json(wishlist.products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add product to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { userId } = req.params;
    const product = req.body; // Expect product object

    let wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId, products: [product] });
    } else {
      // Check if product is already in the list
      const exists = wishlist.products.some(p => p.id === product.id);
      if (!exists) {
        wishlist.products.push(product);
      }
    }

    await wishlist.save();
    res.status(201).json(wishlist.products);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Remove product from wishlist
exports.removeFromWishlist = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    let wishlist = await Wishlist.findOne({ userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(p => p.id !== productId);
      await wishlist.save();
    }
    res.json(wishlist ? wishlist.products : []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
