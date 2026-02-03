# MCP Server - Render Deployment (SSE Transport)

This project is a sample **Model Context Protocol (MCP)** server that runs on Render using **SSE (Server-Sent Events)** transport.

## Features

- **HTTP + SSE Transport:** Runs as a Render Web Service
- **Tools:**
  - `get_users`: List all users
  - `get_user_by_id`: Get a user by ID
  - `get_server_stats`: Get server stats
  - `calculate`: Basic math (add, subtract, multiply, divide)
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
