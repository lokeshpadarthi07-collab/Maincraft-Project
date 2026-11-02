import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendPkg = path.resolve(__dirname, "../package.json");
const backendModules = path.resolve(__dirname, "../node_modules/mongoose");
const serverPkg = path.resolve(__dirname, "../../server/package.json");

const requirePkg = createRequire(
  fs.existsSync(backendModules) ? backendPkg : serverPkg
);

const mongoose = requirePkg("mongoose");

const taskSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Task text is required"],
      trim: true,
      minlength: [1, "Task text cannot be empty"],
      maxlength: [300, "Task text cannot exceed 300 characters"],
    },
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

export default Task;
