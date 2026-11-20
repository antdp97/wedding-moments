/**
 * Custom SSE hooks for Live Wall and Admin real-time updates
 * Migrated from Socket.io to native EventSource (Server-Sent Events)
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { SSE_ROUTES, type AdminSseMessage, type AdminStats, type LiveWallSseMessage, type Photo } from '@/lib/types';
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

const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]; // caps at 30s

export function useLiveWall({
    eventSlug,
    onPhotoApproved,
    onPhotoRemoved,
    onBackgroundChanged,
}: UseLiveWallOptions): UseLiveWallReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Stable callback refs to avoid re-subscribing on every render
    const onPhotoApprovedRef = useRef(onPhotoApproved);
    const onPhotoRemovedRef = useRef(onPhotoRemoved);
    const onBackgroundChangedRef = useRef(onBackgroundChanged);
    useEffect(() => { onPhotoApprovedRef.current = onPhotoApproved; }, [onPhotoApproved]);
    useEffect(() => { onPhotoRemovedRef.current = onPhotoRemoved; }, [onPhotoRemoved]);
    useEffect(() => { onBackgroundChangedRef.current = onBackgroundChanged; }, [onBackgroundChanged]);

    const retryCount = useRef(0);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const esRef = useRef<EventSource | null>(null);

    const connect = useCallback(() => {
        if (!eventSlug) return;

        const es = new EventSource(`${API_BASE_URL}${SSE_ROUTES.liveWall(eventSlug)}`);
        esRef.current = es;

        es.onopen = () => {
            setIsConnected(true);
            setConnectionError(null);
            retryCount.current = 0;
        };

        es.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as LiveWallSseMessage;
                switch (msg.type) {
                    case 'photo_approved':
                        onPhotoApprovedRef.current?.(msg.payload);
                        break;
                    case 'photo_removed':
                        onPhotoRemovedRef.current?.(msg.payload.id);
                        break;
                    case 'background_changed':
                        onBackgroundChangedRef.current?.(msg.payload.url);
                        break;
                    case 'shutdown': {
                        // Server is shutting down — close and delay reconnect
                        // to avoid thundering herd when all clients reconnect at once
                        const retryAfter = msg.payload?.retryAfter ?? 5000;
                        const jitter = Math.random() * retryAfter;
                        es.close();
                        esRef.current = null;
                        setIsConnected(false);
                        retryTimer.current = setTimeout(connect, jitter);
                        return;
                    }
                    case 'heartbeat':
                        break;
                }
            } catch (err) {
                console.error('[SSE] Failed to parse:', err);
            }
        };

        es.onerror = () => {
            es.close();
            esRef.current = null;
            setIsConnected(false);
            setConnectionError('Stream disconnected');

            const delay = BACKOFF_DELAYS[Math.min(retryCount.current, BACKOFF_DELAYS.length - 1)];
            retryCount.current += 1;
            console.warn(`[SSE] Disconnected — retrying in ${delay}ms (attempt ${retryCount.current})`);
            retryTimer.current = setTimeout(connect, delay);
        };
    }, [eventSlug]);

    useEffect(() => {
        connect();
        return () => {
            if (retryTimer.current) clearTimeout(retryTimer.current);
            esRef.current?.close();
            esRef.current = null;
        };
    }, [connect]);

    return { isConnected, connectionError };
}

// ─── Admin Dashboard Hook ───

interface UseAdminSocketOptions {
    eventSlug: string;
    onStatUpdate?: (stats: AdminStats) => void;
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

    const retryCount = useRef(0);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const esRef = useRef<EventSource | null>(null);

    const connect = useCallback(() => {
        if (!eventSlug) return;

        const es = new EventSource(
            `${API_BASE_URL}${SSE_ROUTES.admin(eventSlug)}`,
        );
        esRef.current = es;

        es.onopen = () => {
            setIsConnected(true);
            retryCount.current = 0;
        };

        es.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as AdminSseMessage;

                if (msg.type === 'admin_stat_update') {
                    onStatUpdateRef.current?.(msg.payload);
                }
                if (msg.type === 'shutdown') {
                    // Graceful shutdown — jitter reconnect to avoid thundering herd
                    const retryAfter = msg.payload?.retryAfter ?? 5000;
                    const jitter = Math.random() * retryAfter;
                    es.close();
                    esRef.current = null;
                    setIsConnected(false);
                    retryTimer.current = setTimeout(connect, jitter);
                    return;
                }
                // 'photo_approved' also arrives here, could trigger list refresh
            } catch (err) {
                console.error('[SSE Admin] Parse error:', err);
            }
        };

        es.onerror = () => {
            es.close();
            esRef.current = null;
            setIsConnected(false);

            const delay = BACKOFF_DELAYS[Math.min(retryCount.current, BACKOFF_DELAYS.length - 1)];
            retryCount.current += 1;
            console.warn(`[SSE Admin] Disconnected — retrying in ${delay}ms (attempt ${retryCount.current})`);
            retryTimer.current = setTimeout(connect, delay);
        };
    }, [eventSlug]);

    useEffect(() => {
        connect();
        return () => {
            if (retryTimer.current) clearTimeout(retryTimer.current);
            esRef.current?.close();
            esRef.current = null;
        };
    }, [connect]);

    return { isConnected };
}
