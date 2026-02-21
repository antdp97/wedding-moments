import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from '../dto';

@Controller('api')
export class EventsController {
    constructor(private readonly eventsService: EventsService) { }

    // ─── Public ───

    @Post('events')
    async create(@Body() dto: CreateEventDto) {
        return this.eventsService.create(dto);
    }

    @Get('events/:slug')
    async findBySlug(@Param('slug') slug: string) {
        return this.eventsService.findBySlug(slug);
    }

    // ─── Admin ───

    @Get('admin/events')
    async adminGetAllEvents() {
        return this.eventsService.findAll();
    }

    @Post('admin/events')
    async adminCreateEvent(@Body() body: { name: string; slug: string }) {
        return this.eventsService.createForAdmin(body);
    }

    @Patch('admin/events/:slug')
    async adminUpdateEvent(@Param('slug') slug: string, @Body() body: { name: string }) {
        return this.eventsService.updateAdminEvent(slug, body);
    }

    @Delete('admin/events/:slug')
    async adminDeleteEvent(@Param('slug') slug: string) {
        return this.eventsService.deleteAdminEvent(slug);
    }
}
