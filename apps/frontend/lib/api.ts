/**
 * Centralized API Client
 * All backend communication goes through this module
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
    Photo,
    Event,
    CreatePhotoRequest,
    PhotoStatus,
} from './types';

// Extended response type for presigned URL (includes local mode flag)
interface PresignedUrlResponseExtended {
    uploadUrl: string;
    key: string;
    useLocalUpload?: boolean;
}

// ============================================
// Configuration
// ============================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ============================================
// Axios Instance
// ============================================

const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 seconds
});

// Response interceptor for global error handling
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response?.status === 500) {
            console.error('[API] Server error:', error.response.data);
        }
        if (error.response?.status === 401) {
            console.warn('[API] Unauthorized - redirect to login');
        }
        return Promise.reject(error);
    }
);

// ============================================
// Event API
// ============================================

export async function getEvent(slug: string): Promise<Event> {
    const response = await api.get<Event>(`/api/events/${slug}`);
    return response.data;
}

// ============================================
// Photos API
// ============================================

export async function getPhotos(slug: string): Promise<Photo[]> {
    const response = await api.get<Photo[]>(`/api/event/${slug}/photos`);
    return response.data;
}

export async function getPresignedUrl(
    fileName: string,
    fileType: string
): Promise<PresignedUrlResponseExtended> {
    const response = await api.post<PresignedUrlResponseExtended>('/api/upload/presigned', {
        fileName,
        fileType,
    });
    return response.data;
}

export async function savePhotoMetadata(
    data: CreatePhotoRequest
): Promise<Photo> {
    const response = await api.post<Photo>('/api/photo', data);
    return response.data;
}

export async function updatePhotoStatus(
    photoId: string,
    status: PhotoStatus
): Promise<Photo> {
    const response = await api.patch<Photo>(`/api/admin/photo/${photoId}/status`, {
        status,
    });
    return response.data;
}

// ============================================
// Admin API
// ============================================

export async function getAdminPhotos(slug: string): Promise<Photo[]> {
    const response = await api.get<Photo[]>(`/api/admin/event/${slug}/photos`);
    return response.data;
}

export async function getEventStats(slug: string): Promise<{
    totalPhotos: number;
    pendingCount: number;
    approvedCount: number;
}> {
    const response = await api.get(`/api/admin/event/${slug}/stats`);
    return response.data;
}

// ============================================
// File Upload (handles both S3 and local)
// ============================================

export async function uploadFile(
    presignedResponse: PresignedUrlResponseExtended,
    file: File
): Promise<string> {
    if (presignedResponse.useLocalUpload) {
        // Local upload mode (development)
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post<{ url: string; key: string }>(
            presignedResponse.uploadUrl,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data.url;
    } else {
        // S3 presigned URL upload (production)
        await axios.put(presignedResponse.uploadUrl, file, {
            headers: {
                'Content-Type': file.type,
            },
        });
        return presignedResponse.key;
    }
}

// Legacy function for backwards compatibility
export async function uploadToS3(uploadUrl: string, file: File): Promise<void> {
    await axios.put(uploadUrl, file, {
        headers: {
            'Content-Type': file.type,
        },
    });
}

/**
 * Delete a photo permanently (Admin)
 */
export async function deletePhoto(photoId: string): Promise<Photo> {
    const response = await api.delete(`/api/admin/photo/${photoId}`);
    return response.data;
}

// ============================================
// Background Image API
// ============================================

import { BackgroundImage } from './types';

export async function createBackground(slug: string, url: string, name?: string): Promise<BackgroundImage> {
    const response = await api.post(`/api/admin/event/${slug}/background`, { url, name });
    return response.data;
}

export async function getBackgrounds(slug: string): Promise<BackgroundImage[]> {
    const response = await api.get(`/api/admin/event/${slug}/backgrounds`);
    return response.data;
}

export async function activateBackground(id: string): Promise<BackgroundImage> {
    const response = await api.patch(`/api/admin/background/${id}/activate`);
    return response.data;
}

export async function deactivateAllBackgrounds(slug: string): Promise<void> {
    await api.patch(`/api/admin/event/${slug}/background/deactivate`);
}

export async function deleteBackgroundImage(id: string): Promise<BackgroundImage> {
    const response = await api.delete(`/api/admin/background/${id}`);
    return response.data;
}

export async function getActiveBackground(slug: string): Promise<BackgroundImage | null> {
    const response = await api.get(`/api/event/${slug}/active-background`);
    return response.data;
}

// ============================================
// Export API base URL for WebSocket
// ============================================

export { API_BASE_URL };
