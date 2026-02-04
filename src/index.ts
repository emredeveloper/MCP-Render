#!/usr/bin/env node
import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { appendFile, readFile, writeFile } from "fs/promises";
import { mkdirSync, existsSync } from "fs";
import path from "path";
import initSqlJs from "sql.js";
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
const LOG_FILE = process.env.LOG_FILE || "";
const SQLITE_FILE =
  process.env.SQLITE_FILE || path.join(process.cwd(), "data", "app.db");

// Middleware
app.use(cors());

function ensureSqliteDir() {
  const dir = path.dirname(SQLITE_FILE);
  mkdirSync(dir, { recursive: true });
}

let sqlJs: any = null;
let sqlDb: any = null;

async function getSqliteDb() {
  if (!sqlJs) {
    sqlJs = await initSqlJs();
  }
  if (!sqlDb) {
    ensureSqliteDir();
    if (existsSync(SQLITE_FILE)) {
      const data = await readFile(SQLITE_FILE);
      sqlDb = new sqlJs.Database(new Uint8Array(data));
    } else {
      sqlDb = new sqlJs.Database();
    }
  }
  return sqlDb;
}

async function persistSqliteDb() {
  if (!sqlDb) return;
  const data = sqlDb.export();
  await writeFile(SQLITE_FILE, Buffer.from(data));
}

async function sqliteAll<T = unknown>(sql: string, params: unknown[] = []) {
  const db = await getSqliteDb();
  const stmt = db.prepare(sql);
  stmt.bind(params as any[]);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

async function sqliteRun(sql: string, params: unknown[] = []) {
  const db = await getSqliteDb();
  const stmt = db.prepare(sql);
  stmt.bind(params as any[]);
  while (stmt.step()) {
    // drain
  }
  stmt.free();
  await persistSqliteDb();
}

async function logToolCall(entry: {
  ts: string;
  tool: string;
  status: "ok" | "error";
  duration_ms: number;
  args?: unknown;
  error?: string;
  request_id?: unknown;
}) {
  const line = JSON.stringify(entry);
  if (LOG_FILE) {
    try {
      await appendFile(LOG_FILE, `${line}\n`);
      return;
    } catch {
      // Fall back to console if file write fails
    }
  }
  console.log("MCP_LOG", line);
}

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

// Mock ERP data (read-only, safe for demos)
const mockErp = {
  customers: [
    { id: "C-1001", name: "Acme Corp", country: "US", status: "active" },
    { id: "C-1002", name: "Globex Ltd", country: "UK", status: "active" },
    { id: "C-1003", name: "Initech", country: "TR", status: "inactive" },
  ],
  products: [
    { sku: "P-001", name: "Widget A", price: 19.5, currency: "USD" },
    { sku: "P-002", name: "Widget B", price: 29.0, currency: "USD" },
    { sku: "P-003", name: "Service Plan", price: 99.0, currency: "USD" },
  ],
  inventory: [
    { sku: "P-001", warehouse: "WH-1", qty: 120 },
    { sku: "P-002", warehouse: "WH-1", qty: 40 },
    { sku: "P-003", warehouse: "WH-2", qty: 999 },
  ],
  orders: [
    {
      id: "SO-9001",
      customerId: "C-1001",
      status: "open",
      lines: [
        { sku: "P-001", qty: 2, unitPrice: 19.5 },
        { sku: "P-003", qty: 1, unitPrice: 99.0 },
      ],
      total: 138.0,
      currency: "USD",
      createdAt: "2026-02-01T10:20:00.000Z",
    },
    {
      id: "SO-9002",
      customerId: "C-1002",
      status: "shipped",
      lines: [{ sku: "P-002", qty: 3, unitPrice: 29.0 }],
      total: 87.0,
      currency: "USD",
      createdAt: "2026-02-02T08:00:00.000Z",
    },
  ],
  invoices: [
    {
      id: "INV-5001",
      orderId: "SO-9001",
      status: "issued",
      total: 138.0,
      currency: "USD",
      issuedAt: "2026-02-01T12:00:00.000Z",
    },
  ],
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
      {
        name: "erp_list_customers",
        description: "Mock ERP: Musteri listesini getirir (read-only)",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description: "Opsiyonel: active/inactive",
            },
          },
          required: [],
        },
      },
      {
        name: "erp_get_customer",
        description: "Mock ERP: Musteriyi ID ile getirir",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Musteri ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "erp_list_orders",
        description: "Mock ERP: Siparis listesini getirir",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "open/shipped" },
            customerId: { type: "string", description: "Musteri ID" },
          },
          required: [],
        },
      },
      {
        name: "erp_get_order",
        description: "Mock ERP: Siparisi ID ile getirir",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "Siparis ID" },
          },
          required: ["id"],
        },
      },
      {
        name: "erp_list_invoices",
        description: "Mock ERP: Fatura listesini getirir",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "issued/paid" },
          },
          required: [],
        },
      },
      {
        name: "erp_list_inventory",
        description: "Mock ERP: Stok durumunu getirir",
        inputSchema: {
          type: "object",
          properties: {
            sku: { type: "string", description: "Opsiyonel SKU filtresi" },
            warehouse: {
              type: "string",
              description: "Opsiyonel depo filtresi",
            },
          },
          required: [],
        },
      },
      {
        name: "db_create",
        description:
          "SQLite DB olusturur. Opsiyonel schema_sql ile tablolar yaratir.",
        inputSchema: {
          type: "object",
          properties: {
            schema_sql: {
              type: "string",
              description: "Opsiyonel CREATE TABLE SQL",
            },
          },
          required: [],
        },
      },
      {
        name: "db_list_tables",
        description: "SQLite tablolari listeler (read-only)",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "db_table_schema",
        description: "SQLite tablo semasini getirir (read-only)",
        inputSchema: {
          type: "object",
          properties: {
            table: { type: "string", description: "Tablo adi" },
          },
          required: ["table"],
        },
      },
      {
        name: "db_query",
        description: "SQLite SELECT sorgusu calistirir (read-only)",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string", description: "SELECT sorgusu" },
            params: {
              type: "array",
              items: {},
              description: "Opsiyonel parametreler",
            },
          },
          required: ["sql"],
        },
      },
    ],
  };
});

// Tool cagirilarini isle
async function handleToolCall(name: string, args: unknown) {
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
      const id = (args as any)?.id as number;
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

    case "erp_list_customers": {
      const { status } = (args ?? {}) as { status?: string };
      const data = status
        ? mockErp.customers.filter((c) => c.status === status)
        : mockErp.customers;
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    case "erp_get_customer": {
      const { id } = args as { id: string };
      const customer = mockErp.customers.find((c) => c.id === id);
      if (!customer) {
        throw new McpError(ErrorCode.InvalidRequest, `Musteri bulunamadi: ${id}`);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(customer, null, 2) }],
      };
    }

    case "erp_list_orders": {
      const { status, customerId } = (args ?? {}) as {
        status?: string;
        customerId?: string;
      };
      let data = mockErp.orders;
      if (status) data = data.filter((o) => o.status === status);
      if (customerId) data = data.filter((o) => o.customerId === customerId);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    case "erp_get_order": {
      const { id } = args as { id: string };
      const order = mockErp.orders.find((o) => o.id === id);
      if (!order) {
        throw new McpError(ErrorCode.InvalidRequest, `Siparis bulunamadi: ${id}`);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(order, null, 2) }],
      };
    }

    case "erp_list_invoices": {
      const { status } = (args ?? {}) as { status?: string };
      const data = status
        ? mockErp.invoices.filter((i) => i.status === status)
        : mockErp.invoices;
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    case "erp_list_inventory": {
      const { sku, warehouse } = (args ?? {}) as {
        sku?: string;
        warehouse?: string;
      };
      let data = mockErp.inventory;
      if (sku) data = data.filter((i) => i.sku === sku);
      if (warehouse) data = data.filter((i) => i.warehouse === warehouse);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    case "db_create": {
      const { schema_sql } = (args ?? {}) as { schema_sql?: string };
      // Ensure DB file exists by opening it
      getSqliteDb();
      if (schema_sql) {
        const trimmed = schema_sql.trim().toLowerCase();
        if (!trimmed.startsWith("create")) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            "Sadece CREATE ifadelerine izin veriliyor"
          );
        }
        await sqliteRun(schema_sql);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { ok: true, db_file: SQLITE_FILE },
              null,
              2
            ),
          },
        ],
      };
    }

    case "db_list_tables": {
      const rows = await sqliteAll<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      };
    }

    case "db_table_schema": {
      const { table } = args as { table: string };
      const rows = await sqliteAll(
        `PRAGMA table_info(${table.replace(/[^a-zA-Z0-9_]/g, "")})`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      };
    }

    case "db_query": {
      const { sql, params = [] } = args as {
        sql: string;
        params?: unknown[];
      };
      const trimmed = sql.trim().toLowerCase();
      if (!(trimmed.startsWith("select") || trimmed.startsWith("with"))) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Sadece SELECT/WITH sorgularina izin veriliyor"
        );
      }
      const rows = await sqliteAll(sql, params);
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Bilinmeyen tool: ${name}`);
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const start = Date.now();

  try {
    const result = await handleToolCall(name, args);
    await logToolCall({
      ts: new Date().toISOString(),
      tool: name,
      status: "ok",
      duration_ms: Date.now() - start,
      args,
    });
    return result;
  } catch (err) {
    await logToolCall({
      ts: new Date().toISOString(),
      tool: name,
      status: "error",
      duration_ms: Date.now() - start,
      args,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
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
