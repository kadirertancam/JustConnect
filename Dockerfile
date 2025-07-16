# Dockerfile for JustConnect V2
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies for sharp (image processing)
RUN apk add --no-cache \
    libc6-compat \
    vips-dev \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S justconnect -u 1001

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p logs uploads uploads/avatars uploads/thumbnails temp

# Set ownership
RUN chown -R justconnect:nodejs /app

# Switch to non-root user
USER justconnect

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["node", "server/server.js"]