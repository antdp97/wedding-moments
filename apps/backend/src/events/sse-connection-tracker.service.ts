import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Tracks active SSE connections per event slug.
 *
 * Responsibilities:
 * 1. Count active connections to enforce per-event limits
 * 2. Provide cleanup hooks for explicit listener removal on disconnect
 * 3. Emit shutdown events on graceful shutdown so clients can jitter reconnect
 */
@Injectable()
export class SseConnectionTracker implements OnModuleDestroy {
    private readonly logger = new Logger(SseConnectionTracker.name);

    /** slug → Set<connectionId> */
    private readonly connections = new Map<string, Set<string>>();

    /** Maximum SSE connections per event (Live Wall + Admin + guests viewing) */
    private readonly MAX_PER_EVENT = 200;

    constructor(private readonly eventEmitter: EventEmitter2) {}

    /**
     * Register a new SSE connection. Returns false if the limit is reached.
     */
    add(slug: string, connectionId: string): boolean {
        if (!this.canAccept(slug)) {
            this.logger.warn(
                `SSE connection limit reached for event ${slug} (${this.MAX_PER_EVENT})`,
            );
            return false;
        }

        let set = this.connections.get(slug);
        if (!set) {
            set = new Set();
            this.connections.set(slug, set);
        }
        set.add(connectionId);

        this.logger.debug(
            `SSE connected: ${connectionId} (event=${slug}, total=${set.size})`,
        );
        return true;
    }

    /**
     * Unregister an SSE connection (called on client disconnect).
     */
    remove(slug: string, connectionId: string): void {
        const set = this.connections.get(slug);
        if (set) {
            set.delete(connectionId);
            if (set.size === 0) {
                this.connections.delete(slug);
            }
            this.logger.debug(
                `SSE disconnected: ${connectionId} (event=${slug}, remaining=${set.size})`,
            );
        }
    }

    /**
     * Get the number of active connections for an event.
     */
    getCount(slug: string): number {
        return this.connections.get(slug)?.size ?? 0;
    }

    /**
     * Check if a new connection can be accepted for this event.
     */
    canAccept(slug: string): boolean {
        return this.getCount(slug) < this.MAX_PER_EVENT;
    }

    /**
     * On graceful shutdown, emit a system event so SSE streams can
     * notify clients to delay reconnection (avoids thundering herd).
     */
    async onModuleDestroy(): Promise<void> {
        const totalConnections = Array.from(this.connections.values()).reduce(
            (sum, set) => sum + set.size,
            0,
        );
        this.logger.log(
            `Graceful shutdown: draining ${totalConnections} SSE connections`,
        );

        for (const slug of this.connections.keys()) {
            this.eventEmitter.emit(`system.shutdown.${slug}`, {
                retryAfter: 5000,
            });
        }

        // Allow 2 seconds for shutdown events to flush to clients
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.connections.clear();
    }
}
