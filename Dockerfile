# Base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies (including devDependencies needed for ts-node/typescript runtime)
RUN npm ci

# Copy application source code
COPY . .

# Expose API and WebSocket port
EXPOSE 8000

# Set environment to production in container
ENV NODE_ENV=production

# Start command with ts-node support for TypeScript modules
CMD ["npx", "ts-node", "--files", "api_qq_monitor.js"]
