'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, Download, Shield, Settings, RefreshCw, Wifi, WifiOff, Trash2, Upload, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Photo, PhotoStatus, BackgroundImage } from '@/lib/types';
import {
    getAdminPhotos, getEventStats, updatePhotoStatus, deletePhoto,
    getPresignedUrl, uploadFile, createBackground, getBackgrounds,
    activateBackground, deactivateAllBackgrounds, deleteBackgroundImage,
} from '@/lib/api';
import { useAdminSocket } from '@/hooks/useLiveWall';

const EVENT_SLUG = 'demo-event';

export default function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [stats, setStats] = useState({ totalPhotos: 0, pendingCount: 0, approvedCount: 0 });
    const [loading, setLoading] = useState(true);

    // Background image state
    const [backgrounds, setBackgrounds] = useState<BackgroundImage[]>([]);
    const [bgUploading, setBgUploading] = useState(false);

    // WebSocket for real-time stats updates
    const handleStatUpdate = useCallback((newStats: { totalPhotos: number; pendingCount: number }) => {
        setStats(prev => ({ ...prev, ...newStats }));
        // Refresh photo list when stats change (new upload or status change)
        fetchPhotos();
    }, []);

    const { isConnected } = useAdminSocket({
        eventSlug: isAuthenticated ? EVENT_SLUG : '',
        onStatUpdate: handleStatUpdate,
    });

    async function fetchPhotos() {
        try {
            const data = await getAdminPhotos(EVENT_SLUG);
            setPhotos(data);
        } catch (error) {
            console.error('Failed to fetch photos:', error);
            toast.error('Failed to load photos');
        }
    }

    async function fetchStats() {
        try {
            const data = await getEventStats(EVENT_SLUG);
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }

    async function fetchBackgrounds() {
        try {
            const data = await getBackgrounds(EVENT_SLUG);
            setBackgrounds(data);
        } catch (error) {
            console.error('Failed to fetch backgrounds:', error);
        }
    }

    // Load data on authentication
    useEffect(() => {
        if (!isAuthenticated) return;

        async function loadData() {
            setLoading(true);
            await Promise.all([fetchPhotos(), fetchStats(), fetchBackgrounds()]);
            setLoading(false);
        }
        loadData();
    }, [isAuthenticated]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'admin') {
            setIsAuthenticated(true);
            toast.success('Welcome back, Host!');
        } else {
            toast.error('Invalid password');
        }
    };

    const handleUpdateStatus = async (photoId: string, status: PhotoStatus) => {
        try {
            await updatePhotoStatus(photoId, status);
            // Update local state immediately for responsiveness
            setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, status } : p));
            toast.success(`Photo ${status.toLowerCase()}`);
            // Refresh stats
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
        if (!file) return;

        setBgUploading(true);
        try {
            const presigned = await getPresignedUrl(file.name, file.type);
            const photoUrl = await uploadFile(presigned, file);
            await createBackground(EVENT_SLUG, photoUrl, file.name);
            toast.success('Background uploaded');
            await fetchBackgrounds();
        } catch (error) {
            console.error('Failed to upload background:', error);
            toast.error('Failed to upload background');
        } finally {
            setBgUploading(false);
            e.target.value = ''; // reset file input
        }
    };

    const handleActivateBg = async (id: string) => {
        try {
            await activateBackground(id);
            setBackgrounds(prev =>
                prev.map(bg => ({ ...bg, isActive: bg.id === id }))
            );
            toast.success('Background activated');
        } catch (error) {
            console.error('Failed to activate background:', error);
            toast.error('Failed to activate background');
        }
    };

    const handleDeactivateAll = async () => {
        try {
            await deactivateAllBackgrounds(EVENT_SLUG);
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
        await Promise.all([fetchPhotos(), fetchStats(), fetchBackgrounds()]);
        toast.success('Refreshed');
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-sm shadow-xl">
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
                                />
                            </div>
                            <Button type="submit" className="w-full">Access Dashboard</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen min-h-dvh bg-background p-3 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl sm:text-3xl font-bold text-foreground">Wedding Memos Dashboard</h1>
                        <p className="text-sm sm:text-base text-muted-foreground">Manage your event stream and photos</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Connection Status */}
                        <div className="flex items-center gap-2 bg-card border px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
                            {isConnected ? (
                                <><Wifi className="w-4 h-4 text-green-500" /><span className="text-green-600">Live</span></>
                            ) : (
                                <><WifiOff className="w-4 h-4 text-gray-400" /><span className="text-gray-500">Offline</span></>
                            )}
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRefresh}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <Card>
                        <CardHeader className="p-3 sm:pb-2 sm:p-6">
                            <CardDescription className="text-xs sm:text-sm">Total Uploads</CardDescription>
                            <CardTitle className="text-2xl sm:text-4xl">{stats.totalPhotos}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="p-3 sm:pb-2 sm:p-6">
                            <CardDescription className="text-xs sm:text-sm">Pending Review</CardDescription>
                            <CardTitle className="text-2xl sm:text-4xl text-yellow-600 dark:text-yellow-500">
                                {stats.pendingCount}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="p-3 sm:pb-2 sm:p-6">
                            <CardDescription className="text-xs sm:text-sm">Live on Screen</CardDescription>
                            <CardTitle className="text-2xl sm:text-4xl text-green-600 dark:text-green-500">
                                {stats.approvedCount}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {/* Empty State */}
                {!loading && photos.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <p className="text-lg">No photos uploaded yet.</p>
                        <p className="text-sm mt-1">Photos will appear here when guests upload them.</p>
                    </div>
                )}

                {/* Grid */}
                {!loading && photos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                        {photos.map((photo) => (
                            <div key={photo.id} className="group relative aspect-square bg-card rounded-xl overflow-hidden shadow-sm border border-border">
                                <img src={photo.url} alt={photo.senderName || 'Guest'} className="w-full h-full object-cover transition-transform group-hover:scale-105" />

                                {/* Status Badge */}
                                <div className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm z-10
                                    ${photo.status === PhotoStatus.APPROVED ? 'bg-green-500 text-white' :
                                        photo.status === PhotoStatus.REJECTED ? 'bg-red-500 text-white' :
                                            'bg-yellow-400 text-black'}`
                                }>
                                    {photo.status}
                                </div>

                                {/* Actions Overlay */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
                                    <div className="flex gap-2">
                                        <Button
                                            className="rounded-full w-12 h-12 bg-green-500 hover:bg-green-600 text-white border-none"
                                            onClick={() => handleUpdateStatus(photo.id, PhotoStatus.APPROVED)}
                                            title="Approve"
                                        >
                                            <Check className="w-6 h-6" />
                                        </Button>
                                        <Button
                                            className="rounded-full w-12 h-12 bg-yellow-500 hover:bg-yellow-600 text-white border-none"
                                            onClick={() => handleUpdateStatus(photo.id, PhotoStatus.REJECTED)}
                                            title="Reject"
                                        >
                                            <X className="w-6 h-6" />
                                        </Button>
                                    </div>
                                    <Button
                                        className="rounded-full w-12 h-8 bg-red-600 hover:bg-red-700 text-white border-none mt-2"
                                        onClick={() => handleDelete(photo.id)}
                                        title="Delete Permanently"
                                    >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        Delete
                                    </Button>
                                </div>

                                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 text-white">
                                    <p className="text-sm font-medium">{photo.senderName || 'Anonymous'}</p>
                                    <p className="text-xs text-gray-300">
                                        {new Date(photo.createdAt).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ─── Background Management Section ─── */}
                <Card className="border-border/50">
                    <CardHeader className="p-3 sm:p-6">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                            <ImageIcon className="w-5 h-5" />
                            Live Wall Background
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Upload and manage background images for the live event screen
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 space-y-4">
                        {/* Upload area */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 rounded-xl p-4 cursor-pointer transition-colors">
                                <Upload className="w-5 h-5 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {bgUploading ? 'Uploading...' : 'Upload Background Image'}
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
                                    variant="outline"
                                    size="sm"
                                    className="whitespace-nowrap"
                                    onClick={handleDeactivateAll}
                                >
                                    Use Default
                                </Button>
                            )}
                        </div>

                        {/* Background grid */}
                        {backgrounds.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                                {backgrounds.map((bg) => (
                                    <div
                                        key={bg.id}
                                        className={`group relative aspect-video rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${bg.isActive
                                            ? 'border-green-500 shadow-lg shadow-green-500/20'
                                            : 'border-transparent hover:border-primary/50'
                                            }`}
                                        onClick={() => handleActivateBg(bg.id)}
                                    >
                                        <img
                                            src={bg.url}
                                            alt={bg.name || 'Background'}
                                            className="w-full h-full object-cover"
                                        />
                                        {bg.isActive && (
                                            <div className="absolute top-1 left-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                ACTIVE
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <div className="flex gap-1">
                                                {!bg.isActive && (
                                                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700">
                                                        Activate
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    className="h-7 text-xs bg-red-600 hover:bg-red-700"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteBg(bg.id);
                                                    }}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
