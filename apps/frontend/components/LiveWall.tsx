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

import { Sparkles, Image as ImageIcon, Maximize, Minimize } from 'lucide-react';

// ... (other imports)

export default function LiveWall({ eventSlug }: LiveWallProps) {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isNewPhoto, setIsNewPhoto] = useState(false);
    const [loading, setLoading] = useState(true);

    // Track user motion preference for accessibility
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);
        const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }, []);

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
    const { isConnected } = useLiveWall({
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

    // Cycle main photo every 8 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            if (photos.length > 0) {
                setCurrentIndex((prev) => (prev + 1) % photos.length);
                setIsNewPhoto(false);
            }
        }, 8000); // 8s for cinematic pacing
        return () => clearInterval(interval);
    }, [photos.length]);

    const currentPhoto = photos[currentIndex];
    // ─── 3D Parallax Constellation Slots ───
    const ORBIT_SLOTS = useMemo(() => [
        // Foreground (Fast, large, slightly blurred)
        { x: '10%', y: '15%', scale: 0.6, blur: 'blur(3px)', duration: 20, driftX: 40, driftY: 30, opacity: 0.5 },
        { x: '80%', y: '10%', scale: 0.65, blur: 'blur(4px)', duration: 25, driftX: -50, driftY: 40, opacity: 0.4 },
        { x: '15%', y: '75%', scale: 0.7, blur: 'blur(3px)', duration: 22, driftX: 45, driftY: -35, opacity: 0.45 },
        { x: '75%', y: '80%', scale: 0.55, blur: 'blur(5px)', duration: 28, driftX: -30, driftY: -45, opacity: 0.4 },
        // Midground (Medium speed, sharp, medium scale)
        { x: '5%', y: '45%', scale: 0.4, blur: 'blur(0px)', duration: 35, driftX: 25, driftY: 20, opacity: 0.8 },
        { x: '85%', y: '40%', scale: 0.45, blur: 'blur(0.5px)', duration: 32, driftX: -20, driftY: 25, opacity: 0.75 },
        { x: '60%', y: '5%', scale: 0.35, blur: 'blur(0px)', duration: 38, driftX: 15, driftY: 30, opacity: 0.85 },
        { x: '40%', y: '85%', scale: 0.38, blur: 'blur(0px)', duration: 36, driftX: 20, driftY: -20, opacity: 0.8 },
        { x: '25%', y: '5%', scale: 0.42, blur: 'blur(1px)', duration: 30, driftX: -25, driftY: 15, opacity: 0.7 },
        { x: '65%', y: '85%', scale: 0.4, blur: 'blur(0.5px)', duration: 33, driftX: 30, driftY: -25, opacity: 0.75 },
        // Background (Very slow, small, heavy blur)
        { x: '2%', y: '25%', scale: 0.25, blur: 'blur(8px)', duration: 50, driftX: 10, driftY: 15, opacity: 0.25 },
        { x: '92%', y: '65%', scale: 0.2, blur: 'blur(10px)', duration: 55, driftX: -15, driftY: -10, opacity: 0.2 },
        { x: '35%', y: '15%', scale: 0.22, blur: 'blur(6px)', duration: 45, driftX: 12, driftY: 20, opacity: 0.3 },
        { x: '50%', y: '90%', scale: 0.28, blur: 'blur(9px)', duration: 60, driftX: -10, driftY: -15, opacity: 0.25 },
        { x: '88%', y: '25%', scale: 0.24, blur: 'blur(7px)', duration: 48, driftX: -12, driftY: 10, opacity: 0.3 },
        { x: '12%', y: '60%', scale: 0.26, blur: 'blur(6px)', duration: 52, driftX: 15, driftY: -12, opacity: 0.3 },
        { x: '45%', y: '5%', scale: 0.2, blur: 'blur(10px)', duration: 65, driftX: -8, driftY: 18, opacity: 0.15 },
        { x: '25%', y: '95%', scale: 0.21, blur: 'blur(12px)', duration: 70, driftX: 10, driftY: -20, opacity: 0.15 },
    ], []);

    const floatingPhotos = useMemo(() => {
        if (photos.length <= 1) return [];
        const others = photos.filter((_, i) => i !== currentIndex);
        return others.slice(0, ORBIT_SLOTS.length);
    }, [photos, currentIndex, ORBIT_SLOTS]);

    const uploadUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${eventSlug}`;

    // ─── Loading ───
    if (loading) {
        return (
            <div className="w-full h-screen h-dvh bg-black flex items-center justify-center">
                <div className="text-white/50 flex flex-col items-center gap-4">
                    <ImageIcon className="w-8 h-8 animate-pulse text-white/30" />
                    <span className="text-sm uppercase tracking-widest font-medium">Entering Live Wall</span>
                </div>
            </div>
        );
    }

    // ─── Empty state ───
    if (photos.length === 0) {
        return (
            <div className="relative w-full h-screen h-dvh bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none" />
                <div className="text-center space-y-8 px-4 z-10">
                    <h1 className="text-white text-3xl sm:text-5xl font-bold tracking-tight">
                        Experience Awaits
                    </h1>
                    <p className="text-gray-400 text-base sm:text-lg max-w-md mx-auto">
                        Be the first to shape the story. Scan the code below to upload a moment.
                    </p>
                </div>
                {/* Minimalist QR Card */}
                <div className="absolute bottom-8 sm:bottom-12 bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl z-50 flex flex-col items-center gap-4 hover:bg-white/10 transition-colors">
                    <QRCodeSVG value={uploadUrl} size={140} className="rounded-xl opacity-90 mix-blend-screen" fgColor="#fff" bgColor="transparent" />
                    <p className="text-white/70 font-semibold text-xs tracking-[0.2em] uppercase">{eventSlug}</p>
                </div>
            </div>
        );
    }


    // ─── Main live wall with Cinematic Masonry Background ───
    return (
        <div className="relative w-full h-screen h-dvh overflow-hidden bg-black"
            style={backgroundUrl ? {
                backgroundImage: `url(${backgroundUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            } : undefined}
        >
            {/* Dark overlay on custom background for readability */}
            <div className={`absolute inset-0 z-0 ${backgroundUrl ? 'bg-black/60' : 'bg-gradient-to-br from-gray-900 via-black to-slate-900'}`} />

            {/* ── 3D Parallax Constellation (Background) ── */}
            {!backgroundUrl && floatingPhotos.map((photo, i) => {
                const slot = ORBIT_SLOTS[i % ORBIT_SLOTS.length];
                return (
                    <motion.div
                        key={`parallax-${photo.id}-${i}`}
                        className="absolute z-0 pointer-events-none"
                        style={{
                            left: slot.x,
                            top: slot.y,
                            filter: slot.blur,
                            opacity: slot.opacity,
                        }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={prefersReducedMotion ? {
                            scale: slot.scale, opacity: slot.opacity
                        } : {
                            scale: [slot.scale, slot.scale * 1.05, slot.scale],
                            x: [0, slot.driftX, 0, -slot.driftX * 0.5, 0],
                            y: [0, slot.driftY, 0, -slot.driftY * 0.5, 0],
                            opacity: [slot.opacity, slot.opacity * 1.2, slot.opacity],
                            rotate: [0, 2, -2, 0]
                        }}
                        transition={{
                            duration: slot.duration,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    >
                        <div className="bg-white/10 p-2 rounded-2xl shadow-2xl backdrop-blur-sm border border-white/5"
                            style={{ width: 'clamp(120px, 20vw, 240px)' }}
                        >
                            <img
                                src={photo.url}
                                alt=""
                                className="w-full aspect-[4/5] object-cover rounded-xl shadow-inner"
                                loading="lazy"
                            />
                        </div>
                    </motion.div>
                );
            })}

            {/* Center Vignette to draw focus to hero */}
            <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] pointer-events-none opacity-80" />

            {/* ── Center Hero Photo ── */}
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <AnimatePresence mode="wait">
                    {currentPhoto && (
                        <motion.div
                            key={currentPhoto.id}
                            initial={{ opacity: 0, scale: 0.9, y: 40, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.95, y: -20, filter: 'blur(10px)' }}
                            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} // Custom spring-like easing
                            className="relative flex flex-col items-center"
                        >
                            {/* Massive glow */}
                            <div className="absolute -inset-10 sm:-inset-20 bg-white/20 rounded-full blur-[80px]" />

                            {/* Ultra-premium glassmorphic frame */}
                            <div className="relative bg-white/5 backdrop-blur-2xl p-4 sm:p-6 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-white/20">
                                <img
                                    src={currentPhoto.url}
                                    alt="Event photo"
                                    className="max-h-[60vh] sm:max-h-[70vh] max-w-[80vw] sm:max-w-[65vw] object-contain rounded-xl shadow-inner border border-white/10"
                                />
                            </div>

                            {/* Cinematic typography for message */}
                            {(currentPhoto.message || currentPhoto.senderName) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.8, duration: 0.8 }}
                                    className="mt-6 sm:mt-8 flex flex-col items-center gap-1 sm:gap-2 max-w-2xl px-6 text-center"
                                >
                                    {currentPhoto.message && (
                                        <p className="text-white text-xl sm:text-4xl font-light tracking-wide leading-relaxed drop-shadow-2xl">
                                            &quot;{currentPhoto.message}&quot;
                                        </p>
                                    )}
                                    <p className="text-white/60 text-xs sm:text-sm uppercase tracking-[0.3em] mt-2 font-medium">
                                        — {currentPhoto.senderName || 'Anonymous'}
                                    </p>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── "New Photo" Indicator (No Emoji, Premium) ── */}
            <AnimatePresence>
                {isNewPhoto && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -20 }}
                        className="absolute top-6 right-6 sm:top-12 sm:right-12 bg-white text-black px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-2xl z-30 flex items-center gap-2 border border-white/20"
                    >
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                        <span className="text-xs sm:text-sm font-bold uppercase tracking-widest">New Arrival</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Title & Status Overlay ── */}
            <div className="absolute top-6 left-6 sm:top-12 sm:left-12 z-50 flex items-center gap-4">
                <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                <h1 className="text-white/70 text-xs sm:text-sm font-medium tracking-[0.3em] uppercase drop-shadow-md">
                    {eventSlug.replace(/-/g, ' ')}
                </h1>
            </div>

            {/* ── Fullscreen Toggle Overlay (Top Right) ── */}
            <div className="absolute top-6 right-6 sm:top-12 sm:right-12 z-50 flex items-center gap-4">
                <button
                    onClick={toggleFullscreen}
                    className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full shadow-lg border border-white/20 text-white/80 hover:text-white transition-all transform hover:scale-110 active:scale-95 group"
                    aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                    {isFullscreen ? (
                        <Minimize className="w-5 h-5 drop-shadow-lg" />
                    ) : (
                        <Maximize className="w-5 h-5 drop-shadow-lg" />
                    )}
                </button>
            </div>

            {/* ── Photo Counter (Moved to Bottom Left) ── */}
            <div className="absolute bottom-6 left-6 sm:bottom-12 sm:left-12 z-50">
                <span className="text-white/40 text-xs sm:text-sm font-medium tracking-[0.2em]">
                    {String(currentIndex + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
                </span>
            </div>

            {/* ── Floating QR Code (Bottom Right) ── */}
            <div className="absolute bottom-6 right-6 sm:bottom-12 sm:right-12 bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl z-50 flex flex-col items-center gap-3 hover:bg-white/10 transition-colors">
                <QRCodeSVG value={uploadUrl} size={90} className="rounded-xl opacity-90 mix-blend-screen" fgColor="#fff" bgColor="transparent" />
                <p className="text-white/70 font-semibold text-[10px] tracking-[0.15em] uppercase">Scan to Upload</p>
            </div>
        </div>
    );
}
