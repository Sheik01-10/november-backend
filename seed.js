require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");
const Category = require("./models/Category");
const Banner = require("./models/Banner");
const Settings = require("./models/Settings");

const categoriesData = [
  {
    label: "New Arrival",
    img: "https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=400&q=75",
    href: "/products"
  },
  {
    label: "Shirts",
    img: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400&q=75",
    href: "/products?category=shirts"
  },
  {
    label: "Pants",
    img: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=75",
    href: "/products?category=trousers"
  },
  {
    label: "T-Shirts",
    img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=75",
    href: "/products?category=tshirts"
  },
  {
    label: "Work Mode",
    img: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=400&q=75",
    href: "/work-mode"
  },
  {
    label: "Quiet Luxury",
    img: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=400&q=75",
    href: "/quiet-luxury"
  }
];

const productsData = [
  {
    name: "Classic Black Shirt",
    category: "shirts",
    price: 1280,
    comparePrice: 1506,
    pct: "-15%",
    front: "https://images.unsplash.com/photo-1603252109303-2751441dd157?w=1200",
    back: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=1200",
    inStock: true,
    isBestseller: true,
    description: "Premium black luxury shirts crafted for elegance.",
    sizes: ["S", "M", "L", "XL"],
    stockQuantity: 15
  },
  {
    name: "Premium White Shirt",
    category: "shirts",
    price: 1450,
    comparePrice: 1780,
    pct: "-18%",
    front: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=1200",
    back: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=1200",
    inStock: true,
    isBestseller: true,
    description: "Crisp premium cotton white shirt.",
    sizes: ["S", "M", "L", "XL"],
    stockQuantity: 3
  },
  {
    name: "Luxury Navy Trouser",
    category: "trousers",
    price: 1680,
    comparePrice: 1950,
    pct: "-14%",
    front: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=1200",
    back: "https://images.unsplash.com/photo-1506629905607-d9c297d6d5f4?w=1200",
    inStock: true,
    isBestseller: true,
    description: "Luxury wool blend navy trouser.",
    sizes: ["S", "M", "L", "XL"],
    stockQuantity: 8
  },
  {
    name: "Premium Polo T-Shirt",
    category: "tshirts",
    price: 980,
    comparePrice: 1250,
    pct: "-12%",
    front: "https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=1200",
    back: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200",
    inStock: true,
    isBestseller: true,
    description: "Comfortable polo t-shirt with classic collar.",
    sizes: ["M", "L", "XL"],
    stockQuantity: 20
  },
  {
    name: "Luxury Overshirt",
    category: "shirts",
    price: 1720,
    comparePrice: 2050,
    pct: "-20%",
    front: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200",
    back: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1200",
    inStock: true,
    isBestseller: true,
    description: "Textured overshirt perfect for layering.",
    sizes: ["S", "M", "L", "XL"],
    stockQuantity: 12
  },
  {
    name: "Classic Trouser",
    category: "trousers",
    price: 1350,
    comparePrice: 1590,
    pct: "-10%",
    front: "https://images.unsplash.com/photo-1514996937319-344454492b37?w=1200",
    back: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200",
    inStock: true,
    isBestseller: true,
    description: "Timeless formal black trouser.",
    sizes: ["S", "M", "L", "XL"],
    stockQuantity: 5
  },
  {
    name: "Premium Beige Chino",
    category: "trousers",
    price: 1480,
    comparePrice: 1850,
    pct: "-20%",
    front: "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=1200",
    back: "https://images.unsplash.com/photo-1584865288642-42078afe6942?w=1200",
    inStock: true,
    isBestseller: false,
    description: "Slim fit stretch beige chinos for casual and semi-formal wear.",
    sizes: ["M", "L", "XL"],
    stockQuantity: 10
  },
  {
    name: "Charcoal Wool Trouser",
    category: "trousers",
    price: 1850,
    comparePrice: 2200,
    pct: "-15%",
    front: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=1200",
    back: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200",
    inStock: true,
    isBestseller: false,
    description: "Refined charcoal grey wool blend trousers for a classic smart look.",
    sizes: ["S", "M", "L", "XL"],
    stockQuantity: 6
  },
  {
    name: "Tailored Oxford Shirt",
    category: "work-mode",
    price: 1580,
    comparePrice: 1850,
    pct: "-15%",
    front: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1200",
    back: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=1200",
    inStock: true,
    isBestseller: false,
    description: "Premium tailored Oxford formal shirt, crafted from superior cotton weave for durability and style.",
    sizes: ["S", "M", "L", "XL"],
    stockQuantity: 14
  },
  {
    name: "Classic Charcoal Blazer Shirt",
    category: "work-mode",
    price: 1850,
    comparePrice: 2200,
    pct: "-16%",
    front: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?w=1200",
    back: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=1200",
    inStock: true,
    isBestseller: true,
    description: "Elegant structured shirt in deep charcoal hue, perfect for boardroom meetings.",
    sizes: ["M", "L", "XL"],
    stockQuantity: 9
  },
  {
    name: "Executive Stripe Cotton Shirt",
    category: "work-mode",
    price: 1680,
    comparePrice: 1980,
    pct: "-15%",
    front: "https://images.unsplash.com/photo-1603252109303-2751441dd157?w=1200",
    back: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=1200",
    inStock: true,
    isBestseller: false,
    description: "Timeless pinstripe shirt made of premium Egyptian cotton with double cuffs.",
    sizes: ["S", "M", "L", "XL"],
    stockQuantity: 11
  },
  {
    name: "Bespoke Navy Formal Shirt",
    category: "work-mode",
    price: 1750,
    comparePrice: 2100,
    pct: "-17%",
    front: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200",
    back: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=1200",
    inStock: true,
    isBestseller: true,
    description: "Rich dark navy formal shirt designed with a sharp spread collar for executive styling.",
    sizes: ["S", "M", "L", "XL"],
    stockQuantity: 4
  },
  {
    name: "Luxe Cashmere Knit Polo",
    category: "quiet-luxury",
    price: 2450,
    comparePrice: 2950,
    pct: "-17%",
    front: "https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=1200",
    back: "https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=1200",
    inStock: false,
    isBestseller: true,
    description: "Ultra-soft cashmere blend knit polo in a neutral taupe hue. The epitome of understated elegance.",
    sizes: ["S", "M", "L"],
    stockQuantity: 0
  },
  {
    name: "Premium Linen Summer Shirt",
    category: "quiet-luxury",
    price: 1850,
    comparePrice: 2100,
    pct: "-12%",
    front: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=1200",
    back: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200",
    inStock: true,
    isBestseller: false,
    description: "Flowy, breathable premium linen shirt in an off-white color, styled for luxury resort wear.",
    sizes: ["M", "L", "XL"],
    stockQuantity: 7
  },
  {
    name: "Minimalist Silk-Blend Tee",
    category: "quiet-luxury",
    price: 1450,
    comparePrice: 1750,
    pct: "-17%",
    front: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200",
    back: "https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=1200",
    inStock: true,
    isBestseller: true,
    description: "A luxury basic, knit from a premium organic cotton and silk blend for a sleek fit.",
    sizes: ["S", "M", "L"],
    stockQuantity: 18
  },
  {
    name: "Signature Sand Chino Shirt",
    category: "quiet-luxury",
    price: 1980,
    comparePrice: 2400,
    pct: "-18%",
    front: "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=1200",
    back: "https://images.unsplash.com/photo-1584865288642-42078afe6942?w=1200",
    inStock: true,
    isBestseller: false,
    description: "Brushed cotton utility overshirt in sand tone, featuring minimal visible hardware.",
    sizes: ["S", "M", "L", "XL"],
    stockQuantity: 13
  }
];

const bannersData = [
  {
    title: "Luxury Winter Drops",
    subtitle: "FLAT 15% OFF",
    image: "https://images.unsplash.com/photo-1617137968427-85924c800a22?w=1200",
    link: "/products?category=shirts",
    isActive: true
  }
];

const settingsData = {
  storeName: "November Menswear",
  contactEmail: "contact@novemberxix.com",
  contactPhone: "+91 98765 43210",
  address: "12, Luxury Lane, Mumbai, India",
  announcementBarText: "FREE SHIPPING ON ORDERS OVER ₹5,000",
  announcementBarActive: true,
  announcements: [
    { text: "FREE SHIPPING ON ORDERS OVER ₹5,000", active: true },
    { text: "Free returns within 7 days", active: true },
    { text: "Premium Luxury Menswear Collection", active: true },
    { text: "Flat 20% Off On New Arrivals", active: true }
  ],
  freeShippingThreshold: 5000
};

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for Seeding...");

    // Clear existing data
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Banner.deleteMany({});
    await Settings.deleteMany({});

    console.log("Cleared existing store data.");

    // Insert categories
    await Category.insertMany(categoriesData);
    console.log("Categories seeded successfully.");

    // Insert products
    await Product.insertMany(productsData);
    console.log("Products seeded successfully.");

    // Insert banners
    await Banner.insertMany(bannersData);
    console.log("Banners seeded successfully.");

    // Insert settings
    const settings = new Settings(settingsData);
    await settings.save();
    console.log("Settings seeded successfully.");

    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
};

seedDB();
