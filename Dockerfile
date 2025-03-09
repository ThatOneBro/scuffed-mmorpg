FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY packages/common/package*.json ./packages/common/
COPY packages/game/package*.json ./packages/game/
COPY packages/server/package*.json ./packages/server/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY turbo.json ./
COPY packages/common/package*.json ./packages/common/
COPY packages/game/package*.json ./packages/game/
COPY packages/server/package*.json ./packages/server/

# Install production dependencies only
RUN npm install --production

# Copy built files from builder stage
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/game/dist ./packages/game/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "packages/server/dist/index.js"] 