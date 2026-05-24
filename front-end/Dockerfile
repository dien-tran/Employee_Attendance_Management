# ============================================================
# STAGE 1: Build Next.js Frontend (Static Export)
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build static export
RUN npm run build

# ============================================================
# STAGE 2: Nginx Production Server
# ============================================================
FROM nginx:1.25-alpine

# Copy nginx template. The official nginx entrypoint renders environment
# variables from /etc/nginx/templates/*.template at container startup.
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built static files from builder stage
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
