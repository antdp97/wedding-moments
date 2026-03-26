import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Graceful shutdown — ensures onModuleDestroy hooks fire (Prisma disconnect, SSE drain)
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);

  // Security headers
  app.use(helmet({
    crossOriginEmbedderPolicy: false, // required for SSE in some browsers
    contentSecurityPolicy: false,     // enable in Phase 4 after auth
  }));

  // Gzip compression — reduces JSON payload size ~70%
  app.use(compression());

  // Serve static files from public/uploads
  app.useStaticAssets(join(__dirname, '..', 'public/uploads'), {
    prefix: '/uploads/',
  });

  // CORS driven by env var — no more hardcoded origin list
  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      // Allow any Vercel preview deployment automatically
      if (origin.endsWith('.vercel.app')) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.get<number>('PORT', 4000);
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}`);
}
bootstrap();
