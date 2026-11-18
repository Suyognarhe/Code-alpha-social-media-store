const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "store-data.json");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret-before-publishing",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

const sampleProducts = [
  {
    id: 1,
    name: "Everyday Backpack",
    description: "A durable backpack for work, travel, and daily use.",
    price: 49.99,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800"
  },
  {
    id: 2,
    name: "Classic Watch",
    description: "A clean, comfortable watch with a timeless design.",
    price: 89,
    image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800"
  },
  {
    id: 3,
    name: "Wireless Headphones",
    description: "Comfortable wireless headphones for music and calls.",
    price: 64.5,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"
  },
  {
    id: 4,
    name: "Ceramic Mug",
    description: "A simple ceramic mug for your morning coffee or tea.",
    price: 15,
    image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800"
  }
];

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function loadData() {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      users: Array.isArray(saved.users) ? saved.users : [],
      products: Array.isArray(saved.products) ? saved.products : sampleProducts,
      orders: Array.isArray(saved.orders) ? saved.orders : [],
      nextUserId: saved.nextUserId || 1,
      nextOrderId: saved.nextOrderId || 1
    };
  } catch {
    const initialData = {
      users: [],
      products: sampleProducts,
      orders: [],
      nextUserId: 1,
      nextOrderId: 1
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
}

const data = loadData();

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Please log in first." });
  }
  next();
}

// List products
app.get("/api/products", (req, res) => {
  res.json(data.products);
});

// Product details
app.get("/api/products/:id", (req, res) => {
  const product = data.products.find((item) => item.id === Number(req.params.id));

  if (!product) {
    return res.status(404).json({ error: "Product not found." });
  }

  res.json(product);
});

// Register
app.post("/api/register", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  if (data.users.some((user) => user.email === email)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const user = {
    id: data.nextUserId++,
    name,
    email,
    passwordHash: await bcrypt.hash(password, 12)
  };

  data.users.push(user);
  saveData();

  req.session.user = { id: user.id, name: user.name, email: user.email };
  res.status(201).json({ user: req.session.user });
});

// Login
app.post("/api/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = data.users.find((item) => item.email === email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  req.session.user = { id: user.id, name: user.name, email: user.email };
  res.json({ user: req.session.user });
});

// Current user
app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

// Logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out." });
  });
});

// Place order
app.post("/api/orders", requireLogin, (req, res) => {
  const items = req.body.items;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Your cart is empty." });
  }

  const orderItems = [];

  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    const product = data.products.find((p) => p.id === productId);

    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ error: "A cart item is invalid or unavailable." });
    }

    orderItems.push({
      productId,
      name: product.name,
      quantity,
      price: product.price
    });
  }

  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = {
    id: data.nextOrderId++,
    userId: req.session.user.id,
    items: orderItems,
    total: Number(total.toFixed(2)),
    createdAt: new Date().toISOString()
  };

  data.orders.push(order);
  saveData();

  res.status(201).json({ orderId: order.id, total: order.total });
});

// Orders for the logged-in user
app.get("/api/orders", requireLogin, (req, res) => {
  const userOrders = data.orders.filter((order) => order.userId === req.session.user.id);
  res.json(userOrders);
});

app.listen(PORT, () => {
  console.log(`Store is running at http://localhost:${PORT}`);
});