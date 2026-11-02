import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import Task from "./models/Task.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve dependencies from backend/node_modules or existing ../server/node_modules
const backendPkg = path.resolve(__dirname, "package.json");
const backendModules = path.resolve(__dirname, "node_modules/express");
const serverPkg = path.resolve(__dirname, "../server/package.json");

const requirePkg = createRequire(
  fs.existsSync(backendModules) ? backendPkg : serverPkg
);

const express = requirePkg("express");
const mongoose = requirePkg("mongoose");
const cors = requirePkg("cors");
const dotenv = requirePkg("dotenv");

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mern_todo_db";
const TASKS_FILE = path.resolve(__dirname, "tasks.json");

// Middleware
app.use(cors());
app.use(express.json());

// Local file persistence helper when MongoDB Atlas is not yet reachable
const readStoredTasks = () => {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const raw = fs.readFileSync(TASKS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Could not read local tasks file:", err.message);
  }
  return [];
};

const writeStoredTasks = (tasks) => {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not write local tasks file:", err.message);
  }
};

// Connect to MongoDB Atlas (or local MongoDB)
const connectDB = async () => {
  if (!MONGO_URI || MONGO_URI.includes("<username>")) {
    console.warn(
      "⚠️ MONGO_URI contains placeholder credentials. Update backend/.env with your MongoDB Atlas URI."
    );
    return;
  }

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 4000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`⚠️ MongoDB Connection Notice: ${error.message}`);
    console.log(
      "ℹ️ Running with persistent file storage (backend/tasks.json) until MongoDB Atlas is connected."
    );
  }
};

connectDB();

// Root / Health Check Endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Maincrafts MERN To-Do List API is running",
    databaseConnected: mongoose.connection.readyState === 1,
    endpoints: {
      getTasks: "GET /tasks",
      addTask: "POST /add",
    },
  });
});

// GET /tasks - Retrieve all tasks
app.get("/tasks", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const tasks = await Task.find().sort({ createdAt: -1 });
      return res.status(200).json(tasks);
    }

    const tasks = readStoredTasks();
    return res.status(200).json(tasks);
  } catch (error) {
    next(error);
  }
});

// POST /add - Add a new task
app.post("/add", async (req, res, next) => {
  try {
    const { text } = req.body;

    // Input Validation
    if (text === undefined || text === null || typeof text !== "string") {
      return res.status(400).json({
        error: "Please provide a valid task 'text' field as a string.",
      });
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      return res.status(400).json({
        error: "Task text cannot be empty. Please enter a task description.",
      });
    }

    if (trimmedText.length > 300) {
      return res.status(400).json({
        error: "Task text is too long (maximum 300 characters allowed).",
      });
    }

    if (mongoose.connection.readyState === 1) {
      const newTask = new Task({ text: trimmedText });
      const savedTask = await newTask.save();
      return res.status(201).json(savedTask);
    }

    // Persistent disk storage when MongoDB is offline
    const now = new Date().toISOString();
    const savedTask = {
      _id: new mongoose.Types.ObjectId().toString(),
      text: trimmedText,
      createdAt: now,
      updatedAt: now,
    };
    const existing = readStoredTasks();
    const updated = [savedTask, ...existing];
    writeStoredTasks(updated);

    return res.status(201).json(savedTask);
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ error: messages.join(", ") });
    }
    next(error);
  }
});

// 404 Handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    error: `Route ${req.originalUrl} not found. Available endpoints: GET /tasks, POST /add`,
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack || err.message);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
