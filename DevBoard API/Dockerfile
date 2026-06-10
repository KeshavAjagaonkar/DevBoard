# Stage 1: Build the TypeScript application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Generate Prisma Client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# Prune devDependencies to keep production image small
RUN npm prune --production

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy production dependencies and compiled build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start"]
