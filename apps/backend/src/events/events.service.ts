import { Injectable, NotFoundException } from '@nestjs/common';
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
}
