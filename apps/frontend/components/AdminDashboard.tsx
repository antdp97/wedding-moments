'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, Shield, RefreshCw, Wifi, WifiOff, Trash2, Upload, ImageIcon, ArrowLeft, Plus, Calendar, Image as ImageLucide, Pencil, QrCode } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Photo, PhotoStatus, BackgroundImage, EventWithCounts } from '@/lib/types';
import {
    getAdminPhotos, getEventStats, updatePhotoStatus, deletePhoto,
    getPresignedUrl, uploadFile, createBackground, getBackgrounds,
    activateBackground, deactivateAllBackgrounds, deleteBackgroundImage,
    getAdminEvents, createAdminEvent, updateAdminEvent, deleteAdminEvent
} from '@/lib/api';
import { useAdminSocket } from '@/hooks/useLiveWall';
import { QRCodeModal } from './QRCodeModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const { t } = useLanguage();

    // ─── Event Management State ───
    const [events, setEvents] = useState<EventWithCounts[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

    // ─── Create Event Dialog State ───
    const [showCreateEvent, setShowCreateEvent] = useState(false);
    const [newEventName, setNewEventName] = useState('');
    const [newEventSlug, setNewEventSlug] = useState('');
    const [creating, setCreating] = useState(false);

    // ─── Edit Event Dialog State ───
    const [editingEvent, setEditingEvent] = useState<{ id: string, slug: string, name: string } | null>(null);
    const [updating, setUpdating] = useState(false);

    // ─── Photo Management State (active only when selectedSlug is set) ───
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [stats, setStats] = useState({ totalPhotos: 0, pendingCount: 0, approvedCount: 0 });
    const [loading, setLoading] = useState(true);

    // Background image state
    const [backgrounds, setBackgrounds] = useState<BackgroundImage[]>([]);
    const [bgUploading, setBgUploading] = useState(false);

    // QR Code Modal
    const [isQRModalOpen, setQRModalOpen] = useState(false);

    // WebSocket for real-time stats updates
    const handleStatUpdate = useCallback((newStats: { totalPhotos: number; pendingCount: number }) => {
        setStats(prev => ({ ...prev, ...newStats }));
        // fetchPhotos(); // removed to prevent infinite loops, stats update shouldn't always refetch all photos
    }, []);

    const { isConnected } = useAdminSocket({
        eventSlug: isAuthenticated && selectedSlug ? selectedSlug : '',
        onStatUpdate: handleStatUpdate,
    });

    // ─── Event List Functions ───

    const fetchEvents = useCallback(async () => {
        setEventsLoading(true);
        try {
            const data = await getAdminEvents();
            setEvents(data);
        } catch (error) {
            console.error('Failed to fetch events:', error);
            toast.error('Failed to load events');
        } finally {
            setEventsLoading(false);
        }
    }, []);

    async function handleCreateEvent(e: React.FormEvent) {
        e.preventDefault();
        if (!newEventName.trim() || !newEventSlug.trim()) {
            toast.error('Name and slug are required');
            return;
        }
        setCreating(true);
        try {
            await createAdminEvent({
                name: newEventName.trim(),
                slug: newEventSlug.trim().toLowerCase().replace(/\s+/g, '-'),
            });
            toast.success('Event created!');
            setShowCreateEvent(false);
            setNewEventName('');
            setNewEventSlug('');
            fetchEvents();
        } catch (error: unknown) {
            console.error('Failed to create event:', error);
            const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create event';
            toast.error(message);
        } finally {
            setCreating(false);
        }
    }

    async function handleDeleteEvent(slug: string) {
        if (!confirm('Are you absolutely sure? This will permanently delete the event and all its photos. This action cannot be undone.')) return;
        try {
            await deleteAdminEvent(slug);
            toast.success('Event deleted');
            if (selectedSlug === slug) setSelectedSlug(null);
            fetchEvents();
        } catch (error) {
            console.error('Failed to delete event:', error);
            toast.error('Failed to delete event');
        }
    }

    async function submitUpdateEvent(e: React.FormEvent) {
        e.preventDefault();
        if (!editingEvent?.name.trim()) return;
        setUpdating(true);
        try {
            await updateAdminEvent(editingEvent.slug, { name: editingEvent.name.trim() });
            toast.success('Event renamed successfully');
            setEditingEvent(null);
            fetchEvents();
        } catch (error) {
            console.error('Failed to update event:', error);
            toast.error('Failed to rename event');
        } finally {
            setUpdating(false);
        }
    }

    // ─── Photo Management Functions ───

    const fetchPhotos = useCallback(async () => {
        if (!selectedSlug) return;
        try {
            const data = await getAdminPhotos(selectedSlug);
            setPhotos(data);
        } catch (error) {
            console.error('Failed to fetch photos:', error);
            toast.error('Failed to load photos');
        }
    }, [selectedSlug]);

    const fetchStats = useCallback(async () => {
        if (!selectedSlug) return;
        try {
            const data = await getEventStats(selectedSlug);
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }, [selectedSlug]);

    const fetchBackgrounds = useCallback(async () => {
        if (!selectedSlug) return;
        try {
            const data = await getBackgrounds(selectedSlug);
            setBackgrounds(data);
        } catch (error) {
            console.error('Failed to fetch backgrounds:', error);
        }
    }, [selectedSlug]);

    // Load events on auth
    useEffect(() => {
        if (!isAuthenticated) return;
        fetchEvents();
    }, [isAuthenticated, fetchEvents]);

    // Load event data when slug selected
    useEffect(() => {
        if (!selectedSlug) return;
        async function loadData() {
            setLoading(true);
            await Promise.all([fetchPhotos(), fetchStats(), fetchBackgrounds()]);
            setLoading(false);
        }
        loadData();
    }, [selectedSlug, fetchPhotos, fetchStats, fetchBackgrounds]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'TnuRosy2803!') {
            setIsAuthenticated(true);
            toast.success('Welcome back, Host!');
        } else {
            toast.error('Invalid password');
        }
    };

    const handleUpdateStatus = async (photoId: string, status: PhotoStatus) => {
        try {
            await updatePhotoStatus(photoId, status);
            setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, status } : p));
            toast.success(`Photo ${status.toLowerCase()}`);
            fetchStats();
        } catch (error) {
            console.error('Failed to update photo status:', error);
            toast.error('Failed to update photo');
        }
    };

    const handleDelete = async (photoId: string) => {
        if (!confirm('Are you sure you want to permanently delete this photo?')) return;
        try {
            await deletePhoto(photoId);
            setPhotos(prev => prev.filter(p => p.id !== photoId));
            toast.success('Photo deleted');
            fetchStats();
        } catch (error) {
            console.error('Failed to delete photo:', error);
            toast.error('Failed to delete photo');
        }
    };

    // ─── Background handlers ───

    const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedSlug) return;
        setBgUploading(true);
        try {
            const presigned = await getPresignedUrl(file.name, file.type);
            const photoUrl = await uploadFile(presigned, file);
            await createBackground(selectedSlug, photoUrl, file.name);
            toast.success('Background uploaded');
            await fetchBackgrounds();
        } catch (error) {
            console.error('Failed to upload background:', error);
            toast.error('Failed to upload background');
        } finally {
            setBgUploading(false);
            e.target.value = '';
        }
    };

    const handleActivateBg = async (id: string) => {
        try {
            await activateBackground(id);
            setBackgrounds(prev => prev.map(bg => ({ ...bg, isActive: bg.id === id })));
            toast.success('Background activated');
        } catch (error) {
            console.error('Failed to activate background:', error);
            toast.error('Failed to activate background');
        }
    };

    const handleDeactivateAll = async () => {
        if (!selectedSlug) return;
        try {
            await deactivateAllBackgrounds(selectedSlug);
            setBackgrounds(prev => prev.map(bg => ({ ...bg, isActive: false })));
            toast.success('Reverted to default background');
        } catch (error) {
            console.error('Failed to deactivate backgrounds:', error);
            toast.error('Failed to revert background');
        }
    };

    const handleDeleteBg = async (id: string) => {
        if (!confirm('Delete this background image?')) return;
        try {
            await deleteBackgroundImage(id);
            setBackgrounds(prev => prev.filter(bg => bg.id !== id));
            toast.success('Background deleted');
        } catch (error) {
            console.error('Failed to delete background:', error);
            toast.error('Failed to delete background');
        }
    };

    const handleRefresh = async () => {
        if (selectedSlug) {
            await Promise.all([fetchPhotos(), fetchStats(), fetchBackgrounds()]);
        } else {
            await fetchEvents();
        }
        toast.success('Refreshed');
    };

    const handleBackToEvents = () => {
        setSelectedSlug(null);
        setPhotos([]);
        setStats({ totalPhotos: 0, pendingCount: 0, approvedCount: 0 });
        setBackgrounds([]);
        fetchEvents();
    };

    // ═══════════════════════════════════════
    // LOGIN SCREEN
    // ═══════════════════════════════════════

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-sm shadow-xl border-border/50 bg-card">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            <Shield className="w-6 h-6 text-primary" />
                            Host Login
                        </CardTitle>
                        <CardDescription>Enter your password to access the dashboard</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="admin"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="border-border/50 focus:border-primary/50 transition-colors"
                                />
                            </div>
                            <Button type="submit" className="w-full shadow-md hover:shadow-lg transition-all duration-300">
                                Access Dashboard
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ═══════════════════════════════════════
    // EVENT LIST VIEW (No event selected)
    // ═══════════════════════════════════════

    if (!selectedSlug) {
        return (
            <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div>
                                <h1 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">{t('app_title')}</h1>
                                <p className="text-sm sm:text-base text-muted-foreground mt-1">Select an event to manage or create a new one</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <LanguageToggle />
                            <Button variant="outline" size="sm" onClick={handleRefresh} className="shadow-sm hover:bg-muted/50 transition-colors">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>
                            <Button size="sm" onClick={() => setShowCreateEvent(true)} className="shadow-md hover:shadow-lg transition-all">
                                <Plus className="w-4 h-4 mr-2" />
                                New Event
                            </Button>
                        </div>
                    </div>

                    {/* Edit Event Dialog */}
                    {editingEvent && (
                        <Card className="border-primary/30 shadow-2xl relative overflow-hidden bg-white/95 dark:bg-black/95 backdrop-blur-xl">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xl font-bold">Rename Event</CardTitle>
                                <CardDescription>Update the display name for {editingEvent.slug}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submitUpdateEvent} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="editEventName">Event Name</Label>
                                        <Input
                                            id="editEventName"
                                            value={editingEvent.name}
                                            onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                                            className="border-border/50 focus:border-primary transition-colors"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-3 justify-end pt-2">
                                        <Button type="button" variant="ghost" onClick={() => setEditingEvent(null)} className="hover:bg-muted/50">
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={updating || !editingEvent.name.trim()} className="shadow-md">
                                            {updating ? 'Saving...' : 'Save Changes'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {/* Create Event Dialog */}
                    {showCreateEvent && (
                        <Card className="border-primary/30 shadow-2xl relative overflow-hidden bg-white/95 dark:bg-black/95 backdrop-blur-xl">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xl font-bold">Create New Event</CardTitle>
                                <CardDescription>Set up a new event with a unique slug for the upload URL</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleCreateEvent} className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="space-y-2">
                                            <Label htmlFor="eventName" className="font-medium">Event Name</Label>
                                            <Input
                                                id="eventName"
                                                placeholder="e.g. Rosy & Tnu Wedding"
                                                value={newEventName}
                                                className="border-border/50 focus:border-primary transition-colors"
                                                onChange={(e) => {
                                                    setNewEventName(e.target.value);
                                                    if (!newEventSlug || newEventSlug === newEventName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')) {
                                                        setNewEventSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="eventSlug" className="font-medium">Event Slug (URL)</Label>
                                            <Input
                                                id="eventSlug"
                                                placeholder="e.g. rosy-tnu-wedding"
                                                value={newEventSlug}
                                                className="border-border/50 focus:border-primary transition-colors"
                                                onChange={(e) => setNewEventSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Upload URL: <span className="text-primary font-mono bg-primary/5 px-1 rounded">yoursite.com/{newEventSlug || 'event-slug'}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 justify-end pt-2">
                                        <Button type="button" variant="ghost" onClick={() => { setShowCreateEvent(false); setNewEventName(''); setNewEventSlug(''); }} className="hover:bg-muted/50">
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={creating || !newEventName.trim()} className="shadow-md">
                                            {creating ? 'Creating...' : 'Create Event'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {/* Loading — skeleton event cards */}
                    {eventsLoading && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="rounded-2xl border border-border/40 bg-card p-6 space-y-4 shadow-sm">
                                    <div className="space-y-2">
                                        <Skeleton className="h-6 w-3/4" />
                                        <Skeleton className="h-4 w-24 rounded-full" />
                                    </div>
                                    <div className="flex items-center justify-between pt-1">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-4 w-16" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {!eventsLoading && events.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 px-4 text-center space-y-5 rounded-2xl border-2 border-dashed border-border/60 bg-muted/10">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Calendar className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">No events yet</h3>
                                <p className="text-muted-foreground mt-1">Create your first event to get started</p>
                            </div>
                            <Button onClick={() => setShowCreateEvent(true)} className="shadow-md hover:shadow-lg transition-all">
                                <Plus className="w-5 h-5 mr-2" />
                                Create Your First Event
                            </Button>
                        </div>
                    )}

                    {/* Event Grid */}
                    {!eventsLoading && events.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {events.map((event) => (
                                <Card
                                    key={event.id}
                                    className="group relative cursor-pointer overflow-hidden border-border/40 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 bg-card"
                                    onClick={() => setSelectedSlug(event.slug)}
                                >
                                    {/* Edit / Delete Hover Actions */}
                                    <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bg-background/80 backdrop-blur-sm rounded-md p-1 border border-border/50 shadow-sm">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors rounded"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingEvent(event);
                                                setShowCreateEvent(false); // Make sure create is closed
                                            }}
                                            title="Rename Event"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors rounded"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteEvent(event.slug);
                                            }}
                                            title="Delete Event"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    <CardHeader className="pb-3 pt-6 relative z-0">
                                        <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors pr-16 line-clamp-1">
                                            {event.name}
                                        </CardTitle>
                                        <CardDescription className="font-mono text-xs inline-flex items-center px-2 py-0.5 rounded bg-muted/50 mt-1.5 w-max z-0">
                                            /{event.slug}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pb-6 relative z-0">
                                        <div className="flex items-center justify-between text-sm text-muted-foreground w-full">
                                            <div className="flex items-center gap-4">
                                                <span className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <ImageLucide className="w-4 h-4" />
                                                    <span className="font-medium">{event._count.photos}</span> photos
                                                </span>
                                            </div>
                                            <span className="flex items-center gap-1.5 opacity-60 text-xs">
                                                {new Date(event.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </CardContent>
                                    {/* Decorative gradient line */}
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════
    // PHOTO MANAGEMENT VIEW (Event selected)
    // ═══════════════════════════════════════

    return (
        <div className="min-h-screen min-h-dvh bg-background p-3 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-card p-4 sm:p-6 rounded-2xl border border-border/50 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={handleBackToEvents} className="shrink-0 rounded-full w-10 h-10 hover:bg-muted/50 shadow-sm">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                                {events.find(e => e.slug === selectedSlug)?.name || selectedSlug}
                            </h1>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-sm text-muted-foreground font-mono bg-muted/30 px-2 py-0.5 rounded inline-block">/{selectedSlug}</p>
                                <Button variant="outline" size="sm" onClick={() => setQRModalOpen(true)} className="h-7 text-xs px-2 gap-1.5 rounded-md text-primary hover:text-primary">
                                    <QrCode className="w-3.5 h-3.5" />
                                    Show QR
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <LanguageToggle />
                        <div className="flex items-center gap-2 bg-background border px-4 py-2 rounded-full text-sm font-semibold shadow-sm">
                            {isConnected ? (
                                <><Wifi className="w-4 h-4 text-green-500" /><span className="text-green-600 dark:text-green-400">Live</span></>
                            ) : (
                                <><WifiOff className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">Offline</span></>
                            )}
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRefresh} className="rounded-full shadow-sm hover:shadow-md transition-shadow">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 sm:gap-6">
                    <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                        <div className="h-1 w-full bg-blue-500/20 group-hover:bg-blue-500/40 transition-colors" />
                        <CardHeader className="p-4 sm:p-6">
                            <CardDescription className="text-xs sm:text-sm font-medium uppercase tracking-wider">Total Uploads</CardDescription>
                            {loading ? <Skeleton className="h-10 w-16 mt-1" /> : <CardTitle className="text-3xl sm:text-5xl font-black">{stats.totalPhotos}</CardTitle>}
                        </CardHeader>
                    </Card>
                    <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                        <div className="h-1 w-full bg-yellow-500/20 group-hover:bg-yellow-500/40 transition-colors" />
                        <CardHeader className="p-4 sm:p-6">
                            <CardDescription className="text-xs sm:text-sm font-medium uppercase tracking-wider">Pending Review</CardDescription>
                            {loading ? <Skeleton className="h-10 w-12 mt-1" /> : <CardTitle className="text-3xl sm:text-5xl font-black text-yellow-600 dark:text-yellow-500">{stats.pendingCount}</CardTitle>}
                        </CardHeader>
                    </Card>
                    <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                        <div className="h-1 w-full bg-green-500/20 group-hover:bg-green-500/40 transition-colors" />
                        <CardHeader className="p-4 sm:p-6">
                            <CardDescription className="text-xs sm:text-sm font-medium uppercase tracking-wider">Live on Screen</CardDescription>
                            {loading ? <Skeleton className="h-10 w-12 mt-1" /> : <CardTitle className="text-3xl sm:text-5xl font-black text-green-600 dark:text-green-500">{stats.approvedCount}</CardTitle>}
                        </CardHeader>
                    </Card>
                </div>

                {/* Loading State — skeleton photo grid */}
                {loading && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && photos.length === 0 && (
                    <div className="text-center py-20 px-4 rounded-2xl border-2 border-dashed border-border/60 bg-muted/10">
                        <ImageLucide className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-xl font-bold text-foreground">No photos yet</h3>
                        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                            Share the QR code with guests. Photos will appear here as soon as they are uploaded.
                        </p>
                    </div>
                )}

                {/* Photo Grid */}
                {!loading && photos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-5">
                        {photos.map((photo) => (
                            <div key={photo.id} className="group relative aspect-[3/4] bg-muted/20 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-border/40">
                                <img src={photo.thumbnailUrl ?? photo.url} alt={photo.senderName || 'Guest'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" decoding="async" />

                                {/* Status Badge */}
                                <div className={`absolute top-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-md z-10 backdrop-blur-md
                                    ${photo.status === PhotoStatus.APPROVED ? 'bg-green-500/90 text-white' :
                                        photo.status === PhotoStatus.REJECTED ? 'bg-red-500/90 text-white' :
                                            'bg-yellow-400/90 text-black'}`
                                }>
                                    {photo.status}
                                </div>

                                {/* Actions Overlay */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                                    <div className="flex gap-3 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                        <Button
                                            className="rounded-full w-14 h-14 bg-green-500 hover:bg-green-600 hover:scale-110 shadow-lg text-white border-none transition-all"
                                            onClick={() => handleUpdateStatus(photo.id, PhotoStatus.APPROVED)}
                                            title="Approve"
                                        >
                                            <Check className="w-7 h-7" />
                                        </Button>
                                        <Button
                                            className="rounded-full w-14 h-14 bg-yellow-500 hover:bg-yellow-600 hover:scale-110 shadow-lg text-white border-none transition-all"
                                            onClick={() => handleUpdateStatus(photo.id, PhotoStatus.REJECTED)}
                                            title="Reject"
                                        >
                                            <X className="w-7 h-7" />
                                        </Button>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full bg-black/40 border-white/20 hover:bg-red-600 hover:border-red-600 text-white mt-1 translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75 shadow-lg"
                                        onClick={() => handleDelete(photo.id)}
                                        title="Delete Permanently"
                                    >
                                        <Trash2 className="w-4 h-4 mr-1.5" />
                                        Delete
                                    </Button>
                                </div>

                                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-12 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                    <p className="text-sm font-bold truncate line-clamp-1">{photo.senderName || ''}</p>
                                    <p className="text-[10px] text-gray-300 font-medium tracking-wide mt-0.5 opacity-80">
                                        {new Date(photo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ─── Background Management Section ─── */}
                <Card className="border-border/40 shadow-sm overflow-hidden">
                    <div className="h-1 w-full bg-gradient-to-r from-muted-foreground/10 via-muted-foreground/30 to-muted-foreground/10" />
                    <CardHeader className="p-4 sm:p-6 bg-muted/5">
                        <CardTitle className="text-lg sm:text-xl flex items-center gap-2.5 font-bold">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <ImageIcon className="w-5 h-5 text-primary" />
                            </div>
                            Live Wall Background
                        </CardTitle>
                        <CardDescription className="text-sm mt-1">
                            Customize the background image displayed on the live presentation screen.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-5 space-y-6">
                        {/* Upload area */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <label className="flex-1 flex items-center justify-center gap-3 border-2 border-dashed border-border/70 hover:border-primary/50 hover:bg-primary/5 rounded-xl p-5 cursor-pointer transition-all hover:shadow-sm">
                                <Upload className="w-5 h-5 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">
                                    {bgUploading ? 'Uploading...' : 'Upload New Background'}
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={bgUploading}
                                    onChange={handleBgUpload}
                                />
                            </label>
                            {backgrounds.some(b => b.isActive) && (
                                <Button
                                    variant="secondary"
                                    className="whitespace-nowrap h-auto py-5 shadow-sm"
                                    onClick={handleDeactivateAll}
                                >
                                    Revert to Default
                                </Button>
                            )}
                        </div>

                        {/* Background grid */}
                        {backgrounds.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {backgrounds.map((bg) => (
                                    <div
                                        key={bg.id}
                                        className={`group relative aspect-video rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${bg.isActive
                                            ? 'border-green-500 shadow-lg shadow-green-500/20 scale-[1.02]'
                                            : 'border-border/50 hover:border-primary/40'
                                            }`}
                                        onClick={() => handleActivateBg(bg.id)}
                                    >
                                        <img
                                            src={bg.url}
                                            alt={bg.name || 'Background'}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            loading="lazy"
                                            decoding="async"
                                        />
                                        {bg.isActive && (
                                            <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-black px-2 py-1 rounded shadow-md tracking-wider">
                                                ACTIVE
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 backdrop-blur-[1px]">
                                            <div className="flex gap-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                                {!bg.isActive && (
                                                    <Button size="sm" className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 shadow-lg font-medium">
                                                        Activate
                                                    </Button>
                                                )}
                                                <Button
                                                    size="icon"
                                                    variant="destructive"
                                                    className="h-8 w-8 shadow-lg"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteBg(bg.id);
                                                    }}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* QR Code Modal for Printing/Scanning */}
                {selectedSlug && (
                    <QRCodeModal
                        isOpen={isQRModalOpen}
                        onClose={() => setQRModalOpen(false)}
                        url={`${typeof window !== 'undefined' ? window.location.origin : ''}/${selectedSlug}`}
                        eventName={events.find(e => e.slug === selectedSlug)?.name || selectedSlug}
                    />
                )}
            </div>
        </div>
    );
}
