import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    PrismaModule,
    S3Module,
    EventsModule,
    PhotosModule,
  ],
})
export class AppModule { }
