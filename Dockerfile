# Base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies (only production)
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose API and WebSocket port
EXPOSE 8000

# Set environment to production in container
ENV NODE_ENV=production

# Start command
CMD ["node", "api_qq_monitor.js"]
