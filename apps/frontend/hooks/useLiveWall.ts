/**
 * Custom WebSocket hook for Live Wall real-time updates
 */
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Photo } from '@/lib/types';
import { API_BASE_URL } from '@/lib/api';

interface UseLiveWallOptions {
    eventSlug: string;
    onPhotoApproved?: (photo: Photo) => void;
    onPhotoRemoved?: (photoId: string) => void;
}

interface UseLiveWallReturn {
    isConnected: boolean;
    connectionError: string | null;
}

export function useLiveWall({
    eventSlug,
    onPhotoApproved,
    onPhotoRemoved,
}: UseLiveWallOptions): UseLiveWallReturn {
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Stable callback refs
    const onPhotoApprovedRef = useRef(onPhotoApproved);
    const onPhotoRemovedRef = useRef(onPhotoRemoved);

    useEffect(() => {
        onPhotoApprovedRef.current = onPhotoApproved;
    }, [onPhotoApproved]);

    useEffect(() => {
        onPhotoRemovedRef.current = onPhotoRemoved;
    }, [onPhotoRemoved]);

    useEffect(() => {
        if (!eventSlug) return;

        // Initialize socket connection to /events namespace
        const socket = io(`${API_BASE_URL}/events`, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        // Connection handlers
        socket.on('connect', () => {
            console.log('[WebSocket] Connected:', socket.id);
            setIsConnected(true);
            setConnectionError(null);

            // Join the event room
            socket.emit('join_event', { eventSlug });
        });

        socket.on('disconnect', (reason) => {
            console.log('[WebSocket] Disconnected:', reason);
            setIsConnected(false);
        });

        socket.on('connect_error', (error) => {
            console.error('[WebSocket] Connection error:', error.message);
            setConnectionError(error.message);
            setIsConnected(false);
        });

        // Listen for new approved photos
        socket.on('photo_approved', (photo: Photo) => {
            console.log('[WebSocket] New photo approved:', photo.id);
            onPhotoApprovedRef.current?.(photo);
        });

        // Listen for photo removals (rejections/deletions)
        socket.on('photo_removed', ({ id }: { id: string }) => {
            console.log('[WebSocket] Photo removed:', id);
            onPhotoRemovedRef.current?.(id);
        });

        // Cleanup on unmount
        return () => {
            console.log('[WebSocket] Cleaning up connection');
            socket.disconnect();
            socketRef.current = null;
        };
    }, [eventSlug]);

    return { isConnected, connectionError };
}

// ============================================
// Admin Dashboard Hook
// ============================================

interface UseAdminSocketOptions {
    eventSlug: string;
    onStatUpdate?: (stats: { totalPhotos: number; pendingCount: number }) => void;
}

export function useAdminSocket({
    eventSlug,
    onStatUpdate,
}: UseAdminSocketOptions) {
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const onStatUpdateRef = useRef(onStatUpdate);
    useEffect(() => {
        onStatUpdateRef.current = onStatUpdate;
    }, [onStatUpdate]);

    useEffect(() => {
        if (!eventSlug) return;

        const socket = io(`${API_BASE_URL}/events`, {
            transports: ['websocket', 'polling'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('join_admin', { eventSlug });
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('admin_stat_update', (stats) => {
            onStatUpdateRef.current?.(stats);
        });

        // Also listen for photo_approved in admin view
        socket.on('photo_approved', () => {
            // Could trigger a refresh of the photo list
        });

        return () => {
            socket.disconnect();
        };
    }, [eventSlug]);

    return { isConnected };
}
