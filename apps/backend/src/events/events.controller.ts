import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from '../dto';

@Controller('api/events')
export class EventsController {
    constructor(private readonly eventsService: EventsService) { }

    @Post()
    async create(@Body() dto: CreateEventDto) {
        return this.eventsService.create(dto);
    }

    @Get(':slug')
    async findBySlug(@Param('slug') slug: string) {
        return this.eventsService.findBySlug(slug);
    }
}
