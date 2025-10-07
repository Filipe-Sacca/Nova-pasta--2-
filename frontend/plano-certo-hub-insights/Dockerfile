# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage - Simple HTTP server
FROM node:20-alpine

WORKDIR /app

# Install serve globally for serving static files
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start serve
CMD ["serve", "-s", "dist", "-l", "3000", "--no-clipboard"]
