# Pyright MCP Server (SSE)

An MCP server that runs **Pyright** type checking and returns diagnostics as JSON.

## Tools

- `pyright_check`: Run Pyright in a target directory (relative to `PYRIGHT_ROOT`)

## Local Run

```bash
cd pyright-mcp
npm install
npm run build
PORT=8080 PYRIGHT_ROOT=. npm start
```

Server:
- `GET /sse` (MCP SSE)
- `POST /message` (MCP messages)
- `GET /health`

## Example Use

Configure your MCP client to use:
- `http://localhost:8080/sse`

Then ask:
- "Run pyright check on the current project."

## Notes / Limitations

This server can only analyze files present on the server filesystem. For remote analysis of arbitrary repos, you would need an upload/clone mechanism (which is usually restricted for security reasons).

