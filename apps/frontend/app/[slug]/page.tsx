"use client";

import { useEffect, useState, use } from "react";
import GuestUploader from "@/components/GuestUploader";
import { getEventBySlug } from "@/lib/api";
import { Loader2, MonitorPlay } from "lucide-react";
import Link from "next/link";

export default function EventPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [eventId, setEventId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchEvent() {
            try {
                const eventData = await getEventBySlug(slug);
                setEventId(eventData.id);
            } catch (err) {
                console.error("Failed to load event:", err);
                setError("Event not found or inactive.");
            } finally {
                setLoading(false);
            }
        }
        fetchEvent();
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center bg-background gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading Event...</p>
            </div>
        );
    }

    if (error || !eventId) {
        return (
            <div className="min-h-screen min-h-dvh flex flex-col items-center justify-center bg-background px-4 text-center">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h1 className="text-3xl font-black mb-3">Oops!</h1>
                <p className="text-muted-foreground max-w-sm mx-auto">{error}</p>
            </div>
        );
    }

    return (
        <main className="min-h-screen min-h-dvh bg-background flex flex-col items-center justify-center px-4 py-24 sm:p-4 relative overflow-hidden">
            {/* Top Brand Bar */}
            <div className="fixed left-0 top-0 w-full z-50 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-2xl px-4 sm:px-8 py-4">
                <p className="font-bold text-primary text-base sm:text-lg tracking-[0.2em] uppercase">
                    Wedding Memos
                </p>
                <Link
                    href={`/live/${slug}`}
                    className="flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wider uppercase text-primary/80 hover:text-primary bg-primary/5 hover:bg-primary/10 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full backdrop-blur-md transition-all duration-300 border border-primary/10 hover:border-primary/20 active:scale-95"
                >
                    <MonitorPlay className="w-4 h-4 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">View Live Wall</span>
                    <span className="sm:hidden">Live</span>
                </Link>
            </div>

            <div className="z-10 w-full max-w-md flex flex-col items-center gap-8 sm:gap-10 mt-8 sm:mt-0">
                <div className="text-center space-y-4 sm:space-y-5">
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter text-primary">
                        Share Your<br />Moment
                    </h1>
                    <p className="text-sm sm:text-base leading-relaxed text-muted-foreground font-light max-w-xs mx-auto">
                        Snap a photo or video and join the celebration on the big screen instantly.
                    </p>
                </div>

                <GuestUploader eventId={eventId} eventSlug={slug} />
            </div>
        </main>
    );
}
