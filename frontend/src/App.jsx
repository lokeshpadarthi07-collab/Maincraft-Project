import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  AlertCircle,
  ClipboardList,
  Clock,
  Database,
  Sparkles,
  Loader2,
} from "lucide-react";
import "./App.css";

// Backend Express API base URL (Port 5000)
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [taskInput, setTaskInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch all tasks from GET /tasks
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError("");

      let response;
      try {
        response = await axios.get(`${API_BASE_URL}/tasks`);
      } catch (primaryErr) {
        // Fallback to relative /tasks endpoint if localhost:5000 is being proxied
        if (!primaryErr.response || primaryErr.response.status === 404) {
          response = await axios.get("/tasks");
        } else {
          throw primaryErr;
        }
      }

      setTasks(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const backendError =
        err.response?.data?.error ||
        err.message ||
        "Unable to fetch tasks from the server. Make sure the backend is running on port 5000.";
      setError(backendError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Add a new task using POST /add
  const handleAddTask = async (e) => {
    e.preventDefault();
    setValidationError("");
    setSuccessMessage("");

    const trimmedText = taskInput.trim();
    if (!trimmedText) {
      setValidationError("Please enter a task before clicking Add Task.");
      return;
    }

    if (trimmedText.length > 300) {
      setValidationError("Task text cannot exceed 300 characters.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      let response;
      try {
        response = await axios.post(`${API_BASE_URL}/add`, {
          text: trimmedText,
        });
      } catch (primaryErr) {
        // Fallback to relative /add endpoint if localhost:5000 is being proxied
        if (!primaryErr.response || primaryErr.response.status === 404) {
          response = await axios.post("/add", {
            text: trimmedText,
          });
        } else {
          throw primaryErr;
        }
      }

      const createdTask = response.data;

      // Immediately update the task list in state without requiring a page reload
      setTasks((prevTasks) => [createdTask, ...prevTasks]);
      setTaskInput("");
      setSuccessMessage("Task added successfully!");

      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } catch (err) {
      const backendError =
        err.response?.data?.error ||
        err.message ||
        "Failed to add task. Please check your backend connection.";
      setValidationError(backendError);
    } finally {
      setSubmitting(false);
    }
  };

  // Format timestamp into a clean human-readable string
  const formatDate = (dateString) => {
    if (!dateString) return "Just now";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Just now";
    }
  };

  return (
    <div className="app-wrapper">
      {/* Header / Navbar */}
      <header className="navbar">
        <div className="container navbar-inner">
          <div className="brand">
            <div className="brand-icon">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h2 className="brand-title">Maincrafts Technology</h2>
              <p className="brand-subtitle">MERN Stack Internship • Task 2</p>
            </div>
          </div>

          <div className="nav-right">
            <span className={`db-status ${error ? "offline" : "online"}`}>
              <Database size={14} />
              <span>{error ? "Check DB / API" : "MongoDB Connected"}</span>
            </span>
            <button
              type="button"
              onClick={fetchTasks}
              className="btn-icon"
              disabled={loading}
              title="Refresh Tasks from MongoDB"
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container main-content">
        {/* Hero Banner */}
        <section className="hero">
          <div className="hero-badge">
            <Sparkles size={14} />
            <span>Full-Stack MERN To-Do List Application</span>
          </div>
          <h1 className="hero-heading">
            Organize Your Tasks with{" "}
            <span className="gradient-text">MongoDB Atlas</span>
          </h1>
          <p className="hero-subtext">
            Add new tasks below. Every task is validated and saved permanently in
            MongoDB via Express (<code>POST /add</code>) and retrieved using Axios
            (<code>GET /tasks</code>).
          </p>
        </section>

        {/* Add Task Card */}
        <section className="todo-card">
          <form onSubmit={handleAddTask} className="add-task-form" noValidate>
            <div className="input-wrapper">
              <input
                type="text"
                className={`task-input ${validationError ? "input-error" : ""}`}
                placeholder="What needs to be done today? (e.g., Complete MERN Internship Task 2)"
                value={taskInput}
                onChange={(e) => {
                  setTaskInput(e.target.value);
                  if (validationError) setValidationError("");
                }}
                disabled={submitting}
                maxLength={300}
                aria-label="New task description"
              />
              <span className="char-counter">{taskInput.length}/300</span>
            </div>

            <button
              type="submit"
              className="btn-add"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus size={18} />
                  <span>Add Task</span>
                </>
              )}
            </button>
          </form>

          {/* Validation Error Feedback */}
          {validationError && (
            <div className="feedback-banner error-banner" role="alert">
              <AlertCircle size={16} />
              <span>{validationError}</span>
            </div>
          )}

          {/* Success Feedback */}
          {successMessage && (
            <div className="feedback-banner success-banner" role="status">
              <CheckCircle2 size={16} />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Tasks Header Bar */}
          <div className="tasks-header">
            <div className="tasks-title-group">
              <h3>Saved Tasks</h3>
              <span className="task-count-badge">{tasks.length}</span>
            </div>
            <span className="endpoint-hint">
              Synced with <code>GET /tasks</code> &amp; <code>POST /add</code>
            </span>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="state-box">
              <Loader2 size={36} className="spin state-icon accent" />
              <h4>Loading tasks from MongoDB...</h4>
              <p>Fetching records from {API_BASE_URL}/tasks</p>
            </div>
          )}

          {/* API / Database Connection Error State */}
          {!loading && error && (
            <div className="state-box error-state">
              <AlertCircle size={40} className="state-icon danger" />
              <h4>Database or Backend Connection Notice</h4>
              <p>{error}</p>
              <div className="config-help">
                <p>
                  <strong>How to configure MongoDB Atlas:</strong> Set your{" "}
                  <code>MONGO_URI</code> inside <code>backend/.env</code> and
                  ensure the backend server is running on port <code>5000</code>.
                </p>
              </div>
              <button type="button" onClick={fetchTasks} className="btn-retry">
                <RefreshCw size={15} />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && tasks.length === 0 && (
            <div className="state-box empty-state">
              <ClipboardList size={44} className="state-icon muted" />
              <h4>No tasks yet!</h4>
              <p>
                Your MongoDB task list is currently empty. Type a task above and
                click <strong>Add Task</strong> to create your first record.
              </p>
            </div>
          )}

          {/* Tasks List */}
          {!loading && !error && tasks.length > 0 && (
            <ul className="task-list">
              {tasks.map((task, index) => (
                <li key={task._id || index} className="task-item">
                  <div className="task-left">
                    <span className="task-index">{index + 1}</span>
                    <div className="task-details">
                      <p className="task-text">{task.text}</p>
                      <div className="task-meta">
                        <span className="meta-item">
                          <Clock size={12} />
                          {formatDate(task.createdAt)}
                        </span>
                        {task._id && (
                          <span className="meta-id" title="MongoDB Document _id">
                            ID: {String(task._id).slice(-6)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="saved-pill">
                    <CheckCircle2 size={13} />
                    Saved
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>
            Maincrafts Technology MERN Stack Internship —{" "}
            <strong>Task 2: To-Do List Application</strong>
          </p>
          <p className="footer-sub">
            React • Vite • Axios • Node.js • Express • Mongoose • MongoDB Atlas
          </p>
        </div>
      </footer>
    </div>
  );
}
