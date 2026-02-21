import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from '../dto';

@Injectable()
export class EventsService {
    constructor(private prisma: PrismaService) { }

    async create(dto: CreateEventDto) {
        return this.prisma.event.create({
            data: {
                name: dto.name,
                slug: dto.slug,
                hostId: dto.hostId,
            },
        });
    }

    async findAll() {
        return this.prisma.event.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { photos: true },
                },
            },
        });
    }

    async createForAdmin(data: { name: string; slug: string }) {
        const existing = await this.prisma.event.findUnique({ where: { slug: data.slug } });
        if (existing) {
            throw new ConflictException(`Event with slug "${data.slug}" already exists`);
        }

        // Find or create a default admin host user
        let host = await this.prisma.user.findUnique({ where: { email: 'admin@weddingmemos.app' } });
        if (!host) {
            const bcrypt = await import('bcrypt');
            host = await this.prisma.user.create({
                data: {
                    email: 'admin@weddingmemos.app',
                    passwordHash: await bcrypt.hash('admin', 10),
                },
            });
        }

        return this.prisma.event.create({
            data: {
                name: data.name,
                slug: data.slug,
                hostId: host.id,
            },
        });
    }

    async findBySlug(slug: string) {
        const event = await this.prisma.event.findUnique({
            where: { slug },
        });

        if (!event) {
            throw new NotFoundException(`Event with slug ${slug} not found`);
        }

        return event;
    }

    async findByHostId(hostId: string) {
        return this.prisma.event.findMany({
            where: { hostId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async updateSettings(eventId: string, settings: object) {
        return this.prisma.event.update({
            where: { id: eventId },
            data: { settings },
        });
    }

    async updateAdminEvent(slug: string, data: { name: string }) {
        const event = await this.prisma.event.findUnique({ where: { slug } });
        if (!event) {
            throw new NotFoundException(`Event with slug "${slug}" not found`);
        }
        return this.prisma.event.update({
            where: { slug },
            data: { name: data.name },
        });
    }

    async deleteAdminEvent(slug: string) {
        const event = await this.prisma.event.findUnique({ where: { slug } });
        if (!event) {
            throw new NotFoundException(`Event with slug "${slug}" not found`);
        }
        await this.prisma.event.delete({ where: { slug } });
        return { success: true };
    }
}
