import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private client: PrismaClient;

    constructor() {
        this.client = new PrismaClient({
            datasources: {
                db: {
                    url: process.env.DATABASE_URL,
                },
            },
            // Log slow queries in development to spot N+1 and pool contention
            log: process.env.NODE_ENV !== 'production'
                ? [{ emit: 'event', level: 'query' }]
                : [{ emit: 'event', level: 'warn' }],
        });

        // Log queries that take longer than 200ms
        (this.client.$on as (event: string, cb: (e: { duration: number; query: string }) => void) => void)(
            'query',
            (e) => {
                if (e.duration > 200) {
                    this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
                }
            },
        );
    }

    async onModuleInit() {
        await this.client.$connect();
    }

    async onModuleDestroy() {
        await this.client.$disconnect();
    }

    get user() {
        return this.client.user;
    }

    get event() {
        return this.client.event;
    }

    get photo() {
        return this.client.photo;
    }

    get backgroundImage() {
        return this.client.backgroundImage;
    }

    get $transaction() {
        return this.client.$transaction.bind(this.client);
    }
}
