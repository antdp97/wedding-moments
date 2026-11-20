import {
    Controller,
    Param,
    Req,
    Sse,
    MessageEvent,
    Logger,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { SseConnectionTracker } from './sse-connection-tracker.service';

/**
 * SSE controller with explicit connection lifecycle management.
 *
 * Previous implementation used `fromEvent` + `merge` which relied on
 * Observable teardown for cleanup. NestJS's @Sse() does not always
 * trigger teardown on client disconnect, causing:
 * - EventEmitter2 listener leaks
 * - interval timers ticking for dead connections
 * - unbounded memory growth over time
 *
 * This rewrite uses manual `new Observable()` with `req.on('close')`
 * to guarantee cleanup when clients disconnect.
 */
@Controller('api/stream')
export class SseController {
    private readonly logger = new Logger(SseController.name);

    constructor(
        private readonly eventEmitter: EventEmitter2,
        private readonly connectionTracker: SseConnectionTracker,
    ) {}

    /**
     * SSE endpoint for Live Wall (Slideshow page)
     * Events: photo_approved, photo_removed, background_changed, heartbeat, shutdown
     */
    @SkipThrottle()
    @Sse('event/:slug')
    streamEvent(
        @Param('slug') slug: string,
        @Req() req: Request,
    ): Observable<MessageEvent> {
        const connectionId = uuidv4();

        if (!this.connectionTracker.canAccept(slug)) {
            throw new HttpException(
                `SSE connection limit reached for event ${slug}`,
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }

        return new Observable<MessageEvent>((subscriber) => {
            this.connectionTracker.add(slug, connectionId);
            let cleaned = false;

            // --- Named listener functions for explicit removal ---

            const onPhotoApproved = (photo: unknown): void => {
                if (!cleaned) {
                    subscriber.next({
                        data: { type: 'photo_approved', payload: photo },
                    } as MessageEvent);
                }
            };

            const onPhotoRemoved = (data: unknown): void => {
                if (!cleaned) {
                    subscriber.next({
                        data: { type: 'photo_removed', payload: data },
                    } as MessageEvent);
                }
            };

            const onBgChanged = (data: unknown): void => {
                if (!cleaned) {
                    subscriber.next({
                        data: { type: 'background_changed', payload: data },
                    } as MessageEvent);
                }
            };

            const onShutdown = (data: unknown): void => {
                if (!cleaned) {
                    subscriber.next({
                        data: { type: 'shutdown', payload: data },
                    } as MessageEvent);
                }
            };

            // Register listeners
            this.eventEmitter.on(`photo.approved.${slug}`, onPhotoApproved);
            this.eventEmitter.on(`photo.removed.${slug}`, onPhotoRemoved);
            this.eventEmitter.on(`background.changed.${slug}`, onBgChanged);
            this.eventEmitter.on(`system.shutdown.${slug}`, onShutdown);

            // Heartbeat every 30s to keep Railway proxy alive
            const heartbeatInterval = setInterval(() => {
                if (!cleaned) {
                    subscriber.next({
                        data: { type: 'heartbeat' },
                    } as MessageEvent);
                }
            }, 30_000);

            // --- Cleanup on client disconnect ---
            // Guard prevents double execution from req.on('close') + Observable teardown
            const cleanup = (): void => {
                if (cleaned) return;
                cleaned = true;

                clearInterval(heartbeatInterval);
                this.eventEmitter.removeListener(`photo.approved.${slug}`, onPhotoApproved);
                this.eventEmitter.removeListener(`photo.removed.${slug}`, onPhotoRemoved);
                this.eventEmitter.removeListener(`background.changed.${slug}`, onBgChanged);
                this.eventEmitter.removeListener(`system.shutdown.${slug}`, onShutdown);
                this.connectionTracker.remove(slug, connectionId);
                subscriber.complete();
            };

            req.on('close', cleanup);

            // Also handle Observable unsubscribe (e.g. NestJS teardown)
            return cleanup;
        });
    }

    /**
     * SSE endpoint for Admin Dashboard
     * Events: admin_stat_update, photo_approved, heartbeat, shutdown
     */
    @SkipThrottle()
    @Sse('admin/:slug')
    streamAdmin(
        @Param('slug') slug: string,
        @Req() req: Request,
    ): Observable<MessageEvent> {
        const connectionId = uuidv4();

        if (!this.connectionTracker.canAccept(slug)) {
            throw new HttpException(
                `SSE connection limit reached for event ${slug}`,
                HttpStatus.SERVICE_UNAVAILABLE,
            );
        }

        return new Observable<MessageEvent>((subscriber) => {
            this.connectionTracker.add(slug, connectionId);
            let cleaned = false;

            const onStatUpdate = (stats: unknown): void => {
                if (!cleaned) {
                    subscriber.next({
                        data: { type: 'admin_stat_update', payload: stats },
                    } as MessageEvent);
                }
            };

            const onPhotoApproved = (photo: unknown): void => {
                if (!cleaned) {
                    subscriber.next({
                        data: { type: 'photo_approved', payload: photo },
                    } as MessageEvent);
                }
            };

            const onShutdown = (data: unknown): void => {
                if (!cleaned) {
                    subscriber.next({
                        data: { type: 'shutdown', payload: data },
                    } as MessageEvent);
                }
            };

            this.eventEmitter.on(`admin.stats.${slug}`, onStatUpdate);
            this.eventEmitter.on(`photo.approved.${slug}`, onPhotoApproved);
            this.eventEmitter.on(`system.shutdown.${slug}`, onShutdown);

            const heartbeatInterval = setInterval(() => {
                if (!cleaned) {
                    subscriber.next({
                        data: { type: 'heartbeat' },
                    } as MessageEvent);
                }
            }, 30_000);

            const cleanup = (): void => {
                if (cleaned) return;
                cleaned = true;

                clearInterval(heartbeatInterval);
                this.eventEmitter.removeListener(`admin.stats.${slug}`, onStatUpdate);
                this.eventEmitter.removeListener(`photo.approved.${slug}`, onPhotoApproved);
                this.eventEmitter.removeListener(`system.shutdown.${slug}`, onShutdown);
                this.connectionTracker.remove(slug, connectionId);
                subscriber.complete();
            };

            req.on('close', cleanup);

            return cleanup;
        });
    }
}
