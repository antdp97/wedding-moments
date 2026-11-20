import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { PhotosModule } from './photos/photos.module';
import { EventsModule } from './events/events.module';
import { S3Module } from './s3/s3.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'upload', ttl: 60000, limit: 10 },
      { name: 'global', ttl: 60000, limit: 120 },
    ]),
    PrismaModule,
    S3Module,
    EventsModule,
    PhotosModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
