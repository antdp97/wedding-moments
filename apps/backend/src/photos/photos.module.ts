import { Module, forwardRef } from '@nestjs/common';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';
import { S3Module } from '../s3/s3.module';
import { EventsModule } from '../events/events.module';

@Module({
    imports: [S3Module, forwardRef(() => EventsModule)],
    controllers: [PhotosController],
    providers: [PhotosService],
    exports: [PhotosService],
})
export class PhotosModule { }
