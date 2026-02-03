# Build aşaması
FROM node:20-alpine AS builder

WORKDIR /app

# Önce bağımlılıkları kopyala ve yükle (tüm bağımlılıklar dahil)
COPY package*.json ./
RUN npm install

# Kaynak kodları kopyala ve derle
COPY . .
RUN npm run build

# Production aşaması
FROM node:20-alpine

WORKDIR /app

# Sadece production bağımlılıklarını yükle (scriptleri çalıştırma)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Sadece derlenmiş dosyaları builder aşamasından kopyala
COPY --from=builder /app/dist ./dist

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/index.js"]
