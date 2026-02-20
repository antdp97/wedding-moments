'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Photo } from '@/lib/types';
import { getPhotos } from '@/lib/api';
import { useLiveWall } from '@/hooks/useLiveWall';

interface LiveWallProps {
    eventSlug: string;
}

export default function LiveWall({ eventSlug }: LiveWallProps) {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isNewPhoto, setIsNewPhoto] = useState(false);
    const [loading, setLoading] = useState(true);

    // Handle new photo from WebSocket
    const handlePhotoApproved = useCallback((newPhoto: Photo) => {
        setPhotos((prev) => [newPhoto, ...prev]);
        // Jump to new photo
        setCurrentIndex(0);
        setIsNewPhoto(true);
    }, []);

    // Connect to WebSocket
    const { isConnected, connectionError } = useLiveWall({
        eventSlug,
        onPhotoApproved: handlePhotoApproved,
    });

    // Load initial photos from API
    useEffect(() => {
        async function fetchPhotos() {
            try {
                const data = await getPhotos(eventSlug);
                setPhotos(data);
            } catch (error) {
                console.error('Failed to fetch photos:', error);
                // No mock data — will show "Waiting for Photos" state
                setPhotos([]);
            } finally {
                setLoading(false);
            }
        }
        fetchPhotos();
    }, [eventSlug]);

    // Cycle Slideshow
    useEffect(() => {
        const interval = setInterval(() => {
            if (photos.length > 0) {
                setCurrentIndex((prev) => (prev + 1) % photos.length);
                setIsNewPhoto(false);
            }
        }, 5000); // 5 seconds per slide
        return () => clearInterval(interval);
    }, [photos.length]);

    const currentPhoto = photos[currentIndex];
    const uploadUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${eventSlug}`;

    if (loading) {
        return (
            <div className="w-full h-screen bg-black flex items-center justify-center">
                <div className="text-white text-2xl animate-pulse">Loading...</div>
            </div>
        );
    }

    if (photos.length === 0) {
        return (
            <div className="relative w-full h-screen bg-gradient-to-br from-gray-900 to-black flex flex-col items-center justify-center">
                <div className="text-center space-y-6">
                    <h1 className="text-white text-4xl font-bold font-serif">
                        Waiting for Photos...
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Scan the QR code to upload the first photo!
                    </p>
                </div>

                {/* QR Code */}
                <div className="absolute bottom-8 right-8 bg-white p-4 rounded-xl shadow-2xl z-50 flex flex-col items-center gap-2">
                    <QRCodeSVG value={uploadUrl} size={128} />
                    <p className="text-black font-bold text-sm tracking-wider">{eventSlug}</p>
                </div>

                {/* Connection Status */}
                <div className="absolute top-8 right-8 flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-white text-sm">
                        {isConnected ? 'Live' : connectionError || 'Connecting...'}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center">
            <AnimatePresence mode="wait">
                {currentPhoto && (
                    <motion.div
                        key={currentPhoto.id}
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: 'easeInOut' }}
                        className="absolute inset-0 w-full h-full"
                    >
                        {/* Background Blur */}
                        <div
                            className="absolute inset-0 bg-cover bg-center blur-3xl opacity-50"
                            style={{ backgroundImage: `url(${currentPhoto.url})` }}
                        />

                        {/* Main Image */}
                        <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-8">
                            <motion.img
                                src={currentPhoto.url}
                                alt="Event photo"
                                className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl border-4 border-white/10"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            />

                            {/* Message Overlay */}
                            {(currentPhoto.message || currentPhoto.senderName) && (
                                <motion.div
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="absolute bottom-12 bg-black/60 backdrop-blur-md text-white px-8 py-4 rounded-full flex flex-col items-center shadow-xl"
                                >
                                    <span className="text-2xl font-bold font-serif">
                                        {currentPhoto.message}
                                    </span>
                                    <span className="text-sm text-gray-300 uppercase tracking-widest mt-1">
                                        — {currentPhoto.senderName || 'Anonymous'}
                                    </span>
                                </motion.div>
                            )}
                        </div>

                        {/* "New Photo" Indicator */}
                        {isNewPhoto && (
                            <motion.div
                                initial={{ scale: 0, rotate: -10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                className="absolute top-10 right-10 bg-accent text-accent-foreground px-6 py-2 text-xl font-bold rounded-full shadow-lg z-20 border-4 border-white transform rotate-12"
                            >
                                🎉 NEW PHOTO!
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Persistent QR Overlay */}
            <div className="absolute bottom-8 right-8 bg-white p-4 rounded-xl shadow-2xl z-50 flex flex-col items-center gap-2">
                <QRCodeSVG value={uploadUrl} size={128} />
                <p className="text-black font-bold text-sm tracking-wider">{eventSlug}</p>
            </div>

            {/* Title & Connection Status Overlay */}
            <div className="absolute top-8 left-8 z-50 flex items-center gap-4">
                <h1 className="text-white/80 text-4xl font-serif font-bold drop-shadow-lg">
                    {eventSlug.toUpperCase().replace(/-/g, ' ')}
                </h1>
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            </div>

            {/* Photo Counter */}
            <div className="absolute top-8 right-8 z-50 text-white/60 text-sm">
                {currentIndex + 1} / {photos.length}
            </div>
        </div>
    );
}
