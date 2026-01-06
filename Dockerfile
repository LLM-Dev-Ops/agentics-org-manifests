FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN npm install -g esbuild

COPY . .
RUN esbuild server.ts --bundle --platform=node --target=node20 --outfile=dist/server.bundle.js --external:hnswlib-node

FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/dist/server.bundle.js ./server.js
COPY --from=builder /app/schemas ./schemas

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
