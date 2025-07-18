# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

# Copy built app from builder stage
COPY --from=builder /app ./

# ✅ Make converter binary executable AFTER copying
RUN chmod +x /app/converters/FBX2glTF-linux-x64
RUN chmod +x /app/converters/IfcConvert-linux64


EXPOSE 5000
CMD ["node", "server.js"]
