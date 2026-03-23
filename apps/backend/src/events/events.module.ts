import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { SseController } from './sse.controller';
import { SseEmitterService } from './sse-emitter.service';

@Module({
    controllers: [EventsController, SseController],
    providers: [EventsService, SseEmitterService],
    exports: [EventsService, SseEmitterService],
})
export class EventsModule {}
