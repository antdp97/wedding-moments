import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SseEmitterService } from './sse-emitter.service';
import { PhotoStatus } from '@prisma/client';

/**
 * Trailing-edge debouncer for admin stats SSE emissions.
 *
 * Problem: When 50 guests upload simultaneously with autoApprove,
 * each `photo.create()` fires a separate `groupBy` query — 50 identical
 * heavy queries within milliseconds. Only the last result matters.
 *
 * Solution: Coalesce rapid-fire calls into a single DB query after
 * a 500ms quiet period. 50 uploads → 1 groupBy query.
 */
@Injectable()
export class AdminStatsDebouncer implements OnModuleDestroy {
    private readonly logger = new Logger(AdminStatsDebouncer.name);
    private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

    /** Debounce window in milliseconds */
    private readonly DEBOUNCE_MS = 500;

    constructor(
        private readonly prisma: PrismaService,
        private readonly sseEmitter: SseEmitterService,
    ) {}

    /**
     * Schedule a debounced stats emission for the given event.
     * If called multiple times within DEBOUNCE_MS, only the last one fires.
     */
    schedule(eventSlug: string, eventId: string): void {
        const key = eventId;

        // Clear any pending timer for this event
        const existing = this.pending.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        // Set a new trailing-edge timer
        const timer = setTimeout(() => {
            this.pending.delete(key);
            this.emitStats(eventSlug, eventId);
        }, this.DEBOUNCE_MS);

        this.pending.set(key, timer);
    }

    /**
     * Cleanup all pending timers on shutdown.
     */
    onModuleDestroy(): void {
        for (const timer of this.pending.values()) {
            clearTimeout(timer);
        }
        this.pending.clear();
    }

    private async emitStats(eventSlug: string, eventId: string): Promise<void> {
        try {
            const counts = await this.prisma.photo.groupBy({
                by: ['status'],
                where: { eventId },
                _count: { status: true },
            });

            const totalPhotos = counts.reduce(
                (sum, g) => sum + g._count.status,
                0,
            );
            const pendingCount =
                counts.find((g) => g.status === PhotoStatus.PENDING)?._count
                    .status ?? 0;

            this.sseEmitter.emitAdminStats(eventSlug, {
                totalPhotos,
                pendingCount,
            });
        } catch (err) {
            this.logger.warn(
                `Failed to emit debounced stats for event ${eventSlug}`,
                err,
            );
        }
    }
}
