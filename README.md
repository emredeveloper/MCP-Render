# MCP Server - Render Deployment (SSE Transport)

Bu proje, **Model Context Protocol (MCP)** server'ının **SSE (Server-Sent Events)** transport ile Render'da çalıştırılması için bir örnek uygulamadır.

## Özellikler

- **HTTP + SSE Transport:** Render'da Web Service olarak çalışır
- **Tools:**
  - `get_users`: Tüm kullanıcıları listele
  - `get_user_by_id`: ID'ye göre kullanıcı getir
  - `get_server_stats`: Server istatistiklerini getir
  - `calculate`: Basit matematik işlemleri (toplama, çıkarma, çarpma, bölme)
- **Resources:**
  - `data://users`: Kullanıcı listesi (JSON)
  - `data://stats`: Server istatistikleri (JSON)

## Endpoint'ler

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/` | GET | API bilgisi |
| `/health` | GET | Health check (Render için) |
| `/sse` | GET | SSE bağlantısı (MCP client buraya bağlanır) |
| `/message` | POST | MCP mesajları (Client'tan server'a) |

## Yerel Geliştirme

```bash
# Bağımlılıkları yükle
npm install

# TypeScript'i derle
npm run build

# Server'ı çalıştır
npm start

# Geliştirme modunda izle
npm run dev
```

Server `http://localhost:8080` adresinde çalışacaktır.

## Render'da Deploy Etme

### 1. GitHub'a Push Et

```bash
git init
git add .
git commit -m "MCP Server SSE"
git remote add origin https://github.com/kullaniciadiniz/mcp-server-sse.git
git push -u origin main
```

### 2. Render'da Yeni Web Service Oluştur

1. [Render Dashboard](https://dashboard.render.com/)'a giriş yap
2. **New > Web Service** seç
3. GitHub reposunu bağla
4. Aşağıdaki ayarları yap:
   - **Runtime:** Docker
   - **Plan:** Free (veya istediğiniz plan)
   - **Dockerfile Path:** `./Dockerfile`
   - **Port:** `8080`
5. **Deploy**'a tıkla

### 3. Blueprint ile Deploy (Alternatif)

`render.yaml` dosyası sayesinde Blueprint kullanabilirsin:

1. [Render Blueprints](https://dashboard.render.com/blueprints) sayfasına git
2. **New Blueprint Instance** seç
3. GitHub reposunu seç
4. Deploy'a tıkla

## MCP Client Kullanımı

SSE transport ile çalışan MCP server'a bağlanmak için client'ın SSE URL'sini kullanması gerekir.

### Claude Desktop Config (örnek)

```json
{
  "mcpServers": {
    "render-server": {
      "url": "https://your-service.onrender.com/sse"
    }
  }
}
```

### Yerel Geliştirme için

```json
{
  "mcpServers": {
    "local-server": {
      "url": "http://localhost:8080/sse"
    }
  }
}
```

## API Test Etme

### Health Check
```bash
curl http://localhost:8080/health
```

### SSE Bağlantısı (yeni terminalde)
```bash
curl http://localhost:8080/sse
```

### MCP Message Gönderme
```bash
curl -X POST http://localhost:8080/message \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

## Proje Yapısı

```
.
├── src/
│   └── index.ts          # MCP Server kodu (Express + SSE)
├── dist/                 # Derlenmiş JavaScript (build sonrası)
├── Dockerfile            # Docker imajı için
├── render.yaml           # Render blueprint
├── package.json          # NPM bağımlılıkları
├── tsconfig.json         # TypeScript ayarları
└── README.md             # Bu dosya
```

## Teknolojiler

- **@modelcontextprotocol/sdk:** MCP Server SDK
- **Express:** HTTP framework
- **SSE:** Server-Sent Events transport
- **TypeScript:** Tip güvenli geliştirme
- **Docker:** Containerization
- **Render:** Cloud deployment

## Lisans

MIT
