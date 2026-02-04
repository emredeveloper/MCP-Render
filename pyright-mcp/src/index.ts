#!/usr/bin/env node
import express from "express";
import cors from "cors";
import path from "path";
import { spawn } from "node:child_process";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

const app = express();
const PORT = process.env.PORT || 8080;

// Limit where pyright can run. Defaults to current working directory.
const PYRIGHT_ROOT = path.resolve(process.env.PYRIGHT_ROOT || process.cwd());

app.use(cors());

const server = new Server(
  { name: "pyright-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "pyright_check",
        description:
          "Run Pyright type checking for a project/folder. Returns JSON diagnostics (read-only).",
        inputSchema: {
          type: "object",
          properties: {
            targetPath: {
              type: "string",
              description:
                "Path to check (relative to PYRIGHT_ROOT). Example: '.' or 'src'.",
            },
            configPath: {
              type: "string",
              description:
                "Optional path to pyrightconfig.json (relative to PYRIGHT_ROOT).",
            },
            pythonVersion: {
              type: "string",
              description: "Optional python version, e.g. '3.11'.",
            },
          },
          required: ["targetPath"],
        },
      },
    ],
  };
});

function resolveUnderRoot(p: string) {
  const resolved = path.resolve(PYRIGHT_ROOT, p);
  if (!resolved.startsWith(PYRIGHT_ROOT + path.sep) && resolved !== PYRIGHT_ROOT) {
    throw new McpError(ErrorCode.InvalidRequest, "targetPath is outside PYRIGHT_ROOT");
  }
  return resolved;
}

async function runPyright(args: string[], cwd: string) {
  // Use local pyright installed in node_modules.
  const bin = process.platform === "win32" ? "pyright.cmd" : "pyright";
  const pyrightPath = path.join(process.cwd(), "node_modules", ".bin", bin);

  return await new Promise<{ exitCode: number; stdout: string; stderr: string }>(
    (resolve) => {
      const child = spawn(pyrightPath, args, {
        cwd,
        env: process.env,
        shell: false,
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
      child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
      child.on("close", (code) =>
        resolve({ exitCode: code ?? 0, stdout, stderr })
      );
    }
  );
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== "pyright_check") {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }

  const { targetPath, configPath, pythonVersion } = args as {
    targetPath: string;
    configPath?: string;
    pythonVersion?: string;
  };

  const targetAbs = resolveUnderRoot(targetPath);
  const cwd = targetAbs;

  const pyrightArgs: string[] = ["--outputjson"];
  if (configPath) {
    const configAbs = resolveUnderRoot(configPath);
    pyrightArgs.push("--project", configAbs);
  }
  if (pythonVersion) {
    pyrightArgs.push("--pythonversion", pythonVersion);
  }

  const { exitCode, stdout, stderr } = await runPyright(pyrightArgs, cwd);
  const raw = stdout.trim();

  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // If pyright couldn't emit JSON, return both outputs.
    parsed = { parseError: true, stdout: stdout, stderr: stderr };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            pyrightRoot: PYRIGHT_ROOT,
            checkedPath: targetAbs,
            exitCode,
            stderr: stderr || undefined,
            result: parsed,
          },
          null,
          2
        ),
      },
    ],
  };
});

let transport: SSEServerTransport | null = null;

app.get("/sse", async (_req, res) => {
  transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
});

app.post("/message", async (req, res) => {
  if (!transport) {
    res.status(503).json({ error: "No active SSE connection" });
    return;
  }
  await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.json({
    name: "pyright-mcp-server",
    version: "0.1.0",
    endpoints: { sse: "/sse", message: "/message", health: "/health" },
    env: { PYRIGHT_ROOT },
  });
});

app.listen(PORT, () => {
  console.log(`pyright-mcp-server listening on :${PORT}`);
});

