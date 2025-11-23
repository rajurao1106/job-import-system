# ---------- Base Image ----------
FROM node:18-alpine AS server

WORKDIR /app

# Install backend dependencies
COPY server/package*.json ./server/
RUN cd server && npm install

# Copy backend source
COPY server ./server

# Expose backend port
EXPOSE 4000

# Start server
CMD ["npm", "run", "start", "--prefix", "server"]
