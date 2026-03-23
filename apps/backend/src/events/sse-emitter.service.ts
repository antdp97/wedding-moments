import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SseEmitterService {
    private logger = new Logger('SseEmitterService');

    constructor(private readonly eventEmitter: EventEmitter2) {}

    emitPhotoApproved(eventSlug: string, photo: object): void {
        this.eventEmitter.emit(`photo.approved.${eventSlug}`, photo);
        this.logger.log(`Emitted photo.approved.${eventSlug}`);
    }

    emitAdminStats(
        eventSlug: string,
        stats: { totalPhotos: number; pendingCount: number },
    ): void {
        this.eventEmitter.emit(`admin.stats.${eventSlug}`, stats);
        this.logger.log(`Emitted admin.stats.${eventSlug}`);
    }

    emitPhotoRemoved(eventSlug: string, photoId: string): void {
        this.eventEmitter.emit(`photo.removed.${eventSlug}`, { id: photoId });
        this.logger.log(`Emitted photo.removed.${eventSlug} (${photoId})`);
    }

    emitBackgroundChanged(
        eventSlug: string,
        backgroundUrl: string | null,
    ): void {
        this.eventEmitter.emit(`background.changed.${eventSlug}`, {
            url: backgroundUrl,
        });
        this.logger.log(`Emitted background.changed.${eventSlug}`);
    }
}
