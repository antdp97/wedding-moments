FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma schema & generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code & build
COPY . .
RUN npm run build

# Create uploads directory for local dev fallback
RUN mkdir -p public/uploads

EXPOSE 4000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
