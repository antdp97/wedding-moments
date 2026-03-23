import { Controller, Param, Sse, MessageEvent } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent, map, merge, interval } from 'rxjs';

@Controller('api/stream')
export class SseController {
    constructor(private readonly eventEmitter: EventEmitter2) {}

    /**
     * SSE endpoint for Live Wall (Slideshow page)
     * Replaces: socket.emit('join_event', { eventSlug })
     * Events: photo_approved, photo_removed, background_changed
     */
    @Sse('event/:slug')
    streamEvent(@Param('slug') slug: string): Observable<MessageEvent> {
        const photoApproved$ = fromEvent(
            this.eventEmitter,
            `photo.approved.${slug}`,
        ).pipe(
            map(
                (photo) =>
                    ({
                        data: { type: 'photo_approved', payload: photo },
                    }) as MessageEvent,
            ),
        );

        const photoRemoved$ = fromEvent(
            this.eventEmitter,
            `photo.removed.${slug}`,
        ).pipe(
            map(
                (data) =>
                    ({
                        data: { type: 'photo_removed', payload: data },
                    }) as MessageEvent,
            ),
        );

        const bgChanged$ = fromEvent(
            this.eventEmitter,
            `background.changed.${slug}`,
        ).pipe(
            map(
                (data) =>
                    ({
                        data: { type: 'background_changed', payload: data },
                    }) as MessageEvent,
            ),
        );

        // Heartbeat every 30s to keep Railway proxy alive
        const heartbeat$ = interval(30000).pipe(
            map(() => ({ data: { type: 'heartbeat' } }) as MessageEvent),
        );

        return merge(photoApproved$, photoRemoved$, bgChanged$, heartbeat$);
    }

    /**
     * SSE endpoint for Admin Dashboard
     * Replaces: socket.emit('join_admin', { eventSlug })
     * Events: admin_stat_update, photo_approved
     */
    @Sse('admin/:slug')
    streamAdmin(@Param('slug') slug: string): Observable<MessageEvent> {
        const statUpdate$ = fromEvent(
            this.eventEmitter,
            `admin.stats.${slug}`,
        ).pipe(
            map(
                (stats) =>
                    ({
                        data: { type: 'admin_stat_update', payload: stats },
                    }) as MessageEvent,
            ),
        );

        const photoApproved$ = fromEvent(
            this.eventEmitter,
            `photo.approved.${slug}`,
        ).pipe(
            map(
                (photo) =>
                    ({
                        data: { type: 'photo_approved', payload: photo },
                    }) as MessageEvent,
            ),
        );

        const heartbeat$ = interval(30000).pipe(
            map(() => ({ data: { type: 'heartbeat' } }) as MessageEvent),
        );

        return merge(statUpdate$, photoApproved$, heartbeat$);
    }
}
