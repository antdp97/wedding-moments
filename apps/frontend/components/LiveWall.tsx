'use client';

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NextImage, { getImageProps } from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { Photo } from '@/lib/types';
import { getPhotos, getActiveBackground } from '@/lib/api';
import { useLiveWall } from '@/hooks/useLiveWall';
import { SOFT_IMAGE_BLUR_DATA_URL } from '@/lib/image-placeholder';
import { Sparkles, Maximize, Minimize, QrCode, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface LiveWallProps {
    eventSlug: string;
}

const ORBIT_IMAGE_SIZES = '(max-width: 640px) 120px, 200px';
const HERO_IMAGE_SIZES = '(max-width: 640px) 80vw, 65vw';
const BACKGROUND_IMAGE_SIZES = '100vw';
const MOBILE_GALLERY_IMAGE_SIZES = '(max-width: 640px) 34vw, (max-width: 1024px) 18vw, 160px';

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
    hasBackdrop,
}: {
    photo: Photo;
    slot: OrbitSlotConfig;
    prefersReducedMotion: boolean;
    hasBackdrop: boolean;
}) {
    const frameClassName = hasBackdrop
        ? 'bg-black/18 p-1 rounded-[1.35rem] border border-white/8 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.85)]'
        : 'bg-black/30 p-1.5 rounded-[1.35rem] border border-white/10 shadow-[0_22px_46px_-26px_rgba(0,0,0,0.9)]';

    console.log("HERE")
    return (
        <motion.div
            className="absolute z-0 hidden pointer-events-none lg:block"
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
            <div className={frameClassName} style={{ width: `${Math.round(slot.scale * 300)}px` }}>
                <div className="relative w-full aspect-4/5 overflow-hidden rounded-[1rem]">
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
    const thumbnailRailRef = useRef<HTMLDivElement | null>(null);

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

    const handleSelectPhoto = useCallback((index: number) => {
        setCurrentIndex(index);
        setIsNewPhoto(false);
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
    const ORBIT_SLOTS = useMemo(() => {
        const baseSlots: OrbitSlotConfig[] = [
            { x: '4%', y: '10%', scale: 0.54, blur: 'blur(1px)', duration: 26, driftX: 22, driftY: 18, opacity: 0.58 },
            { x: '82%', y: '8%', scale: 0.58, blur: 'blur(1px)', duration: 28, driftX: -24, driftY: 22, opacity: 0.56 },
            { x: '10%', y: '74%', scale: 0.6, blur: 'blur(1px)', duration: 30, driftX: 20, driftY: -18, opacity: 0.52 },
            { x: '79%', y: '72%', scale: 0.56, blur: 'blur(1px)', duration: 32, driftX: -22, driftY: -20, opacity: 0.5 },
            { x: '2%', y: '38%', scale: 0.42, blur: 'blur(0px)', duration: 36, driftX: 18, driftY: 12, opacity: 0.78 },
            { x: '88%', y: '34%', scale: 0.44, blur: 'blur(0px)', duration: 34, driftX: -16, driftY: 14, opacity: 0.76 },
            { x: '60%', y: '3%', scale: 0.34, blur: 'blur(0px)', duration: 38, driftX: 12, driftY: 16, opacity: 0.74 },
            { x: '34%', y: '84%', scale: 0.36, blur: 'blur(0px)', duration: 40, driftX: 14, driftY: -14, opacity: 0.72 },
            { x: '21%', y: '4%', scale: 0.4, blur: 'blur(0px)', duration: 33, driftX: -16, driftY: 12, opacity: 0.7 },
        ];

        if (!backgroundUrl) {
            return baseSlots;
        }

        return baseSlots.map((slot, index) => ({
            ...slot,
            blur: index < 4 ? 'blur(0px)' : slot.blur,
            opacity: index < 4 ? Math.max(slot.opacity - 0.12, 0.34) : Math.max(slot.opacity - 0.18, 0.28),
        }));
    }, [backgroundUrl]);

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
                    quality: 75,
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

    useEffect(() => {
        const rail = thumbnailRailRef.current;
        if (!rail) return;

        const activeThumbnail = rail.querySelector<HTMLElement>(`[data-photo-index="${currentIndex}"]`);
        activeThumbnail?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
        });
    }, [currentIndex]);

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
            {floatingPhotos.map((photo, i) => (
                <OrbitSlot
                    key={`parallax-${photo.id}`}
                    photo={photo}
                    slot={ORBIT_SLOTS[i % ORBIT_SLOTS.length]}
                    prefersReducedMotion={prefersReducedMotion}
                    hasBackdrop={!!backgroundUrl}
                />
            ))}

            {/* Center Vignette to draw focus to hero */}
            <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] pointer-events-none opacity-80" />
            <div className="absolute inset-x-0 bottom-0 z-10 h-48 bg-gradient-to-t from-black/75 via-black/25 to-transparent lg:h-44" />

            {/* ── Center Hero Photo ── */}
            <div className="absolute inset-x-0 top-0 bottom-28 z-20 flex items-center justify-center px-4 pointer-events-none sm:px-8 md:bottom-36 lg:inset-0 lg:px-12">
                <AnimatePresence mode="wait">
                    {currentPhoto && (
                        <motion.div
                            key={currentPhoto.id}
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            className="relative flex items-center justify-center"
                            style={{ willChange: 'transform, opacity' }}
                        >
                            <div className="absolute -inset-8 rounded-full bg-white/12 blur-[72px] sm:-inset-14 sm:blur-[92px]" />

                            <div className="relative h-[48svh] w-[84vw] max-w-[1400px] overflow-hidden rounded-[1.75rem] border border-white/18 bg-black/10 shadow-[0_30px_70px_-32px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:h-[56vh] sm:w-[76vw] sm:rounded-[2rem] md:h-[60vh] lg:h-[70vh] lg:w-[65vw]">
                                <NextImage
                                    src={getPhotoSrc(currentPhoto)}
                                    alt={currentPhoto.senderName ? `Photo from ${currentPhoto.senderName}` : 'Event photo'}
                                    fill
                                    priority
                                    placeholder="blur"
                                    blurDataURL={SOFT_IMAGE_BLUR_DATA_URL}
                                    className="object-cover object-center"
                                    sizes={HERO_IMAGE_SIZES}
                                    quality={85}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
                {currentPhoto && (currentPhoto.message || currentPhoto.senderName) && (
                    <motion.div
                        key={`caption-${currentPhoto.id}`}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ delay: 0.15, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="pointer-events-none absolute inset-x-0 bottom-28 z-30 flex justify-center px-5 sm:bottom-36 sm:px-8 lg:bottom-12"
                    >
                        <div className="max-w-3xl text-center">
                            {currentPhoto.message && (
                                <p className="text-balance text-lg leading-relaxed font-light tracking-[0.01em] text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.85)] sm:text-2xl lg:text-4xl">
                                    &quot;{currentPhoto.message}&quot;
                                </p>
                            )}
                            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.3em] text-white/65 sm:mt-3 sm:text-xs lg:text-sm">
                                — {currentPhoto.senderName || 'Anonymous'}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="absolute inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6 sm:pb-5 lg:hidden">
                <div className="pointer-events-auto overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div ref={thumbnailRailRef} className="flex w-max items-center gap-3 px-4 sm:px-6">
                        {photos.map((photo, index) => {
                            const isActive = index === currentIndex;

                            return (
                                <button
                                    key={`thumb-${photo.id}`}
                                    type="button"
                                    data-photo-index={index}
                                    onClick={() => handleSelectPhoto(index)}
                                    className={`shrink-0 rounded-[1.35rem] border p-1.5 transition-all duration-300 ${isActive
                                        ? 'border-white/22 bg-white/[0.08] shadow-[0_16px_36px_-24px_rgba(255,255,255,0.6)]'
                                        : 'border-white/8 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]'
                                        }`}
                                    aria-label={`Show photo ${index + 1}`}
                                    aria-pressed={isActive}
                                >
                                    <div className="relative h-20 w-16 overflow-hidden rounded-[1rem] bg-black/30 sm:h-24 sm:w-20">
                                        <NextImage
                                            src={getPhotoSrc(photo)}
                                            alt={photo.senderName ? `Thumbnail from ${photo.senderName}` : `Thumbnail ${index + 1}`}
                                            fill
                                            placeholder="blur"
                                            blurDataURL={SOFT_IMAGE_BLUR_DATA_URL}
                                            className="object-cover"
                                            sizes={MOBILE_GALLERY_IMAGE_SIZES}
                                            quality={70}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── "New Photo" Indicator (No Emoji, Premium) ── */}
            <AnimatePresence>
                {isNewPhoto && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -20 }}
                        className="absolute top-20 right-4 sm:top-12 sm:right-12 bg-white text-black px-4 sm:px-6 py-2 sm:py-3 rounded-full shadow-2xl z-30 flex items-center gap-2 border border-white/20"
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
            <div className="absolute top-16 left-6 z-50 sm:hidden">
                <span className="text-white/50 text-[11px] font-medium tracking-[0.18em]">
                    {String(currentIndex + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
                </span>
            </div>

            <div className="absolute bottom-6 left-6 z-50 hidden sm:block sm:bottom-12 sm:left-12">
                <span className="text-white/40 text-xs sm:text-sm font-medium tracking-[0.2em]">
                    {String(currentIndex + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
                </span>
            </div>

            {/* ── QR Code (Bottom Right) ── */}
            {/* Mobile: compact pill button — tap opens modal */}
            <button
                onClick={() => setQrModalOpen(true)}
                className="absolute top-6 right-20 z-50 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-xl shadow-xl transition-all hover:bg-white/15 active:scale-95 sm:hidden"
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
