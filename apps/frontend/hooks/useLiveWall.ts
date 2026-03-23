/**
 * Custom SSE hooks for Live Wall and Admin real-time updates
 * Migrated from Socket.io to native EventSource (Server-Sent Events)
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Photo } from '@/lib/types';
import { API_BASE_URL } from '@/lib/api';

// ─── Live Wall Hook (Slideshow) ───

interface UseLiveWallOptions {
    eventSlug: string;
    onPhotoApproved?: (photo: Photo) => void;
    onPhotoRemoved?: (photoId: string) => void;
    onBackgroundChanged?: (url: string | null) => void;
}

interface UseLiveWallReturn {
    isConnected: boolean;
    connectionError: string | null;
}

export function useLiveWall({
    eventSlug,
    onPhotoApproved,
    onPhotoRemoved,
    onBackgroundChanged,
}: UseLiveWallOptions): UseLiveWallReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Stable callback refs to avoid re-subscribing
    const onPhotoApprovedRef = useRef(onPhotoApproved);
    const onPhotoRemovedRef = useRef(onPhotoRemoved);
    const onBackgroundChangedRef = useRef(onBackgroundChanged);

    useEffect(() => {
        onPhotoApprovedRef.current = onPhotoApproved;
    }, [onPhotoApproved]);

    useEffect(() => {
        onPhotoRemovedRef.current = onPhotoRemoved;
    }, [onPhotoRemoved]);

    useEffect(() => {
        onBackgroundChangedRef.current = onBackgroundChanged;
    }, [onBackgroundChanged]);

    useEffect(() => {
        if (!eventSlug) return;

        const es = new EventSource(
            `${API_BASE_URL}/api/stream/event/${eventSlug}`,
        );

        es.onopen = () => {
            console.log('[SSE] Connected to event stream:', eventSlug);
            setIsConnected(true);
            setConnectionError(null);
        };

        es.onmessage = (event) => {
            try {
                const { type, payload } = JSON.parse(event.data);

                switch (type) {
                    case 'photo_approved':
                        console.log('[SSE] Photo approved:', payload.id);
                        onPhotoApprovedRef.current?.(payload);
                        break;
                    case 'photo_removed':
                        console.log('[SSE] Photo removed:', payload.id);
                        onPhotoRemovedRef.current?.(payload.id);
                        break;
                    case 'background_changed':
                        console.log('[SSE] Background changed:', payload.url);
                        onBackgroundChangedRef.current?.(payload.url);
                        break;
                    case 'heartbeat':
                        break; // Silently ignore
                }
            } catch (err) {
                console.error('[SSE] Failed to parse:', err);
            }
        };

        es.onerror = () => {
            console.warn(
                '[SSE] Connection error — browser will auto-reconnect',
            );
            setIsConnected(false);
            setConnectionError('Stream disconnected');
            // EventSource auto-reconnects after ~3 seconds by default
        };

        return () => {
            console.log('[SSE] Closing connection');
            es.close();
        };
    }, [eventSlug]);

    return { isConnected, connectionError };
}

// ─── Admin Dashboard Hook ───

interface UseAdminSocketOptions {
    eventSlug: string;
    onStatUpdate?: (stats: {
        totalPhotos: number;
        pendingCount: number;
    }) => void;
}

export function useAdminSocket({
    eventSlug,
    onStatUpdate,
}: UseAdminSocketOptions) {
    const [isConnected, setIsConnected] = useState(false);

    const onStatUpdateRef = useRef(onStatUpdate);
    useEffect(() => {
        onStatUpdateRef.current = onStatUpdate;
    }, [onStatUpdate]);

    useEffect(() => {
        if (!eventSlug) return;

        const es = new EventSource(
            `${API_BASE_URL}/api/stream/admin/${eventSlug}`,
        );

        es.onopen = () => setIsConnected(true);

        es.onmessage = (event) => {
            try {
                const { type, payload } = JSON.parse(event.data);

                if (type === 'admin_stat_update') {
                    onStatUpdateRef.current?.(payload);
                }
                // 'photo_approved' also arrives here, could trigger list refresh
            } catch (err) {
                console.error('[SSE Admin] Parse error:', err);
            }
        };

        es.onerror = () => setIsConnected(false);

        return () => es.close();
    }, [eventSlug]);

    return { isConnected };
}
