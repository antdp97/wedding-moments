import { Injectable, Logger } from '@nestjs/common';

/**
 * In-memory TTL cache for Event objects.
 *
 * Why: During a burst of 50 concurrent uploads to the same event,
 * `event.findUnique()` is called 50+ times for the same row.
 * This cache reduces those to 1 DB read + 49 cache hits.
 *
 * Dual-key maps (by `id` and by `slug`) because different code paths
 * look up events by different keys.
 *
 * Single-process safe — no Redis required.
 */

export interface CachedEvent {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly hostId: string;
    readonly settings: unknown;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly qrCodeUrl: string | null;
}

interface CacheEntry {
    readonly event: CachedEvent;
    readonly expiresAt: number;
}

@Injectable()
export class EventCacheService {
    private readonly logger = new Logger(EventCacheService.name);
    private readonly byId = new Map<string, CacheEntry>();
    private readonly bySlug = new Map<string, CacheEntry>();

    /** Cache TTL in milliseconds (60 seconds) */
    private readonly TTL_MS = 60_000;

    /**
     * Retrieve a cached event by its `id` or `slug`.
     * Returns `null` if not cached or expired.
     */
    get(key: string): CachedEvent | null {
        const entry = this.byId.get(key) ?? this.bySlug.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            // Expired — evict and return miss
            this.evict(entry.event);
            return null;
        }

        return entry.event;
    }

    /**
     * Store an event in both maps with a fresh TTL.
     */
    set(event: CachedEvent): void {
        const entry: CacheEntry = {
            event,
            expiresAt: Date.now() + this.TTL_MS,
        };
        this.byId.set(event.id, entry);
        this.bySlug.set(event.slug, entry);
    }

    /**
     * Invalidate cache for an event by `id` or `slug`.
     * Call this after any mutation (updateSettings, delete, etc.).
     */
    invalidate(key: string): void {
        const entry = this.byId.get(key) ?? this.bySlug.get(key);
        if (entry) {
            this.evict(entry.event);
            this.logger.debug(`Cache invalidated for event ${key}`);
        }
    }

    private evict(event: CachedEvent): void {
        this.byId.delete(event.id);
        this.bySlug.delete(event.slug);
    }
}
