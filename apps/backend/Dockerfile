FROM node:22-alpine

WORKDIR /app

# Install dependencies (including devDependencies for building)
COPY package*.json ./
RUN npm ci

# Copy prisma schema & generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy all source code
COPY . .

# Build the NestJS project (outputs to dist/)
RUN npm run build

# Create uploads directory for local dev fallback
RUN mkdir -p public/uploads

EXPOSE 4000

# Run migrations then start the compiled server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
