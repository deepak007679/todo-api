# Multi-stage Dockerfile for optimized production image
# Stage 1: Dependency resolution
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# Stage 2: Minimal runtime environment
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Security hardening: run as non-root user
USER node

EXPOSE 3000
CMD ["node", "index.js"]
