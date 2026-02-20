import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    private client: PrismaClient;

    constructor() {
        this.client = new PrismaClient();
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

    get $transaction() {
        return this.client.$transaction.bind(this.client);
    }
}
