# Use official Node.js runtime as base image
FROM node:22-alpine

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application code and entrypoint
COPY . .
COPY docker-entrypoint.sh /usr/local/bin/

# Create directory for cached images
RUN mkdir -p /app/covers

# Expose port
EXPOSE 8080

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S coce -u 1001 -G nodejs

# Change ownership of app directory and make entrypoint executable
RUN chown -R coce:nodejs /app && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER coce

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Set entrypoint and default command
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "start"]
