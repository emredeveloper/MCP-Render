# MCP Server - Render Deployment (SSE Transport)

This project is a sample **Model Context Protocol (MCP)** server that runs on Render using **SSE (Server-Sent Events)** transport.

## Features

- **HTTP + SSE Transport:** Runs as a Render Web Service
- **Tools:**
  - `get_users`: List all users
  - `get_user_by_id`: Get a user by ID
  - `get_server_stats`: Get server stats
  - `calculate`: Basic math (add, subtract, multiply, divide)
  - `erp_list_customers`: Mock ERP customers (read-only)
  - `erp_get_customer`: Mock ERP customer by ID
  - `erp_list_orders`: Mock ERP orders (read-only)
  - `erp_get_order`: Mock ERP order by ID
  - `erp_list_invoices`: Mock ERP invoices (read-only)
  - `erp_list_inventory`: Mock ERP inventory (read-only)
  - `db_create`: Create SQLite DB (optional schema)
  - `db_list_tables`: List SQLite tables (read-only)
  - `db_table_schema`: Show table schema (read-only)
  - `db_query`: Run SELECT/WITH queries (read-only)
  - `db_exec`: Run INSERT/UPDATE/DELETE/CREATE (write)
- **Resources:**
  - `data://users`: Users list (JSON)
  - `data://stats`: Server stats (JSON)

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info |
| `/health` | GET | Health check (for Render) |
| `/sse` | GET | SSE connection (MCP client connects here) |
| `/message` | POST | MCP messages (client to server) |

## Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# Watch mode
npm run dev
```

The server runs on `http://localhost:8080`.

## Deploy to Render

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "MCP Server SSE"
git remote add origin https://github.com/yourusername/mcp-server-sse.git
git push -u origin main
```

### 2. Create a Render Web Service

1. Log in to the Render Dashboard
2. Select **New > Web Service**
3. Connect your GitHub repo
4. Use these settings:
   - **Runtime:** Docker
   - **Plan:** Free (or your preferred plan)
   - **Dockerfile Path:** `./Dockerfile`
   - **Port:** `8080`
5. Click **Deploy**

### 3. Deploy with Blueprint (Optional)

You can deploy using `render.yaml`:

1. Go to Render Blueprints
2. Select **New Blueprint Instance**
3. Choose your repo
4. Deploy

## MCP Client Usage

To connect to the MCP server over SSE, the client must use the SSE URL.

### Claude Desktop Config (example)

```json
{
  "mcpServers": {
    "render-server": {
      "url": "https://your-service.onrender.com/sse"
    }
  }
}
```

### Local Development Config

```json
{
  "mcpServers": {
    "local-server": {
      "url": "http://localhost:8080/sse"
    }
  }
}
```

## API Testing

### Health Check
```bash
curl http://localhost:8080/health
```

### SSE Connection (in a new terminal)
```bash
curl http://localhost:8080/sse
```

### Send MCP Message
```bash
curl -X POST http://localhost:8080/message \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

## Logging

Tool calls are logged as JSON lines. By default logs go to stdout.  
Set `LOG_FILE` to write logs to a file instead.

## SQLite

The server can create and query a local SQLite database.

Env vars:
- `SQLITE_FILE` (default: `./data/app.db`)

Example usage:
- `db_create` with `schema_sql: "CREATE TABLE items(id INTEGER PRIMARY KEY, name TEXT);"`
- `db_list_tables`
- `db_table_schema` with `table: "items"`
- `db_query` with `sql: "SELECT * FROM items"`
 - `db_exec` with `sql: "INSERT INTO items(name) VALUES('Elma'),('Armut')"`

## Project Structure

```
.
├── src/
│   └── index.ts          # MCP server code (Express + SSE)
├── dist/                 # Compiled JavaScript (after build)
├── Dockerfile            # Docker image
├── render.yaml           # Render blueprint
├── package.json          # NPM dependencies
├── tsconfig.json         # TypeScript config
└── README.md             # This file
```

## Technologies

- **@modelcontextprotocol/sdk:** MCP Server SDK
- **Express:** HTTP framework
- **SSE:** Server-Sent Events transport
- **TypeScript:** Type-safe development
- **Docker:** Containerization
- **Render:** Cloud deployment

## License

MIT
