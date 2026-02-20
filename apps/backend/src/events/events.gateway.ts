import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*', // Configure for production
    },
    namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private logger = new Logger('EventsGateway');

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    /**
     * Client joins an event room to receive updates for that event
     * Usage: socket.emit('join_event', { eventSlug: 'my-wedding' })
     */
    @SubscribeMessage('join_event')
    handleJoinEvent(
        @MessageBody() data: { eventSlug: string },
        @ConnectedSocket() client: Socket,
    ) {
        const room = `event-${data.eventSlug}`;
        client.join(room);
        this.logger.log(`Client ${client.id} joined room ${room}`);
        return { success: true, room };
    }

    /**
     * Client joins admin room for broader event updates
     * Usage: socket.emit('join_admin', { eventSlug: 'my-wedding' })
     */
    @SubscribeMessage('join_admin')
    handleJoinAdmin(
        @MessageBody() data: { eventSlug: string },
        @ConnectedSocket() client: Socket,
    ) {
        const room = `admin-${data.eventSlug}`;
        client.join(room);
        this.logger.log(`Admin ${client.id} joined room ${room}`);
        return { success: true, room };
    }

    /**
     * Emit photo_approved event to all clients in the event room
     * Called by PhotosService when a photo is approved
     */
    emitPhotoApproved(eventSlug: string, photo: object): void {
        const room = `event-${eventSlug}`;
        this.server.to(room).emit('photo_approved', photo);
        this.logger.log(`Emitted photo_approved to ${room}`);
    }

    /**
     * Emit admin stats update to admin dashboard
     * Called by PhotosService when photos are uploaded/moderated
     */
    emitAdminStats(
        eventSlug: string,
        stats: { totalPhotos: number; pendingCount: number },
    ): void {
        const adminRoom = `admin-${eventSlug}`;
        this.server.to(adminRoom).emit('admin_stat_update', stats);
        this.logger.log(`Emitted admin_stat_update to ${adminRoom}`);
    }

    /**
     * Emit photo_removed event to all clients in the event room
     * Called by PhotosService when a photo is rejected or deleted
     */
    emitPhotoRemoved(eventSlug: string, photoId: string): void {
        const room = `event-${eventSlug}`;
        this.server.to(room).emit('photo_removed', { id: photoId });
        this.logger.log(`Emitted photo_removed (${photoId}) to ${room}`);
    }

    /**
     * Emit background_changed event to all clients in the event room
     * Called by PhotosService when admin changes the active background
     */
    emitBackgroundChanged(eventSlug: string, backgroundUrl: string | null): void {
        const room = `event-${eventSlug}`;
        this.server.to(room).emit('background_changed', { url: backgroundUrl });
        this.logger.log(`Emitted background_changed to ${room}`);
    }
}
