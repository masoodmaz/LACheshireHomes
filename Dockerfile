# ---- Build stage ----
# Node.js official image — slim variant keeps the image small.
# The app uses node:sqlite (built-in in Node 22+), so no native addon build tools needed.
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifest files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Runtime stage ----
FROM node:22-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy installed node_modules from build stage
COPY --from=build /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create directories that need to be writable at runtime
RUN mkdir -p data public/uploads/images public/uploads/videos && \
    chown -R appuser:appgroup data public/uploads

# Switch to non-root user
USER appuser

# Default environment variables (can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
ENV SESSION_SECRET=change-me-to-a-random-string

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/ || exit 1

EXPOSE 5000

CMD ["node", "server.js"]
