#!/usr/bin/env node
import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());

// Ornek veri
const exampleData = {
  users: [
    { id: 1, name: "Ahmet", role: "developer" },
    { id: 2, name: "Mehmet", role: "designer" },
    { id: 3, name: "Ayse", role: "manager" },
  ],
  stats: {
    totalUsers: 3,
    version: "1.0.0",
    serverTime: new Date().toISOString(),
  },
};

// MCP Server olustur
const server = new Server(
  {
    name: "example-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Tool'lari listele
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_users",
        description: "Tum kullanicilari listele",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "get_user_by_id",
        description: "ID'ye gore kullanici getir",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "number",
              description: "Kullanici ID'si",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "get_server_stats",
        description: "Server istatistiklerini getir",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "calculate",
        description: "Basit matematik islemi yap",
        inputSchema: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["add", "subtract", "multiply", "divide"],
              description: "Islem turu",
            },
            a: {
              type: "number",
              description: "Birinci sayi",
            },
            b: {
              type: "number",
              description: "Ikinci sayi",
            },
          },
          required: ["operation", "a", "b"],
        },
      },
    ],
  };
});

// Tool cagirilarini isle
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "get_users": {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(exampleData.users, null, 2),
          },
        ],
      };
    }

    case "get_user_by_id": {
      const id = args?.id as number;
      const user = exampleData.users.find((u) => u.id === id);
      if (!user) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Kullanici ID ${id} bulunamadi`
        );
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    }

    case "get_server_stats": {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ...exampleData.stats, serverTime: new Date().toISOString() },
              null,
              2
            ),
          },
        ],
      };
    }

    case "calculate": {
      const { operation, a, b } = args as {
        operation: string;
        a: number;
        b: number;
      };
      let result: number;

      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          if (b === 0) {
            throw new McpError(ErrorCode.InvalidRequest, "Sifira bolme hatasi");
          }
          result = a / b;
          break;
        default:
          throw new McpError(ErrorCode.InvalidRequest, "Bilinmeyen islem");
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ operation, a, b, result }, null, 2),
          },
        ],
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Bilinmeyen tool: ${name}`);
  }
});

// Resource'lari listele
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "data://users",
        name: "Kullanici Listesi",
        mimeType: "application/json",
        description: "Tum kullanicilarin listesi",
      },
      {
        uri: "data://stats",
        name: "Server Istatistikleri",
        mimeType: "application/json",
        description: "Anlik server istatistikleri",
      },
    ],
  };
});

// Resource okuma isteklerini isle
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === "data://users") {
    return {
      contents: [
        {
          uri: "data://users",
          mimeType: "application/json",
          text: JSON.stringify(exampleData.users, null, 2),
        },
      ],
    };
  }

  if (uri === "data://stats") {
    return {
      contents: [
        {
          uri: "data://stats",
          mimeType: "application/json",
          text: JSON.stringify(
            { ...exampleData.stats, serverTime: new Date().toISOString() },
            null,
            2
          ),
        },
      ],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Bilinmeyen resource: ${uri}`);
});

// SSE transport
let transport: SSEServerTransport | null = null;

// SSE endpoint - MCP client buraya baglanir
app.get("/sse", async (req, res) => {
  console.log("Yeni SSE baglantisi");
  
  transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
});

// Message endpoint - Client'dan gelen mesajlar buraya gider
// NOTE: MCP SDK reads the raw request stream. Do not attach any body parser.
app.post("/message", async (req, res) => {
  if (!transport) {
    res.status(503).json({ error: "SSE baglantisi aktif degil" });
    return;
  }
  
  await transport.handlePostMessage(req, res);
});

// Health check endpoint - Render icin gerekli
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Ana sayfa
app.get("/", (req, res) => {
  res.json({
    name: "MCP Server SSE",
    version: "1.0.0",
    endpoints: {
      sse: "/sse",
      message: "/message",
      health: "/health",
    },
  });
});

// Server'i baslat
app.listen(PORT, () => {
  console.log(`MCP Server SSE calisiyor: http://localhost:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  - GET  /sse     : SSE baglantisi`);
  console.log(`  - POST /message : MCP mesajlari`);
  console.log(`  - GET  /health  : Health check`);
});
