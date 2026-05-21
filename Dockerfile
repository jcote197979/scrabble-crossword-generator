# Stage 1: Build the Vite frontend application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package configuration files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the frontend assets
RUN npm run build

# Stage 2: Create a lightweight runtime image
FROM node:20-alpine

WORKDIR /app

# Set production environment variable
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled frontend build assets from the builder stage
COPY --from=builder /app/dist ./dist

# Copy public assets (contains default fonts, textures, etc.)
COPY --from=builder /app/public ./public

# Copy src directory (required for SVG generation on backend)
COPY --from=builder /app/src ./src

# Copy server code
COPY --from=builder /app/server.js ./

# Expose port 3000 to the outside
EXPOSE 3000

# Start the Express server
CMD ["npm", "start"]
