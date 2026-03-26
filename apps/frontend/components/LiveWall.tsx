'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NextImage, { getImageProps } from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { Photo } from '@/lib/types';
import { getPhotos, getActiveBackground } from '@/lib/api';
import { useLiveWall } from '@/hooks/useLiveWall';
import { Sparkles, Maximize, Minimize, QrCode, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface LiveWallProps {
    eventSlug: string;
}

const ORBIT_IMAGE_SIZES = '(max-width: 640px) 120px, 200px';
const HERO_IMAGE_SIZES = '(max-width: 640px) 80vw, 65vw';
const BACKGROUND_IMAGE_SIZES = '100vw';

// ─── Orbit Slot Types ───
type OrbitSlotConfig = {
    x: string; y: string; scale: number; blur: string;
    duration: number; driftX: number; driftY: number; opacity: number;
};

function getPhotoSrc(photo: Photo): string {
    return photo.thumbnailUrl ?? photo.url;
}

function preloadOptimizedImage(
    src: string,
    {
        width,
        height,
        sizes,
        quality,
    }: {
        width: number;
        height: number;
        sizes: string;
        quality: number;
    },
) {
    const { props } = getImageProps({
        src,
        alt: '',
        width,
        height,
        sizes,
        quality,
    });

    const img = new window.Image();
    img.decoding = 'async';
    img.src = props.src;
}

// ─── Memoized orbit slot — only re-renders when the photo URL or slot config changes ───
// Performance: x/y drift only (no scale/opacity/rotate keyframe oscillation = 70% fewer GPU ops)
const OrbitSlot = memo(function OrbitSlot({
    photo,
    slot,
    prefersReducedMotion,
}: {
    photo: Photo;
    slot: OrbitSlotConfig;
    prefersReducedMotion: boolean;
}) {
    return (
        <motion.div
            className="absolute z-0 pointer-events-none"
            style={{
                left: slot.x,
                top: slot.y,
                filter: slot.blur,
                opacity: slot.opacity,
                willChange: 'transform',
            }}
            initial={{ scale: slot.scale, opacity: 0 }}
            animate={prefersReducedMotion
                ? { opacity: slot.opacity }
                : { x: [0, slot.driftX, 0], y: [0, slot.driftY, 0] }
            }
            transition={{ duration: slot.duration, repeat: Infinity, ease: 'easeInOut' }}
        >
            {/* No backdrop-blur — opaque bg avoids 18× GPU compositing layers */}
            <div
                className="bg-black/40 p-1.5 rounded-2xl border border-white/10 shadow-xl"
                style={{ width: `${Math.round(slot.scale * 300)}px` }}
            >
                <div className="relative w-full aspect-4/5 overflow-hidden rounded-xl">
                    <NextImage
                        src={getPhotoSrc(photo)}
                        alt=""
                        fill
                        className="object-cover"
                        sizes={ORBIT_IMAGE_SIZES}
                        quality={60}
                    />
                </div>
            </div>
        </motion.div>
    );
});

export default function LiveWall({ eventSlug }: LiveWallProps) {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isNewPhoto, setIsNewPhoto] = useState(false);
    const [loading, setLoading] = useState(true);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const { t } = useLanguage();

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

    // Handle new photo from SSE — cap at 50 to avoid unbounded DOM growth
    const handlePhotoApproved = useCallback((newPhoto: Photo) => {
        setPhotos((prev) => [newPhoto, ...prev].slice(0, 50));
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

    // Cycle main photo every 8 seconds — pauses when tab is backgrounded
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;

        const start = () => {
            if (interval) return;
            interval = setInterval(() => {
                if (photos.length > 0) {
                    setCurrentIndex((prev) => (prev + 1) % photos.length);
                    setIsNewPhoto(false);
                }
            }, 8000);
        };

        const stop = () => {
            if (interval) { clearInterval(interval); interval = null; }
        };

        const onVisibilityChange = () => {
            if (document.hidden) {
                stop();
                return;
            }
            start();
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        start();

        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [photos.length]);

    const currentPhoto = photos[currentIndex];
    // ─── 3D Parallax Constellation Slots (9 slots — trimmed from 18 for GPU budget) ───
    const ORBIT_SLOTS = useMemo(() => [
        // Foreground (Fast, large, soft blur)
        { x: '10%', y: '15%', scale: 0.6, blur: 'blur(3px)', duration: 20, driftX: 40, driftY: 30, opacity: 0.5 },
        { x: '80%', y: '10%', scale: 0.65, blur: 'blur(4px)', duration: 25, driftX: -50, driftY: 40, opacity: 0.4 },
        { x: '15%', y: '75%', scale: 0.7, blur: 'blur(3px)', duration: 22, driftX: 45, driftY: -35, opacity: 0.45 },
        { x: '75%', y: '80%', scale: 0.55, blur: 'blur(5px)', duration: 28, driftX: -30, driftY: -45, opacity: 0.4 },
        // Midground (Medium speed, sharp)
        { x: '5%', y: '45%', scale: 0.4, blur: 'blur(0px)', duration: 35, driftX: 25, driftY: 20, opacity: 0.8 },
        { x: '85%', y: '40%', scale: 0.45, blur: 'blur(0px)', duration: 32, driftX: -20, driftY: 25, opacity: 0.75 },
        { x: '60%', y: '5%', scale: 0.35, blur: 'blur(0px)', duration: 38, driftX: 15, driftY: 30, opacity: 0.85 },
        { x: '40%', y: '85%', scale: 0.38, blur: 'blur(0px)', duration: 36, driftX: 20, driftY: -20, opacity: 0.8 },
        { x: '25%', y: '5%', scale: 0.42, blur: 'blur(1px)', duration: 30, driftX: -25, driftY: 15, opacity: 0.7 },
    ], []);

    // Stable orbit pool: only reshuffles when photo count changes, not on every hero cycle
    const floatingPhotos = useMemo(() => {
        if (photos.length <= 1) return [];
        return photos.slice(1, ORBIT_SLOTS.length + 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photos.length, ORBIT_SLOTS.length]);

    // Preload next hero image at 5.5s into the 8s cycle so the transition is seamless
    useEffect(() => {
        if (photos.length < 2) return;
        const timer = setTimeout(() => {
            const nextIndex = (currentIndex + 1) % photos.length;
            const nextPhoto = photos[nextIndex];
            if (nextPhoto) {
                preloadOptimizedImage(getPhotoSrc(nextPhoto), {
                    width: 1600,
                    height: 1200,
                    sizes: HERO_IMAGE_SIZES,
                    quality: 85,
                });
            }
        }, 5500);
        return () => clearTimeout(timer);
    }, [currentIndex, photos]);

    // Preload background image as soon as the URL arrives via SSE so
    // the CSS background-image swap is instant (no blank flash).
    useEffect(() => {
        if (!backgroundUrl) return;
        preloadOptimizedImage(backgroundUrl, {
            width: 1920,
            height: 1080,
            sizes: BACKGROUND_IMAGE_SIZES,
            quality: 70,
        });
    }, [backgroundUrl]);

    const uploadUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${eventSlug}`;

    // ─── QR Modal (shared between empty-state and main wall) ───
    const qrModal = (
        <AnimatePresence>
            {qrModalOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-md"
                    onClick={() => setQrModalOpen(false)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="relative bg-white/10 backdrop-blur-2xl border border-white/20 p-8 sm:p-10 rounded-3xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] flex flex-col items-center gap-5 max-w-xs mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setQrModalOpen(false)}
                            className="absolute top-3 right-3 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                            aria-label="Close QR code"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <QRCodeSVG
                            value={uploadUrl}
                            size={200}
                            className="rounded-2xl"
                            fgColor="#ffffff"
                            bgColor="transparent"
                        />
                        <div className="text-center space-y-1">
                            <p className="text-white font-semibold text-sm tracking-[0.15em] uppercase">
                                {t('scan_upload')}
                            </p>
                            <p className="text-white/50 text-xs tracking-wider">
                                {eventSlug}
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    // ─── Loading skeleton ───
    if (loading) {
        return (
            <div className="w-full h-screen bg-black overflow-hidden relative">
                {/* Ambient glow blobs */}
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-[80px] animate-pulse" />
                <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-white/3 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: '0.5s' }} />
                {/* Orbit placeholders */}
                {[
                    { left: '10%', top: '15%', w: 80 }, { left: '80%', top: '10%', w: 72 },
                    { left: '5%', top: '45%', w: 64 }, { left: '85%', top: '40%', w: 70 },
                    { left: '15%', top: '75%', w: 60 }, { left: '75%', top: '80%', w: 68 },
                ].map((pos, i) => (
                    <div key={i} className="absolute pointer-events-none animate-pulse"
                        style={{ left: pos.left, top: pos.top, width: pos.w, animationDelay: `${i * 0.15}s` }}>
                        <div className="bg-white/5 rounded-2xl p-1.5 border border-white/5">
                            <div className="aspect-4/5 rounded-xl bg-white/8" />
                        </div>
                    </div>
                ))}
                {/* Hero placeholder */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-pulse flex flex-col items-center gap-4">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                            <div className="w-[40vw] max-w-xs aspect-3/4 rounded-xl bg-white/8" />
                        </div>
                        <div className="h-3 w-32 bg-white/10 rounded-full" />
                    </div>
                </div>
                {/* Status bar placeholder */}
                <div className="absolute top-6 left-6 sm:top-12 sm:left-12 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
                    <div className="h-2 w-24 bg-white/10 rounded-full animate-pulse" />
                </div>
            </div>
        );
    }

    // ─── Empty state ───
    if (photos.length === 0) {
        return (
            <div className="relative w-full h-screen bg-linear-to-br from-gray-900 to-black flex flex-col items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none" />
                <div className="text-center space-y-8 px-4 z-10">
                    <h1 className="text-white text-3xl sm:text-5xl font-bold tracking-tight">
                        {t('experience_awaits')}
                    </h1>
                    <p className="text-gray-400 text-base sm:text-lg max-w-md mx-auto">
                        {t('be_first')}
                    </p>
                </div>

                {/* Mobile: small pill button — tap to open QR modal */}
                <button
                    onClick={() => setQrModalOpen(true)}
                    className="sm:hidden absolute bottom-8 bg-white/10 backdrop-blur-xl border border-white/15 px-5 py-3 rounded-full shadow-xl z-50 flex items-center gap-2.5 hover:bg-white/15 active:scale-95 transition-all"
                >
                    <QrCode className="w-5 h-5 text-white/80" />
                    <span className="text-white/80 font-semibold text-xs tracking-[0.15em] uppercase">{t('scan_upload')}</span>
                </button>

                {/* Desktop: full QR card */}
                <div className="hidden sm:flex absolute bottom-12 bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl z-50 flex-col items-center gap-4 hover:bg-white/10 transition-colors">
                    <QRCodeSVG value={uploadUrl} size={140} className="rounded-xl opacity-90 mix-blend-screen" fgColor="#fff" bgColor="transparent" />
                    <p className="text-white/70 font-semibold text-xs tracking-[0.2em] uppercase">{eventSlug}</p>
                </div>

                {qrModal}
            </div>
        );
    }


    // ─── Main live wall with Cinematic Masonry Background ───
    return (
        <div className="relative w-full h-screen h-dvh overflow-hidden bg-black">
            {backgroundUrl && (
                <div className="absolute inset-0 z-0">
                    <NextImage
                        src={backgroundUrl}
                        alt=""
                        fill
                        priority
                        className="object-cover"
                        sizes={BACKGROUND_IMAGE_SIZES}
                        quality={70}
                    />
                </div>
            )}

            {/* Dark overlay on custom background for readability */}
            <div className={`absolute inset-0 z-0 ${backgroundUrl ? 'bg-black/60' : 'bg-gradient-to-br from-gray-900 via-black to-slate-900'}`} />

            {/* ── 3D Parallax Constellation (Background) ── */}
            {!backgroundUrl && floatingPhotos.map((photo, i) => (
                <OrbitSlot
                    key={`parallax-${photo.id}`}
                    photo={photo}
                    slot={ORBIT_SLOTS[i % ORBIT_SLOTS.length]}
                    prefersReducedMotion={prefersReducedMotion}
                />
            ))}

            {/* Center Vignette to draw focus to hero */}
            <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] pointer-events-none opacity-80" />

            {/* ── Center Hero Photo ── */}
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                <AnimatePresence mode="wait">
                    {currentPhoto && (
                        <motion.div
                            key={currentPhoto.id}
                            initial={{ opacity: 0, scale: 0.92, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: -20 }}
                            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                            className="relative flex flex-col items-center"
                            style={{ willChange: 'transform, opacity' }}
                        >
                            {/* Massive glow */}
                            <div className="absolute -inset-10 sm:-inset-20 bg-white/20 rounded-full blur-[80px]" />

                            {/* Ultra-premium glassmorphic frame */}
                            <div className="relative bg-white/5 backdrop-blur-2xl p-4 sm:p-6 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-white/20">
                                <div className="relative h-[60vh] w-[80vw] sm:h-[70vh] sm:w-[65vw] max-w-[1400px] overflow-hidden rounded-xl">
                                    <NextImage
                                        src={getPhotoSrc(currentPhoto)}
                                        alt={currentPhoto.senderName ? `Photo from ${currentPhoto.senderName}` : 'Event photo'}
                                        fill
                                        priority
                                        className="object-contain rounded-xl shadow-inner border border-white/10"
                                        sizes={HERO_IMAGE_SIZES}
                                        quality={85}
                                    />
                                </div>
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
                        <span className="text-xs sm:text-sm font-bold uppercase tracking-widest">{t('new_arrival')}</span>
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

            {/* ── Photo Counter (Bottom Left) ── */}
            <div className="absolute bottom-6 left-6 sm:bottom-12 sm:left-12 z-50">
                <span className="text-white/40 text-xs sm:text-sm font-medium tracking-[0.2em]">
                    {String(currentIndex + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
                </span>
            </div>

            {/* ── QR Code (Bottom Right) ── */}
            {/* Mobile: compact pill button — tap opens modal */}
            <button
                onClick={() => setQrModalOpen(true)}
                className="sm:hidden absolute bottom-6 right-6 bg-white/10 backdrop-blur-xl border border-white/15 px-4 py-2.5 rounded-full shadow-xl z-50 flex items-center gap-2 hover:bg-white/15 active:scale-95 transition-all"
                aria-label="Show QR code"
            >
                <QrCode className="w-4 h-4 text-white/80" />
                <span className="text-white/70 font-semibold text-[10px] tracking-[0.12em] uppercase">QR</span>
            </button>

            {/* Desktop: full floating QR card */}
            <div className="hidden sm:flex absolute bottom-12 right-12 bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl z-50 flex-col items-center gap-3 hover:bg-white/10 transition-colors">
                <QRCodeSVG value={uploadUrl} size={90} className="rounded-xl opacity-90 mix-blend-screen" fgColor="#fff" bgColor="transparent" />
                <p className="text-white/70 font-semibold text-[10px] tracking-[0.15em] uppercase">{t('scan_upload')}</p>
            </div>

            {qrModal}
        </div>
    );
}
