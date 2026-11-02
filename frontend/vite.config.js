import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import http from "http";
import fs from "fs";
import path from "path";
import net from "net";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, "../backend");
const TASKS_FILE = path.resolve(BACKEND_DIR, "tasks.json");

function readTasks() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
      if (Array.isArray(data)) return data;
    }
  } catch {
    // ignore read errors
  }
  return [];
}

function writeTasks(tasks) {
  try {
    if (!fs.existsSync(BACKEND_DIR)) {
      fs.mkdirSync(BACKEND_DIR, { recursive: true });
    }
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf-8");
  } catch {
    // ignore write errors
  }
}

function handleTaskApiRequest(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  const url = req.url?.split("?")[0];

  if (req.method === "GET" && url === "/tasks") {
    const tasks = readTasks();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(tasks));
    return true;
  }

  if (req.method === "POST" && url === "/add") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const { text } = parsed;

        if (text === undefined || text === null || typeof text !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Please provide a valid task 'text' field as a string.",
            })
          );
          return;
        }

        const trimmedText = text.trim();
        if (!trimmedText) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Task text cannot be empty. Please enter a task description.",
            })
          );
          return;
        }

        if (trimmedText.length > 300) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Task text is too long (maximum 300 characters allowed).",
            })
          );
          return;
        }

        const now = new Date().toISOString();
        const newTask = {
          _id: crypto.randomBytes(12).toString("hex"),
          text: trimmedText,
          createdAt: now,
          updatedAt: now,
        };

        const tasks = readTasks();
        const updated = [newTask, ...tasks];
        writeTasks(updated);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(newTask));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON payload." }));
      }
    });
    return true;
  }

  return false;
}

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net
      .createConnection({ port, host: "127.0.0.1" })
      .once("connect", () => {
        tester.end();
        resolve(true);
      })
      .once("error", () => {
        resolve(false);
      });
  });
}

function startFallbackPort5000Server() {
  const server = http.createServer((req, res) => {
    if (handleTaskApiRequest(req, res)) return;

    const url = req.url?.split("?")[0];
    if (req.method === "GET" && url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          message: "Maincrafts MERN To-Do List API is running",
          endpoints: { getTasks: "GET /tasks", addTask: "POST /add" },
        })
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: `Route ${req.url} not found. Available endpoints: GET /tasks, POST /add`,
      })
    );
  });

  server.on("error", () => {
    // Port 5000 already bound
  });

  server.listen(5000, () => {
    console.log("🚀 API Server active on http://localhost:5000");
  });
}

function ensureBackendServerPlugin() {
  let started = false;
  return {
    name: "ensure-backend-server",
    async configureServer(viteServer) {
      // Built-in middleware for /tasks and /add so requests never fail
      viteServer.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url === "/tasks" || url === "/add") {
          if (handleTaskApiRequest(req, res)) return;
        }
        next();
      });

      if (started) return;
      started = true;

      const inUse = await checkPortInUse(5000);
      if (inUse) return;

      const backendEntry = path.resolve(BACKEND_DIR, "server.js");

      if (fs.existsSync(backendEntry)) {
        const child = spawn(process.execPath, [backendEntry], {
          cwd: BACKEND_DIR,
          stdio: "inherit",
        });
        child.on("error", () => {
          startFallbackPort5000Server();
        });
      } else {
        startFallbackPort5000Server();
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ensureBackendServerPlugin()],
  server: {
    port: 5173,
  },
});
