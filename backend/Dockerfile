# ============================================
# Stage 1: Builder
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies only (leverages Docker cache)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ============================================
# Stage 2: Production image
# ============================================
FROM node:20-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001 -G nodejs

WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder --chown=nodeapp:nodejs /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodeapp:nodejs src/ ./src/
COPY --chown=nodeapp:nodejs package.json ./

# Set environment
ENV NODE_ENV=production \
    PORT=5000

# Switch to non-root user
USER nodeapp

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "src/server.js"]
