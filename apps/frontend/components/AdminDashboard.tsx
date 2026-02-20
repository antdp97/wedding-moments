'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, Download, Shield, Settings, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Photo, PhotoStatus } from '@/lib/types';
import { getAdminPhotos, getEventStats, updatePhotoStatus } from '@/lib/api';
import { useAdminSocket } from '@/hooks/useLiveWall';

const EVENT_SLUG = 'demo-event';

export default function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [stats, setStats] = useState({ totalPhotos: 0, pendingCount: 0, approvedCount: 0 });
    const [loading, setLoading] = useState(true);

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

    // Load data on authentication
    useEffect(() => {
        if (!isAuthenticated) return;

        async function loadData() {
            setLoading(true);
            await Promise.all([fetchPhotos(), fetchStats()]);
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

    const handleRefresh = async () => {
        await Promise.all([fetchPhotos(), fetchStats()]);
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
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">LiveEvent Dashboard</h1>
                        <p className="text-muted-foreground">Manage your event stream and photos</p>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Uploads</CardDescription>
                            <CardTitle className="text-4xl">{stats.totalPhotos}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Pending Review</CardDescription>
                            <CardTitle className="text-4xl text-yellow-600 dark:text-yellow-500">
                                {stats.pendingCount}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Live on Screen</CardDescription>
                            <CardTitle className="text-4xl text-green-600 dark:text-green-500">
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
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                                    <Button
                                        className="rounded-full w-12 h-12 bg-green-500 hover:bg-green-600 text-white border-none"
                                        onClick={() => handleUpdateStatus(photo.id, PhotoStatus.APPROVED)}
                                        title="Approve"
                                    >
                                        <Check className="w-6 h-6" />
                                    </Button>
                                    <Button
                                        className="rounded-full w-12 h-12 bg-red-500 hover:bg-red-600 text-white border-none"
                                        onClick={() => handleUpdateStatus(photo.id, PhotoStatus.REJECTED)}
                                        title="Reject"
                                    >
                                        <X className="w-6 h-6" />
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
            </div>
        </div>
    );
}
