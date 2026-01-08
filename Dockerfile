# Build stage
FROM node:20 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including esbuild for bundling)
RUN npm install --ignore-scripts
RUN npm install -g esbuild

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Bundle the server into a single ESM file
RUN esbuild dist/server.js --bundle --platform=node --target=node20 \
    --format=esm \
    --outfile=dist/server.bundle.mjs \
    --external:ajv \
    --external:ajv-formats

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Install only runtime dependencies directly
RUN npm init -y && npm install ajv@8.12.0 ajv-formats@2.1.1 --save

# Copy bundled server and schemas
COPY --from=builder /app/dist/server.bundle.mjs ./server.mjs
COPY --from=builder /app/schemas ./schemas

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Run the server
CMD ["node", "server.mjs"]
