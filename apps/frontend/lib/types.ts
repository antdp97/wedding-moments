/**
 * Shared TypeScript types for Frontend-Backend communication
 * These types match the Backend DTOs
 */

// ============================================
// ENUMS
// ============================================

export enum PhotoStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

// ============================================
// API Response Types
// ============================================

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

export interface Event {
    id: string;
    slug: string;
    name: string;
    hostId: string;
    qrCodeUrl?: string | null;
    settings: EventSettings;
    isActive: boolean;
    createdAt: string;
}

export interface EventSettings {
    autoApprove?: boolean;
    theme?: string;
}

export interface PresignedUrlResponse {
    uploadUrl: string;
    key: string;
}

// ============================================
// API Request Types
// ============================================

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

export interface GetPresignedUrlRequest {
    fileName: string;
    fileType: string;
}

// ============================================
// WebSocket Event Payloads
// ============================================

export interface AdminStatUpdate {
    totalPhotos: number;
    pendingCount: number;
}

export interface BackgroundImage {
    id: string;
    eventId: string;
    url: string;
    name?: string | null;
    isActive: boolean;
    createdAt: string;
}

export interface EventWithCounts extends Event {
    _count: {
        photos: number;
    };
}
