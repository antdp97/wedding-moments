import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePhotoDto, PhotoResponseDto } from '../dto';
import { PhotoStatus } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class PhotosService {
    constructor(
        private prisma: PrismaService,
        private eventsGateway: EventsGateway,
    ) { }

    async create(dto: CreatePhotoDto): Promise<PhotoResponseDto> {
        // Get event to check auto-approve setting
        const event = await this.prisma.event.findUnique({
            where: { id: dto.eventId },
        });

        if (!event) {
            throw new NotFoundException(`Event with ID ${dto.eventId} not found`);
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

        // If auto-approved, emit WebSocket event immediately
        if (status === PhotoStatus.APPROVED) {
            this.eventsGateway.emitPhotoApproved(event.slug, photo);
        }

        // Always emit admin stat update
        await this.emitAdminStats(event.slug);

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

        // If newly approved, emit WebSocket event
        if (status === PhotoStatus.APPROVED) {
            this.eventsGateway.emitPhotoApproved(photo.event.slug, photo);
        } else if (status === PhotoStatus.REJECTED) {
            // If rejected, emit removal event to hide from live wall
            this.eventsGateway.emitPhotoRemoved(photo.event.slug, photo.id);
        }

        // Emit admin stats update
        await this.emitAdminStats(photo.event.slug);

        return photo;
    }

    async getAllByEvent(eventId: string): Promise<PhotoResponseDto[]> {
        return this.prisma.photo.findMany({
            where: { eventId },
            orderBy: { createdAt: 'desc' },
        });
    }

    private async emitAdminStats(eventSlug: string): Promise<void> {
        const event = await this.prisma.event.findUnique({
            where: { slug: eventSlug },
        });

        if (!event) return;

        const [totalPhotos, pendingCount] = await Promise.all([
            this.prisma.photo.count({ where: { eventId: event.id } }),
            this.prisma.photo.count({
                where: { eventId: event.id, status: PhotoStatus.PENDING },
            }),
        ]);

        this.eventsGateway.emitAdminStats(eventSlug, { totalPhotos, pendingCount });
    }

    async getAllBySlug(eventSlug: string): Promise<PhotoResponseDto[]> {
        const event = await this.prisma.event.findUnique({
            where: { slug: eventSlug },
        });

        if (!event) {
            throw new NotFoundException(`Event with slug ${eventSlug} not found`);
        }

        return this.prisma.photo.findMany({
            where: { eventId: event.id },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getStatsBySlug(eventSlug: string) {
        const event = await this.prisma.event.findUnique({
            where: { slug: eventSlug },
        });

        if (!event) {
            throw new NotFoundException(`Event with slug ${eventSlug} not found`);
        }

        const [totalPhotos, pendingCount, approvedCount] = await Promise.all([
            this.prisma.photo.count({ where: { eventId: event.id } }),
            this.prisma.photo.count({
                where: { eventId: event.id, status: PhotoStatus.PENDING },
            }),
            this.prisma.photo.count({
                where: { eventId: event.id, status: PhotoStatus.APPROVED },
            }),
        ]);

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

        // Emit removal event to live wall
        this.eventsGateway.emitPhotoRemoved(photo.event.slug, photo.id);

        // Emit admin stats update
        await this.emitAdminStats(photo.event.slug);

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
        this.eventsGateway.emitBackgroundChanged(bg.event.slug, updated.url);

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
        this.eventsGateway.emitBackgroundChanged(eventSlug, null);
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
            this.eventsGateway.emitBackgroundChanged(bg.event.slug, null);
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
