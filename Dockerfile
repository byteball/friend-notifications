# Use official Node.js LTS image (Debian-based for better compatibility)
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install build dependencies for native modules (rocksdb, etc.)
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create directory for database and keys
RUN mkdir -p /app/data

# Expose webserver port
EXPOSE 3050

# Expose Telegram webhook port (default 3000)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV testnet=1
# Run the application
CMD ["node", "run.js"]
