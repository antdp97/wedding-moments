import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePhotoDto, PhotoResponseDto } from '../dto';
import { PhotoStatus } from '@prisma/client';
import { SseEmitterService } from '../events/sse-emitter.service';
import { EventCacheService } from '../events/event-cache.service';
import { AdminStatsDebouncer } from '../events/admin-stats-debouncer.service';

@Injectable()
export class PhotosService {
    private readonly logger = new Logger(PhotosService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly sseEmitter: SseEmitterService,
        private readonly eventCache: EventCacheService,
        private readonly statsDebouncer: AdminStatsDebouncer,
    ) { }

    async create(dto: CreatePhotoDto): Promise<PhotoResponseDto> {
        // Check cache first — under 50 concurrent uploads, only the first hits DB
        let event = this.eventCache.get(dto.eventId);
        if (!event) {
            const dbEvent = await this.prisma.event.findUnique({
                where: { id: dto.eventId },
            });
            if (!dbEvent) {
                throw new NotFoundException(`Event with ID ${dto.eventId} not found`);
            }
            this.eventCache.set(dbEvent);
            event = dbEvent;
        }

        // Parse settings safely
        const settings =
            typeof event.settings === 'object' ? event.settings : {};
        const autoApprove = (settings as { autoApprove?: boolean }).autoApprove ?? false;

        // Determine initial status
        const status: PhotoStatus = autoApprove
            ? PhotoStatus.APPROVED
            : PhotoStatus.PENDING;

        // Create photo record
        const photo = await this.prisma.photo.create({
            data: {
                eventId: dto.eventId,
                url: dto.url,
                senderName: dto.senderName,
                message: dto.message,
                mimeType: dto.mimeType,
                status,
            },
        });

        // If auto-approved, emit SSE event immediately
        if (status === PhotoStatus.APPROVED) {
            this.sseEmitter.emitPhotoApproved(event.slug, photo);
        }

        // Debounced stats — 50 concurrent uploads coalesce into 1 groupBy query
        this.statsDebouncer.schedule(event.slug, event.id);

        return photo;
    }

    async getApprovedPhotos(eventSlug: string): Promise<PhotoResponseDto[]> {
        const event = await this.prisma.event.findUnique({
            where: { slug: eventSlug },
        });

        if (!event) {
            throw new NotFoundException(`Event with slug ${eventSlug} not found`);
        }

        return this.prisma.photo.findMany({
            where: {
                eventId: event.id,
                status: PhotoStatus.APPROVED,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async updateStatus(
        photoId: string,
        status: PhotoStatus,
    ): Promise<PhotoResponseDto> {
        const photo = await this.prisma.photo.update({
            where: { id: photoId },
            data: { status },
            include: { event: true },
        });

        if (status === PhotoStatus.APPROVED) {
            this.sseEmitter.emitPhotoApproved(photo.event.slug, photo);
        } else if (status === PhotoStatus.REJECTED) {
            this.sseEmitter.emitPhotoRemoved(photo.event.slug, photo.id);
        }

        this.statsDebouncer.schedule(photo.event.slug, photo.eventId);

        return photo;
    }

    async getAllByEvent(eventId: string): Promise<PhotoResponseDto[]> {
        return this.prisma.photo.findMany({
            where: { eventId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getAllBySlug(eventSlug: string): Promise<PhotoResponseDto[]> {
        const event = await this.prisma.event.findUnique({
            where: { slug: eventSlug },
            include: { photos: { orderBy: { createdAt: 'desc' } } },
        });

        if (!event) {
            throw new NotFoundException(`Event with slug ${eventSlug} not found`);
        }

        return event.photos;
    }

    async getStatsBySlug(eventSlug: string) {
        const event = await this.prisma.event.findUnique({
            where: { slug: eventSlug },
        });

        if (!event) {
            throw new NotFoundException(`Event with slug ${eventSlug} not found`);
        }

        const counts = await this.prisma.photo.groupBy({
            by: ['status'],
            where: { eventId: event.id },
            _count: { status: true },
        });

        const totalPhotos = counts.reduce((sum, g) => sum + g._count.status, 0);
        const pendingCount =
            counts.find((g) => g.status === PhotoStatus.PENDING)?._count.status ?? 0;
        const approvedCount =
            counts.find((g) => g.status === PhotoStatus.APPROVED)?._count.status ?? 0;

        return { totalPhotos, pendingCount, approvedCount };
    }

    async delete(photoId: string): Promise<PhotoResponseDto> {
        const photo = await this.prisma.photo.findUnique({
            where: { id: photoId },
            include: { event: true },
        });

        if (!photo) {
            throw new NotFoundException(`Photo with ID ${photoId} not found`);
        }

        await this.prisma.photo.delete({
            where: { id: photoId },
        });

        this.sseEmitter.emitPhotoRemoved(photo.event.slug, photo.id);

        this.statsDebouncer.schedule(photo.event.slug, photo.eventId);

        return photo;
    }

    // ============================================
    // Background Image Methods
    // ============================================

    async createBackground(eventSlug: string, url: string, name?: string) {
        const event = await this.prisma.event.findUnique({ where: { slug: eventSlug } });
        if (!event) throw new NotFoundException(`Event with slug ${eventSlug} not found`);

        return this.prisma.backgroundImage.create({
            data: { eventId: event.id, url, name: name || null },
        });
    }

    async getBackgrounds(eventSlug: string) {
        const event = await this.prisma.event.findUnique({ where: { slug: eventSlug } });
        if (!event) throw new NotFoundException(`Event with slug ${eventSlug} not found`);

        return this.prisma.backgroundImage.findMany({
            where: { eventId: event.id },
            orderBy: { createdAt: 'desc' },
        });
    }

    async activateBackground(backgroundId: string) {
        const bg = await this.prisma.backgroundImage.findUnique({
            where: { id: backgroundId },
            include: { event: true },
        });
        if (!bg) throw new NotFoundException(`Background with ID ${backgroundId} not found`);

        // Deactivate all backgrounds for this event
        await this.prisma.backgroundImage.updateMany({
            where: { eventId: bg.eventId },
            data: { isActive: false },
        });

        // Activate the selected one
        const updated = await this.prisma.backgroundImage.update({
            where: { id: backgroundId },
            data: { isActive: true },
        });

        // Emit to Live Wall
        this.sseEmitter.emitBackgroundChanged(bg.event.slug, updated.url);

        return updated;
    }

    async deactivateAllBackgrounds(eventSlug: string) {
        const event = await this.prisma.event.findUnique({ where: { slug: eventSlug } });
        if (!event) throw new NotFoundException(`Event with slug ${eventSlug} not found`);

        await this.prisma.backgroundImage.updateMany({
            where: { eventId: event.id },
            data: { isActive: false },
        });

        // Emit null to revert to default gradient
        this.sseEmitter.emitBackgroundChanged(eventSlug, null);
    }

    async deleteBackground(backgroundId: string) {
        const bg = await this.prisma.backgroundImage.findUnique({
            where: { id: backgroundId },
            include: { event: true },
        });
        if (!bg) throw new NotFoundException(`Background with ID ${backgroundId} not found`);

        await this.prisma.backgroundImage.delete({ where: { id: backgroundId } });

        // If the deleted bg was active, notify Live Wall to revert
        if (bg.isActive) {
            this.sseEmitter.emitBackgroundChanged(bg.event.slug, null);
        }

        return bg;
    }

    async getActiveBackground(eventSlug: string) {
        try {
            const event = await this.prisma.event.findUnique({ where: { slug: eventSlug } });
            if (!event) throw new NotFoundException(`Event with slug ${eventSlug} not found`);

            return this.prisma.backgroundImage.findFirst({
                where: { eventId: event.id, isActive: true },
            });
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error(`[BackgroundService] getActiveBackground failed for slug "${eventSlug}":`, error);
            throw error;
        }
    }
}
