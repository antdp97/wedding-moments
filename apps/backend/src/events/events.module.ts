import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { SseController } from './sse.controller';
import { SseEmitterService } from './sse-emitter.service';
import { EventCacheService } from './event-cache.service';
import { AdminStatsDebouncer } from './admin-stats-debouncer.service';
import { SseConnectionTracker } from './sse-connection-tracker.service';

@Module({
    controllers: [EventsController, SseController],
    providers: [
        EventsService,
        SseEmitterService,
        EventCacheService,
        AdminStatsDebouncer,
        SseConnectionTracker,
    ],
    exports: [
        EventsService,
        SseEmitterService,
        EventCacheService,
        AdminStatsDebouncer,
    ],
})
export class EventsModule {}
