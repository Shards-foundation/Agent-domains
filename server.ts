import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("agentdomain.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    namespace TEXT UNIQUE,
    slug TEXT UNIQUE,
    config TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    namespace TEXT,
    event_type TEXT,
    payload TEXT,
    severity TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Register Agent
  app.post("/api/register", (req, res) => {
    const { slug } = req.body;
    if (!slug || !/^[a-z0-9_]+$/.test(slug)) {
      return res.status(400).json({ error: "Invalid slug. Use lowercase alphanumeric and underscores." });
    }

    const namespace = `${slug}.agent`;
    const id = crypto.randomUUID();

    try {
      const stmt = db.prepare("INSERT INTO agents (id, namespace, slug) VALUES (?, ?, ?)");
      stmt.run(id, namespace, slug);
      res.json({ id, namespace, slug });
    } catch (err: any) {
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(409).json({ error: "Namespace already taken." });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Get Agent
  app.get("/api/agents/:namespace", (req, res) => {
    const stmt = db.prepare("SELECT * FROM agents WHERE namespace = ?");
    const agent = stmt.get(req.params.namespace);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  });

  // Ingest Log
  app.post("/api/logs", (req, res) => {
    const { namespace, event_type, payload, severity } = req.body;
    
    const agentStmt = db.prepare("SELECT id FROM agents WHERE namespace = ?");
    const agent = agentStmt.get(namespace) as { id: string } | undefined;
    
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const logId = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO logs (id, agent_id, namespace, event_type, payload, severity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(logId, agent.id, namespace, event_type, JSON.stringify(payload), severity || "info");

    const logEntry = {
      id: logId,
      agent_id: agent.id,
      namespace,
      event_type,
      payload,
      severity: severity || "info",
      timestamp: new Date().toISOString()
    };

    // Broadcast to WS
    broadcastLog(logEntry);

    res.json(logEntry);
  });

  // Get Logs
  app.get("/api/logs/:namespace", (req, res) => {
    const stmt = db.prepare("SELECT * FROM logs WHERE namespace = ? ORDER BY timestamp DESC LIMIT 100");
    const logs = stmt.all(req.params.namespace);
    res.json(logs.map((l: any) => ({ ...l, payload: JSON.parse(l.payload) })));
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // --- WebSockets ---
  const wss = new WebSocketServer({ server });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  function broadcastLog(log: any) {
    const message = JSON.stringify({ type: "LOG", data: log });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

startServer();
