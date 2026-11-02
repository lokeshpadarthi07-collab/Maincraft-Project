import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import Product from "./models/Product.js";
import { initialProducts } from "./seedData.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TASKS_FILE = path.resolve(__dirname, "../backend/tasks.json");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Task Mongoose Model (Task 2 support)
const taskSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Task text is required"],
      trim: true,
    },
  },
  { timestamps: true }
);
const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

const readStoredTasks = () => {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
};

const writeStoredTasks = (tasks) => {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
  } catch {
    // ignore
  }
};

// In-memory fallback cache in case MongoDB is temporarily offline
let fallbackProducts = initialProducts.map((p, idx) => ({
  ...p,
  _id: `mock-id-${idx + 1}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

let isMongoConnected = false;

// Connect to MongoDB and seed if collection is empty
const init = async () => {
  isMongoConnected = await connectDB();
  if (isMongoConnected) {
    try {
      const count = await Product.countDocuments();
      if (count === 0) {
        console.log("🌱 Database is empty. Seeding initial products...");
        await Product.insertMany(initialProducts);
        console.log("✅ Seed products inserted successfully!");
      }
    } catch (err) {
      console.error("Error during initial seeding:", err.message);
    }
  } else {
    console.log("🚀 Server running in resilient mode.");
  }
};
init();

// ==========================================
// TASK 2 ENDPOINTS: GET /tasks & POST /add
// ==========================================

app.get("/tasks", async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const tasks = await Task.find().sort({ createdAt: -1 });
      return res.status(200).json(tasks);
    }
    return res.status(200).json(readStoredTasks());
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks", details: error.message });
  }
});

app.post("/add", async (req, res) => {
  try {
    const { text } = req.body;
    if (text === undefined || text === null || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Task text cannot be empty. Please enter a task description." });
    }
    const trimmedText = text.trim();
    if (mongoose.connection.readyState === 1) {
      const saved = await Task.create({ text: trimmedText });
      return res.status(201).json(saved);
    }
    const now = new Date().toISOString();
    const newTask = {
      _id: new mongoose.Types.ObjectId().toString(),
      text: trimmedText,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [newTask, ...readStoredTasks()];
    writeStoredTasks(updated);
    return res.status(201).json(newTask);
  } catch (error) {
    res.status(400).json({ error: "Failed to add task", details: error.message });
  }
});

// ==========================================
// TASK 1 ENDPOINTS: /api/products
// ==========================================

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Maincrafts MERN API is active",
    database: isMongoConnected ? "Connected (MongoDB)" : "Local Resilient Store",
    timestamp: new Date(),
  });
});

// 1. GET all products
app.get("/api/products", async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const products = await Product.find().sort({ createdAt: -1 });
      return res.json(products);
    }
    return res.json(fallbackProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products", details: error.message });
  }
});

// 2. GET product by ID
app.get("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      const product = await Product.findById(id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      return res.json(product);
    }
    const item = fallbackProducts.find((p) => p._id === id);
    if (!item) return res.status(404).json({ error: "Product not found" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: "Failed to get product", details: error.message });
  }
});

// 3. POST new product
app.post("/api/products", async (req, res) => {
  try {
    const { name, price, category, description, imageUrl, inStock, rating } = req.body;

    if (!name || price === undefined || price === null || price === "") {
      return res.status(400).json({ error: "Name and Price are required fields" });
    }

    const productData = {
      name: name.trim(),
      price: Number(price),
      category: category ? category.trim() : "General",
      description: description ? description.trim() : "",
      imageUrl:
        imageUrl && imageUrl.trim() !== ""
          ? imageUrl.trim()
          : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60",
      inStock: inStock !== undefined ? Boolean(inStock) : true,
      rating: rating ? Number(rating) : 4.5,
    };

    if (mongoose.connection.readyState === 1) {
      const newProduct = await Product.create(productData);
      return res.status(201).json(newProduct);
    }

    const mockProduct = {
      ...productData,
      _id: `mock-id-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fallbackProducts.unshift(mockProduct);
    res.status(201).json(mockProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(400).json({ error: "Failed to create product", details: error.message });
  }
});

// 4. PUT update product
app.put("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.price !== undefined) updateData.price = Number(updateData.price);

    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      const updated = await Product.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });
      if (!updated) return res.status(404).json({ error: "Product not found" });
      return res.json(updated);
    }

    const index = fallbackProducts.findIndex((p) => p._id === id);
    if (index === -1) return res.status(404).json({ error: "Product not found" });
    fallbackProducts[index] = {
      ...fallbackProducts[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };
    res.json(fallbackProducts[index]);
  } catch (error) {
    res.status(400).json({ error: "Failed to update product", details: error.message });
  }
});

// 5. DELETE product
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(id)) {
      const deleted = await Product.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ error: "Product not found" });
      return res.json({ message: "Product deleted successfully", id });
    }

    const index = fallbackProducts.findIndex((p) => p._id === id);
    if (index === -1) return res.status(404).json({ error: "Product not found" });
    fallbackProducts.splice(index, 1);
    res.json({ message: "Product deleted successfully", id });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete product", details: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Express Server is listening on http://localhost:${PORT}`);
  console.log(`✅ Task 2 To-Do endpoints: GET /tasks, POST /add`);
});
