FROM node:16-alpine AS builder

# Set the working directory in the builder stage
WORKDIR /app

# Copy package files to install only production dependencies
COPY package*.json ./

# Install production dependencies
RUN npm install

# Copy only the server folder from the project
COPY server/ ./server

FROM node:16-alpine

# Set the working directory in the final image
WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy only the server folder from builder
COPY --from=builder /app/server ./server

# Change directory to the server folder
WORKDIR /app/server

# Expose the port that the server listens on (adjust if needed)
EXPOSE 3000

# Start the server
CMD ["node", "index.js"] 