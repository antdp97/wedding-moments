'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Photo } from '@/lib/types';
import { getPhotos, getActiveBackground } from '@/lib/api';
import { useLiveWall } from '@/hooks/useLiveWall';

interface LiveWallProps {
    eventSlug: string;
}

// ─── Floating Polaroid positions ───
// Pre-defined "orbit slots" for the floating thumbnails so they stay
// scattered around the edges without overlapping the center hero.
interface FloatSlot {
    x: string;        // CSS left %
    y: string;        // CSS top %
    rotate: number;    // deg
    scale: number;
    delay: number;     // animation stagger
    duration: number;  // float cycle length (s)
    driftX: number;    // px to float horizontally
    driftY: number;    // px to float vertically
}

const FLOAT_SLOTS: FloatSlot[] = [
    { x: '3%', y: '5%', rotate: -12, scale: 0.55, delay: 0, duration: 8, driftX: 15, driftY: 20 },
    { x: '78%', y: '3%', rotate: 8, scale: 0.50, delay: 0.8, duration: 9, driftX: -12, driftY: 18 },
    { x: '85%', y: '35%', rotate: -5, scale: 0.48, delay: 1.5, duration: 10, driftX: -18, driftY: -15 },
    { x: '80%', y: '70%', rotate: 14, scale: 0.52, delay: 0.3, duration: 7, driftX: 10, driftY: -20 },
    { x: '5%', y: '68%', rotate: -10, scale: 0.50, delay: 2.0, duration: 11, driftX: 20, driftY: -12 },
    { x: '2%', y: '38%', rotate: 7, scale: 0.45, delay: 1.2, duration: 9, driftX: 18, driftY: 15 },
    { x: '20%', y: '82%', rotate: -6, scale: 0.42, delay: 0.5, duration: 8, driftX: -10, driftY: -18 },
    { x: '60%', y: '80%', rotate: 11, scale: 0.46, delay: 1.8, duration: 10, driftX: 12, driftY: -14 },
    { x: '55%', y: '2%', rotate: -9, scale: 0.44, delay: 2.5, duration: 9, driftX: -15, driftY: 16 },
    { x: '30%', y: '3%', rotate: 5, scale: 0.40, delay: 0.6, duration: 12, driftX: 8, driftY: 22 },
];

export default function LiveWall({ eventSlug }: LiveWallProps) {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isNewPhoto, setIsNewPhoto] = useState(false);
    const [loading, setLoading] = useState(true);

    // Handle new photo from WebSocket
    const handlePhotoApproved = useCallback((newPhoto: Photo) => {
        setPhotos((prev) => [newPhoto, ...prev]);
        setCurrentIndex(0);
        setIsNewPhoto(true);
    }, []);

    // Handle photo removal
    const handlePhotoRemoved = useCallback((removedPhotoId: string) => {
        setPhotos((prev) => {
            const filtered = prev.filter((p) => p.id !== removedPhotoId);
            setCurrentIndex((curr) => {
                if (filtered.length === 0) return 0;
                if (curr >= filtered.length) return 0;
                return curr;
            });
            return filtered;
        });
    }, []);

    // Background image state
    const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

    const handleBackgroundChanged = useCallback((url: string | null) => {
        setBackgroundUrl(url);
    }, []);

    // Connect to WebSocket
    const { isConnected, connectionError } = useLiveWall({
        eventSlug,
        onPhotoApproved: handlePhotoApproved,
        onPhotoRemoved: handlePhotoRemoved,
        onBackgroundChanged: handleBackgroundChanged,
    });

    // Load initial photos and active background from API
    useEffect(() => {
        async function fetchData() {
            try {
                const [photosData, bgData] = await Promise.all([
                    getPhotos(eventSlug),
                    getActiveBackground(eventSlug).catch(() => null),
                ]);
                setPhotos(photosData);
                if (bgData?.url) setBackgroundUrl(bgData.url);
            } catch (error) {
                console.error('Failed to fetch data:', error);
                setPhotos([]);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [eventSlug]);

    // Cycle main photo every 6 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (photos.length > 0) {
                setCurrentIndex((prev) => (prev + 1) % photos.length);
                setIsNewPhoto(false);
            }
        }, 6000);
        return () => clearInterval(interval);
    }, [photos.length]);

    // Get the "other" photos for the floating polaroids (exclude the current main one)
    const floatingPhotos = useMemo(() => {
        if (photos.length <= 1) return [];
        const others = photos.filter((_, i) => i !== currentIndex);
        // Take up to FLOAT_SLOTS.length photos
        return others.slice(0, FLOAT_SLOTS.length);
    }, [photos, currentIndex]);

    const currentPhoto = photos[currentIndex];
    const uploadUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${eventSlug}`;

    // ─── Loading ───
    if (loading) {
        return (
            <div className="w-full h-screen h-dvh bg-black flex items-center justify-center">
                <div className="text-white text-2xl animate-pulse">Loading...</div>
            </div>
        );
    }

    // ─── Empty state ───
    if (photos.length === 0) {
        return (
            <div className="relative w-full h-screen h-dvh bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center">
                <div className="text-center space-y-6 px-4">
                    <h1 className="text-white text-2xl sm:text-4xl font-bold">
                        Waiting for Photos...
                    </h1>
                    <p className="text-gray-400 text-sm sm:text-lg">
                        Scan the QR code to upload the first photo!
                    </p>
                </div>
                <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 bg-white p-2 sm:p-4 rounded-xl shadow-2xl z-50 flex flex-col items-center gap-1 sm:gap-2">
                    <QRCodeSVG value={uploadUrl} size={80} className="sm:hidden" />
                    <QRCodeSVG value={uploadUrl} size={128} className="hidden sm:block" />
                    <p className="text-black font-bold text-xs sm:text-sm tracking-wider">{eventSlug}</p>
                </div>
                <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-white text-sm">
                        {isConnected ? 'Live' : connectionError || 'Connecting...'}
                    </span>
                </div>
            </div>
        );
    }

    // ─── Main live wall with floating polaroids ───
    return (
        <div className="relative w-full h-screen h-dvh overflow-hidden"
            style={backgroundUrl ? {
                backgroundImage: `url(${backgroundUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            } : undefined}
        >
            {/* Dark overlay on custom background for readability */}
            {backgroundUrl && (
                <div className="absolute inset-0 bg-black/40 z-0" />
            )}
            {/* Default gradient if no background */}
            {!backgroundUrl && (
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a120b] via-[#0d0907] to-black z-0" />
            )}

            {/* ── Floating Polaroid Thumbnails ── */}
            {floatingPhotos.map((photo, i) => {
                const slot = FLOAT_SLOTS[i % FLOAT_SLOTS.length];
                return (
                    <motion.div
                        key={`float-${photo.id}-${i}`}
                        className="absolute z-10 pointer-events-none"
                        style={{
                            left: slot.x,
                            top: slot.y,
                        }}
                        initial={{ opacity: 0, scale: 0.3, rotate: slot.rotate - 20 }}
                        animate={{
                            opacity: [0, 0.75, 0.85, 0.75],
                            scale: slot.scale,
                            rotate: slot.rotate,
                            x: [0, slot.driftX, 0, -slot.driftX * 0.5, 0],
                            y: [0, slot.driftY, 0, -slot.driftY * 0.5, 0],
                        }}
                        transition={{
                            duration: slot.duration,
                            delay: slot.delay,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    >
                        {/* Polaroid card */}
                        <div className="bg-white p-1.5 sm:p-2 rounded-sm shadow-xl shadow-black/40"
                            style={{ width: 'clamp(80px, 14vw, 160px)' }}
                        >
                            <img
                                src={photo.url}
                                alt=""
                                className="w-full aspect-square object-cover rounded-sm"
                                loading="lazy"
                            />
                            {/* Polaroid bottom text strip */}
                            <div className="h-4 sm:h-6 flex items-center justify-center">
                                <span className="text-[8px] sm:text-[10px] text-gray-600 font-medium truncate max-w-full px-1">
                                    {photo.senderName || ''}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                );
            })}

            {/* ── Center Hero Photo ── */}
            <div className="absolute inset-0 flex items-center justify-center z-20">
                <AnimatePresence mode="wait">
                    {currentPhoto && (
                        <motion.div
                            key={currentPhoto.id}
                            initial={{ opacity: 0, scale: 0.85, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -20 }}
                            transition={{ duration: 1.0, ease: 'easeInOut' }}
                            className="relative flex flex-col items-center"
                        >
                            {/* Warm glow behind the frame */}
                            <div className="absolute -inset-4 sm:-inset-8 bg-amber-500/10 rounded-3xl blur-3xl" />

                            {/* Photo frame */}
                            <div className="relative bg-white p-2 sm:p-3 rounded-lg shadow-2xl shadow-amber-900/30 border border-white/20">
                                <img
                                    src={currentPhoto.url}
                                    alt="Event photo"
                                    className="max-h-[55vh] sm:max-h-[65vh] max-w-[70vw] sm:max-w-[55vw] object-contain rounded-md"
                                />
                            </div>

                            {/* Message caption below the frame */}
                            {(currentPhoto.message || currentPhoto.senderName) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.6 }}
                                    className="mt-4 sm:mt-6 bg-black/50 backdrop-blur-md px-5 sm:px-8 py-2.5 sm:py-3 rounded-full text-center shadow-lg"
                                >
                                    {currentPhoto.message && (
                                        <p className="text-white text-sm sm:text-xl font-semibold">
                                            {currentPhoto.message}
                                        </p>
                                    )}
                                    <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-widest mt-0.5">
                                        — {currentPhoto.senderName || 'Anonymous'}
                                    </p>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── "New Photo" indicator ── */}
            {isNewPhoto && (
                <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="absolute top-4 right-4 sm:top-10 sm:right-10 bg-amber-500 text-black px-3 sm:px-6 py-1 sm:py-2 text-sm sm:text-xl font-bold rounded-full shadow-lg z-30 border-2 sm:border-4 border-white"
                >
                    🎉 NEW!
                </motion.div>
            )}

            {/* ── QR Code Overlay ── */}
            <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 bg-white/95 backdrop-blur p-2 sm:p-3 rounded-xl shadow-2xl z-50 flex flex-col items-center gap-1">
                <QRCodeSVG value={uploadUrl} size={64} className="sm:hidden" />
                <QRCodeSVG value={uploadUrl} size={100} className="hidden sm:block" />
                <p className="text-black font-bold text-[9px] sm:text-xs tracking-wider">{eventSlug}</p>
            </div>

            {/* ── Title & Status Overlay ── */}
            <div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-50 flex items-center gap-2 sm:gap-3">
                <h1 className="text-white/70 text-sm sm:text-2xl font-bold drop-shadow-lg tracking-wide">
                    {eventSlug.toUpperCase().replace(/-/g, ' ')}
                </h1>
                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            </div>

            {/* ── Photo Counter ── */}
            <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-50 text-white/40 text-[10px] sm:text-xs font-medium">
                {currentIndex + 1} / {photos.length}
            </div>
        </div>
    );
}
