# AgentDomain: `username.agent` Infrastructure

**AgentDomain** is a production-grade infrastructure layer for the next generation of AI agents. It treats the identifier `<username>.agent` as a programmable namespace primitive—functioning as an identity anchor, a logging partition key, and a persistent execution container.

## 🏗️ Architecture

The system is designed as a high-performance, full-stack observability and identity platform.

### 1. Identity Layer
- **Deterministic Resolution**: Maps `slug.agent` to unique internal UUIDs.
- **Namespace Integrity**: Enforces strict alphanumeric constraints and collision resistance.
- **Registry**: A centralized service for provisioning and managing agent metadata.

### 2. Execution Model
- **Stateless Workers**: AI execution is handled by stateless workers that reconstruct context from the database.
- **AI Integration**: Native integration with Gemini 3 Flash for high-reasoning, low-latency execution.
- **Traceability**: Every execution is assigned a `trace_id` that propagates through the entire logging pipeline.

### 3. Logging Pipeline
- **Append-Only Event Store**: Powered by SQLite (production-ready for TimescaleDB/ClickHouse migration).
- **Structured Events**: Logs capture `execution.start`, `execution.success`, `execution.error`, and custom tool calls.
- **Real-time Streaming**: WebSocket-based fan-out for live dashboard observability.

## 🚀 Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Motion, Lucide Icons.
- **Backend**: Node.js, Express, WebSockets (`ws`).
- **Database**: `better-sqlite3` (Relational + Event Store).
- **AI**: Google Gemini API (`@google/genai`).

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- Gemini API Key

### Environment Variables
Create a `.env` file (or set in your environment):
```env
GEMINI_API_KEY=your_gemini_api_key
APP_URL=your_deployment_url
```

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (Full-stack mode):
   ```bash
   npm run dev
   ```

## 📡 API Reference

### Register Agent
`POST /api/register`
```json
{ "slug": "sunil" }
```

### Ingest Log
`POST /api/logs`
```json
{
  "namespace": "sunil.agent",
  "event_type": "custom.event",
  "payload": { "key": "value" },
  "severity": "info"
}
```

### Fetch Logs
`GET /api/logs/:namespace`

## 🛡️ Security
- **HMAC Signing**: (Planned) Cryptographic verification of log entries.
- **Rate Limiting**: Per-namespace execution throttling.
- **Namespace Isolation**: Strict data partitioning at the database layer.

## 🗺️ Roadmap
- [ ] **Web3 Anchoring**: Periodically anchor Merkle roots of logs to Polygon PoS.
- [ ] **Vector Memory**: Integrated Qdrant/pgvector for long-term agent memory.
- [ ] **Multi-Tenant RBAC**: Granular permissions for agent collaborators.

---
Built for the **Shards Inc** ecosystem.
