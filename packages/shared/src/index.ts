/**
 * @wedding-moments/shared
 *
 * The API contract between the frontend (Next.js) and backend (NestJS).
 * Both apps import from here, so a change to a shape breaks the build of
 * whichever side is out of date instead of failing at runtime.
 *
 * Rules for this package:
 * - Types and plain constants only. No framework imports (no Nest, React, Prisma).
 * - Dates travel over JSON as ISO strings, so response types use `string`.
 */

// ============================================
// ENUMS
// ============================================

/**
 * Declared as a const object + union type instead of a TS `enum` so it is
 * structurally identical to Prisma's generated `PhotoStatus` on the backend
 * (a plain string union) and still usable as `PhotoStatus.APPROVED` on the frontend.
 */
export const PhotoStatus = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
} as const;
export type PhotoStatus = (typeof PhotoStatus)[keyof typeof PhotoStatus];

// ============================================
// DOMAIN / RESPONSE TYPES
// ============================================

export interface EventSettings {
    autoApprove?: boolean;
    theme?: string;
}

export interface Event {
    id: string;
    slug: string;
    name: string;
    hostId: string;
    qrCodeUrl?: string | null;
    settings: EventSettings;
    isActive: boolean;
    createdAt: string; // ISO date string
}

export interface EventWithCounts extends Event {
    _count: {
        photos: number;
    };
}

export interface Photo {
    id: string;
    eventId: string;
    url: string;
    thumbnailUrl?: string | null;
    senderName?: string | null;
    message?: string | null;
    status: PhotoStatus;
    createdAt: string; // ISO date string
}

export interface BackgroundImage {
    id: string;
    eventId: string;
    url: string;
    name?: string | null;
    isActive: boolean;
    createdAt: string; // ISO date string
}

export interface PresignedUrlResponse {
    uploadUrl: string;
    key: string;
}

export interface AdminStats {
    totalPhotos: number;
    pendingCount: number;
}

/** @deprecated kept for backwards compatibility, use `AdminStats` */
export type AdminStatUpdate = AdminStats;

// ============================================
// REQUEST BODIES (backend DTO classes implement these)
// ============================================

export interface GetPresignedUrlRequest {
    fileName: string;
    fileType: string;
}

export interface CreatePhotoRequest {
    eventId: string;
    url: string;
    senderName?: string;
    message?: string;
    mimeType?: string;
}

export interface UpdatePhotoStatusRequest {
    status: PhotoStatus;
}

export interface CreateEventRequest {
    name: string;
    slug: string;
    hostId: string;
}

// ============================================
// SERVER-SENT EVENTS
// ============================================

/** Base path of the SSE endpoints (relative to the API origin). */
export const SSE_ROUTES = {
    liveWall: (slug: string) => `/api/stream/event/${slug}`,
    admin: (slug: string) => `/api/stream/admin/${slug}`,
} as const;

export interface PhotoRemovedPayload {
    id: string;
}

export interface BackgroundChangedPayload {
    url: string | null;
}

export interface ShutdownPayload {
    /** Max milliseconds the client should wait (with jitter) before reconnecting. */
    retryAfter: number;
}

/**
 * Discriminated unions: switching on `type` narrows `payload` automatically.
 *
 *   switch (msg.type) {
 *     case 'photo_removed': msg.payload.id  // payload is PhotoRemovedPayload here
 *   }
 */
export type LiveWallSseMessage =
    | { type: 'photo_approved'; payload: Photo }
    | { type: 'photo_removed'; payload: PhotoRemovedPayload }
    | { type: 'background_changed'; payload: BackgroundChangedPayload }
    | { type: 'shutdown'; payload: ShutdownPayload }
    | { type: 'heartbeat' };

export type AdminSseMessage =
    | { type: 'admin_stat_update'; payload: AdminStats }
    | { type: 'photo_approved'; payload: Photo }
    | { type: 'shutdown'; payload: ShutdownPayload }
    | { type: 'heartbeat' };

export type SseMessageType = (LiveWallSseMessage | AdminSseMessage)['type'];
