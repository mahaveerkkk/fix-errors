# ============================================
# StylQ Backend - Production Dockerfile
# Base: Node.js 20 Alpine (Lightweight & Secure)
# ============================================
FROM node:20-alpine

# Set environment
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Install build dependencies if needed (e.g. for bcryptjs / node-gyp)
RUN apk add --no-cache python3 make g++

# Copy package manifests first for efficient Docker layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts || npm install --omit=dev

# Copy application source code
COPY . .

# Expose backend port
EXPOSE 5000

# Healthcheck to ensure container is responsive
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/ || exit 1

# Start server
CMD ["node", "server.js"]
